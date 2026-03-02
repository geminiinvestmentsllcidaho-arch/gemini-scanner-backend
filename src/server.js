import dotenv from 'dotenv';
import express from 'express';
import { startMarketDataStream } from './market_data_stream.js';
import { marketDataDump } from './utils/market_data_dump.js';
import { getDiagnostics } from './diagnostics/index.js';
import { health, readiness } from './utils/health.js';
import { nextStep } from './next-step.js';

import { buildLiveSnapshot } from './utils/live_snapshot.js';
import { buildBarsByTfFrom1m } from './pillar3/aggregate_bars.mjs';

import { getCoaching } from './pillar2/coaching_engine.js';
import { computeContext as computeContextV3 } from './pillar3/context_engine.mjs';
import { writeRunlog } from './runlog-write.js';
import { listRuns, readRun, runlogIndex } from './utils/runlog_index.js';

dotenv.config();

const app = express();
app.use(express.json());

const P3_ENABLED = process.env.P3_ENABLED === '1';

// --------------------
// Health / Readiness / Diagnostics / Marketdata / Runlog
// --------------------
app.get('/health', health);
app.get('/readiness', readiness);
app.get('/diagnostics', getDiagnostics);
app.get('/marketdata', marketDataDump);

// Runlog endpoints
app.get('/runlog', runlogIndex);
app.get('/runlog/:id', (req, res) => {
  const runId = req.params.id;
  if (!runId) return res.status(400).json({ ok: false, error: 'Missing runId' });

  const runData = readRun(runId);
  if (!runData) return res.status(404).json({ ok: false, error: 'Run not found' });

  res.json({ ok: true, runId, runData, ts: new Date().toISOString() });
});

// --------------------
// /api/next-step endpoint
// --------------------
app.get('/api/next-step', (req, res) => {
  const symbol = req.query.symbol || 'AAPL';
  const decision = nextStep(symbol);

  const coaching = getCoaching({
    symbol,
    decision,
    snapshot: null,
    ctx: { rules: { lcmEnabled: true } },
  });

  res.json({ ...decision, coaching });
});

// --------------------
// /coach endpoint
// --------------------
app.post('/coach', (req, res) => {
  try {
    const { symbol, snapshot, decision, rules } = req.body || {};
    if (!symbol) return res.status(400).json({ ok: false, error: 'Missing symbol' });

    const snap = snapshot || buildLiveSnapshot(symbol, {});
    const dec = decision || { symbol, action: 'hold' };
    const ctxRules = rules || { lcmEnabled: true };

    const out = getCoaching({
      symbol,
      snapshot: snap,
      decision: dec,
      ctx: { rules: ctxRules },
    });

    res.json(out);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --------------------
// /ops/run endpoint
// --------------------
app.post('/ops/run', (req, res) => {
  try {
    const inputs = req.body || {};
    const decision = inputs.decision;
    const symbol = decision?.symbol;
    const action = decision?.action;

    if (!decision || !symbol || !action) {
      return res.status(400).json({ ok: false, error: 'Missing decision (symbol/action)' });
    }

    const snapshot = buildLiveSnapshot(symbol, {});
    const coaching = getCoaching({
      symbol,
      decision,
      snapshot,
      ctx: { rules: { lcmEnabled: true } },
    });

    // -------- Pillar 3 Compute-Only (Guarded) --------
    let context_v3 = null;
    let p3_gate = { ok: true };

    if (P3_ENABLED) {
      const nowMs = Date.now();
      const session = snapshot?.session || 'unknown';

      const barsByTf = buildBarsByTfFrom1m(snapshot?.bars || []);

      // Compute lastBar + ageSec (prefer snapshot.bar.t, else last bars[] entry)
      const lastBarIso =
        snapshot?.bar?.t ||
        (Array.isArray(snapshot?.bars) && snapshot.bars.length
          ? snapshot.bars[snapshot.bars.length - 1]?.t
          : null);

      const lastBarMs = lastBarIso ? Date.parse(lastBarIso) : NaN;
      const ageSec = Number.isFinite(lastBarMs) ? Math.floor((nowMs - lastBarMs) / 1000) : null;

      // Lookback sufficiency thresholds (tuneable later)
      const minLookback = { '1m': 60, '5m': 60, '15m': 40, '1h': 30 };
      const lookbackHave = Object.fromEntries(
        Object.entries(minLookback).map(([tf]) => [tf, Array.isArray(barsByTf?.[tf]) ? barsByTf[tf].length : 0])
      );

      const insufficientLookback = Object.entries(minLookback).some(([tf, min]) => (lookbackHave[tf] || 0) < min);

      // Freshness gate: stricter during regular session/unknown; relaxed when closed/off-hours
      const maxFreshSecRegular = Number(process.env.P3_MAX_FRESH_SEC_REGULAR || 600);      // 10 min
      const maxFreshSecClosed  = Number(process.env.P3_MAX_FRESH_SEC_CLOSED  || 604800);  // 7 days
      const maxFreshSec = (session === 'regular' || session === 'unknown') ? maxFreshSecRegular : maxFreshSecClosed;

      const staleHard = (ageSec === null)
        ? true
        : ((session === 'regular' || session === 'unknown') ? (ageSec > maxFreshSec) : false);

      if (staleHard || insufficientLookback) {
        p3_gate = {
          ok: false,
          reason: staleHard ? 'STALE_SNAPSHOT' : 'INSUFFICIENT_LOOKBACK',
          session,
          lastBar: lastBarIso,
          ageSec,
          maxFreshSec,
          minLookback,
          lookbackHave,
        };
        context_v3 = null; // hard skip
      } else {
        context_v3 = computeContextV3({
          symbol,
          barsByTf,
          nowMs,
          session,
          provider: "live_snapshot",
        });
        p3_gate = { ok: true, session, lastBar: lastBarIso, ageSec, minLookback, lookbackHave };
      }
    }

    const record = writeRunlog({
      mode: 'ops_run_dryrun',
      inputs,
      output: {
        result: decision,
        coaching,
      },
      context_v3,
      p3_gate,
    });

    const snapshotOut = {
      ...snapshot,
      barsCount: Array.isArray(snapshot?.bars) ? snapshot.bars.length : 0,
    };

    const coachingOut = {
      ...coaching,
      rsi: coaching?.debug?.rsiComputed ?? null,
      coachingCount: Array.isArray(coaching?.coaching)
        ? coaching.coaching.length
        : 0,
    };

    res.json({
      ok: true,
      runId: record.id,
      result: decision,
      snapshot: snapshotOut,
      coaching: coachingOut,
      context_v3: P3_ENABLED ? context_v3 : undefined,
      p3_gate: P3_ENABLED ? p3_gate : undefined,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --------------------
// Startup
// --------------------
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  try {
    await startMarketDataStream();
    console.log('[server] market data stream started');
  } catch (e) {
    console.error('[server] market data stream failed to start:', e);
  }
});
