import dotenv from 'dotenv';
import { buildLiveSnapshot } from "./utils/live_snapshot.js";
import express from 'express';
import { startMarketDataStream } from "./market_data_stream.js";
import { marketDataDump } from "./utils/market_data_dump.js";
import { getDiagnostics } from './diagnostics/index.js';
import { health, readiness } from './utils/health.js';
import { nextStep } from './next-step.js'; 
import { getCoaching } from './pillar2/coaching_engine.js';
import { writeRunlog } from './runlog-write.js';

dotenv.config(); // load environment variables first

const app = express();
app.use(express.json());

// --------------------
// Health / Readiness / Diagnostics
// --------------------
app.get('/health', health);
app.get("/marketdata", marketDataDump);
app.get('/readiness', readiness);
app.get('/diagnostics', getDiagnostics);

// --------------------
// /next-step endpoint
// --------------------
app.get('/api/next-step', (req, res) => {
    const symbol = req.query.symbol || 'AAPL';
    const decision = nextStep(symbol);
    const coaching = getCoaching({
      symbol,
      decision,
      snapshot: null,
      rules: { lcmEnabled: true },
    });
    res.json({ ...decision, coaching });
});

// --------------------
// /coach endpoint
// --------------------
app.post('/coach', (req, res) => {
    try {
        const { symbol, snapshot, decision, rules } = req.body || {};
        const out = getCoaching({ symbol, snapshot, decision, rules });
        res.json(out);
    } catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// --------------------
// /ops/run endpoint (live input, coaching included)
// --------------------
app.post('/ops/run', (req, res) => {
    try {
        const inputs = req.body || {};
        const decision = inputs.decision; // required
        const symbol = decision?.symbol;
        const action = decision?.action;

        if (!decision || !symbol || !action) {
            return res.status(400).json({
                ok: false,
                error: 'Missing decision (symbol/action) in request'
            });
        }

        // Live WS snapshot only (no REST history)
        const snapshot = buildLiveSnapshot(symbol, {});

        const coaching = getCoaching({
            symbol,
            decision,
            snapshot,
            ctx: { rules: { lcmEnabled: true } }
        });

        const record = writeRunlog({
            mode: 'ops_run_dryrun',
            inputs,
            output: { result: decision, coaching }
        });

        res.json({
            ok: true,
            runId: record.id,
            result: decision,
            snapshot,
            coaching,
            ts: new Date().toISOString()
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
