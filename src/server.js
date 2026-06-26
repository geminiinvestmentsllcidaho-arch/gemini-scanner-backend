import fs from "node:fs";
import dotenv from 'dotenv';
import express from 'express';
import { startMarketDataStream } from './market_data_stream.js';
import { marketDataDump } from './utils/market_data_dump.js';
import { getDiagnostics } from './diagnostics/index.js';
import { health, readiness } from './utils/health.js';
import { getAlpacaRequestAudit } from "./utils/alpaca_request_audit.mjs";
import { getStreamTelemetry } from './utils/stream_telemetry.js';
import { nextStep } from './next-step.js';

import { buildLiveSnapshot } from './utils/live_snapshot.js';
import { buildBarsByTfFrom1m } from './pillar3/aggregate_bars.mjs';

import { getCoaching } from './pillar2/coaching_engine.js';
import { computeContext as computeContextV3 } from './pillar3/context_engine.mjs';
import { writeRunlog } from './runlog-write.js';
import { listRuns, readRun, runlogIndex } from './utils/runlog_index.js';
import { readScannerRankings } from './scanner/ranking_store.mjs';
import { registerOperatorDashboardRoutes } from './operator/operator_dashboard.mjs';

dotenv.config();


async function buildStage2LcmPayload() {
  const rankings = await readScannerRankings()
  return {
    version: 'stage2_lcm_payload_v1',
    scannerHealth: rankings.scannerHealth,
    rankingConfidence: rankings.rankingConfidence,
    stage2FinalCommand: rankings.stage2FinalCommand,
    stage2FinalPermission: rankings.stage2FinalPermission,
    decisionAssistCommand: rankings.decisionAssistCommand,
    userDecisionSummary: rankings.userDecisionSummary,
    lcmHeadline: rankings.lcmHeadline,
    actionCardPrimary: rankings.actionCardPrimary,
    coachingNarrative: rankings.coachingNarrative,
    stage2AppDisplay: rankings.stage2AppDisplay,
    stage2MobileDecisionCard: rankings.stage2MobileDecisionCard,
    stage2AppScreenPayload: rankings.stage2AppScreenPayload
  }
}

function attachStage2ToCoachingOutput(out, stage2Payload) {
  if (Array.isArray(out)) {
    return {
      ok: true,
      coaching: out,
      stage2Lcm: stage2Payload
    }
  }

  if (out && typeof out === 'object') {
    return {
      ...out,
      stage2Lcm: stage2Payload
    }
  }

  return {
    ok: true,
    coaching: [],
    rawCoachingOutput: out,
    stage2Lcm: stage2Payload
  }
}

const app = express();

const API_PATCH_PLAN_DASHBOARD_ROUTE = "/diagnostics/alpaca-api-patch-plan";

app.get(API_PATCH_PLAN_DASHBOARD_ROUTE, async (_req, res) => {
  try {
    const { readApiPatchPlanForDashboard } = await import("./scanner/api_patch_plan_dashboard.mjs");
    res.json(await readApiPatchPlanForDashboard());
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "API_PATCH_PLAN_DASHBOARD_ERROR",
      message: err?.message ?? String(err)
    });
  }
});

app.use(express.json());

const P3_ENABLED = process.env.P3_ENABLED === '1';

// --------------------
// Health / Readiness / Diagnostics / Marketdata / Runlog
// --------------------
app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#070b1f" />
<title>GeminiScanner | Decision-Assist Trading Intelligence</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow-x:hidden;background:#070b1f;color:#f6f8ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100vh;background:radial-gradient(circle at 18% 0%,rgba(96,120,255,.38),transparent 370px),radial-gradient(circle at 92% 10%,rgba(38,208,111,.20),transparent 340px),linear-gradient(180deg,#111846 0%,#081026 48%,#050713 100%)}a{color:inherit;text-decoration:none}.wrap{width:min(1120px,calc(100vw - 28px));margin:0 auto;padding:18px 0 56px}.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:22px}.brand{display:flex;align-items:center;gap:10px;font-weight:950;font-size:clamp(24px,7vw,38px);letter-spacing:-.06em}.logo{width:42px;height:42px;border-radius:15px;display:grid;place-items:center;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16)}.pill{display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#cfd8f5;font-weight:750}.dot{width:11px;height:11px;border-radius:999px;background:#27d875;box-shadow:0 0 0 7px rgba(39,216,117,.13),0 0 22px rgba(39,216,117,.7)}.hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:18px;align-items:stretch}.card{border:1px solid rgba(255,255,255,.15);background:linear-gradient(180deg,rgba(255,255,255,.105),rgba(255,255,255,.045));border-radius:28px;box-shadow:0 24px 80px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.10);backdrop-filter:blur(14px)}.hero-main{padding:clamp(24px,6vw,54px);min-height:500px;display:flex;flex-direction:column;justify-content:space-between}.eyebrow{width:fit-content;margin-bottom:18px;color:#dffff0;background:rgba(39,216,117,.12);border:1px solid rgba(39,216,117,.28);border-radius:999px;padding:9px 12px;font-weight:850}h1{margin:0;font-size:clamp(48px,13vw,98px);line-height:.91;letter-spacing:-.08em}.grad{background:linear-gradient(135deg,#fff 0%,#8eeaff 45%,#a3ffc9 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.lead{color:#aeb8d6;font-size:clamp(17px,4.4vw,22px);line-height:1.58;max-width:700px;margin:22px 0 0}.buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.btn{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);border-radius:999px;padding:12px 15px;font-weight:900}.primary{background:linear-gradient(135deg,rgba(102,228,255,.22),rgba(39,216,117,.18));border-color:rgba(102,228,255,.34)}.side{display:grid;gap:16px}.status{padding:22px}.label{color:#aeb8d6;text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:950}.command{margin:10px 0;color:#ffdce3;font-size:clamp(30px,8vw,48px);font-weight:950;letter-spacing:-.06em}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.metric{padding:13px;border-radius:17px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.18)}.metric span{display:block;color:#aeb8d6;font-size:13px}.metric b{display:block;margin-top:4px;font-size:22px;letter-spacing:-.04em}.phone{padding:16px;background:rgba(3,6,16,.82);border-radius:34px;border:1px solid rgba(255,255,255,.16)}.screen{min-height:390px;border-radius:24px;padding:22px;background:radial-gradient(circle at 50% 0%,rgba(102,228,255,.16),transparent 240px),rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.11)}.lock{width:78px;height:78px;border-radius:26px;display:grid;place-items:center;background:rgba(255,92,122,.12);border:1px solid rgba(255,92,122,.25);font-size:34px;margin:16px 0}h2{margin:0 0 8px;font-size:clamp(28px,7vw,38px);line-height:1;letter-spacing:-.06em}p{color:#aeb8d6;line-height:1.55}.disabled{margin-top:20px;padding:14px;text-align:center;border-radius:17px;background:rgba(255,92,122,.13);border:1px solid rgba(255,92,122,.25);color:#ffdce3;font-weight:950}.section-title{margin:42px 0 16px;display:flex;align-items:end;justify-content:space-between;gap:16px;flex-wrap:wrap}.section-title h2{max-width:680px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.feature{padding:20px;min-height:170px}.icon{width:44px;height:44px;display:grid;place-items:center;border-radius:15px;background:rgba(102,228,255,.10);border:1px solid rgba(102,228,255,.22);margin-bottom:12px}h3{margin:0 0 8px;font-size:20px;letter-spacing:-.03em}.stack{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.stack div{padding:15px;min-height:82px;display:flex;align-items:end;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-weight:850;color:#dde5fb}.endpoints{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.endpoint{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:15px;margin-top:10px;border-radius:17px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.18)}code{color:#eef2ff;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.tag{color:#aeb8d6;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.06);padding:6px 9px;border-radius:999px;white-space:nowrap;font-size:12px}footer{color:#aeb8d6;text-align:center;padding-top:28px;margin-top:44px;border-top:1px solid rgba(255,255,255,.13)}@media(max-width:900px){.hero,.grid,.endpoints,.stack{grid-template-columns:1fr}.hero-main{min-height:auto}}@media(max-width:520px){.wrap{width:min(100vw - 20px,1120px);padding-top:12px}.metrics{grid-template-columns:1fr}.card{border-radius:22px}.endpoint{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<main class="wrap">
<nav class="nav">
  <div class="brand"><span class="logo">◇</span><span>GeminiScanner</span></div>
  <div class="pill"><span class="dot"></span>Live • Decision-assist only</div>
</nav>

<section class="hero">
  <div class="card hero-main">
    <div>
      <div class="eyebrow">Stage 2 app + LCM integration active</div>
      <h1><span class="grad">Trading intelligence</span><br>for protected decisions.</h1>
      <p class="lead">GeminiScanner turns live scanner data into app-ready rankings, capital-protection commands, mobile decision cards, and LCM coaching packets.</p>
      <div class="buttons">
        <a class="btn primary" href="/scanner/stage2-app">Open App Payload</a>
        <a class="btn" href="/scanner/rankings">Scanner Rankings</a>
        <a class="btn" href="/health">Health Check</a>
      </div>
    </div>
  </div>

  <div class="side">
    <div class="card status">
      <div class="label">Current command</div>
      <div class="command">DO NOT TRADE</div>
      <div class="pill">Capital protection active</div>
      <div class="metrics">
        <div class="metric"><span>Permission</span><b>Denied</b></div>
        <div class="metric"><span>Mode</span><b>Watch-only</b></div>
        <div class="metric"><span>Safety</span><b>Locked</b></div>
        <div class="metric"><span>LCM</span><b>Connected</b></div>
      </div>
    </div>

    <div class="phone">
      <div class="screen">
        <div class="label">Mobile app preview</div>
        <div class="lock">🛡️</div>
        <h2>No entry authorized right now</h2>
        <p>Defensive capital protection is active. No entry is authorized until scanner conditions improve.</p>
        <div class="disabled">Do Not Enter</div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="section-title"><h2>App-ready features.</h2><p>Clean outputs for mobile screens, coaching, diagnostics, and operator validation.</p></div>
  <div class="grid">
    <div class="card feature"><div class="icon">📊</div><h3>Scanner rankings</h3><p>Quality, confidence, freshness, and defensive scanner state.</p></div>
    <div class="card feature"><div class="icon">🧠</div><h3>LCM coaching</h3><p>Coach responses include the Stage 2 decision packet.</p></div>
    <div class="card feature"><div class="icon">🛡️</div><h3>Capital protection</h3><p>Exit, invalidation, reentry, restart, and deployment controls.</p></div>
    <div class="card feature"><div class="icon">📱</div><h3>Mobile decision card</h3><p>Buttons, severity, disabled state, issue count, and safety mode.</p></div>
    <div class="card feature"><div class="icon">🧩</div><h3>Screen payload</h3><p>Hero, controls, banner, copy, diagnostics, and command fields.</p></div>
    <div class="card feature"><div class="icon">🔒</div><h3>No execution</h3><p>Decision-assist only. No auto-trading from this scanner.</p></div>
  </div>
</section>

<section>
  <div class="section-title"><h2>Stage 2 command stack.</h2><p>Each layer blocks weak or unsafe entries before they reach the user.</p></div>
  <div class="stack">
    <div>Exit protection</div><div>Invalidation</div><div>Protection command</div><div>Reentry control</div><div>Restart governance</div>
    <div>Deployment authorization</div><div>Final directive</div><div>User packet</div><div>Decision assist</div><div>Final command</div>
  </div>
</section>

<section>
  <div class="section-title"><h2>Operational endpoints.</h2><p>Protected by Basic Auth except the public landing and uptime health path.</p></div>
  <div class="endpoints">
    <div class="card feature">
      <h3>App payloads</h3>
      <div class="endpoint"><code>GET /scanner/stage2-app</code><span class="tag">mobile</span></div>
      <div class="endpoint"><code>GET /scanner/rankings</code><span class="tag">full</span></div>
      <div class="endpoint"><code>POST /coach</code><span class="tag">LCM</span></div>
      <div class="endpoint"><code>POST /ops/run</code><span class="tag">ops</span></div>
    </div>
    <div class="card feature">
      <h3>System checks</h3>
      <div class="endpoint"><code>GET /health</code><span class="tag">health</span></div>
      <div class="endpoint"><code>GET /readiness</code><span class="tag">ready</span></div>
      <div class="endpoint"><code>GET /diagnostics</code><span class="tag">diag</span></div>
      <div class="endpoint"><code>GET /marketdata</code><span class="tag">snapshot</span></div>
    </div>
  </div>
</section>

<footer><strong>GeminiScanner</strong><br>Decision-assist trading intelligence. Operator-controlled. No execution.</footer>
</main>
</body>
</html>`)
});

app.get('/health', health);
app.get('/readiness', readiness);
app.get('/diagnostics', getDiagnostics);
app.get('/diagnostics/alpaca-api-watch', (req, res) => {
  const reportFile = "runs/alpaca_api_watch_report.json";
  try {
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    res.json({ ok: true, report });
  } catch (err) {
    res.json({ ok: false, error: "WATCH_REPORT_UNAVAILABLE", message: err?.message || String(err) });
  }
});

app.get('/diagnostics/alpaca-requests', (req, res) => {
  res.json({
    ok: true,
    alpacaRequestAudit: getAlpacaRequestAudit(),
  });
});
app.get('/marketdata', marketDataDump);


app.get('/scanner/stage2-app', async (_req, res) => {
  try {
    const rankings = await readScannerRankings()
    res.json({
      ok: true,
      endpointVersion: 'scanner_stage2_app_v1',
      ts: rankings.ts,
      scannerHealth: rankings.scannerHealth,
      rankingConfidence: rankings.rankingConfidence,
      stage2FinalCommand: rankings.stage2FinalCommand,
      stage2FinalPermission: rankings.stage2FinalPermission,
      stage2AppDisplay: rankings.stage2AppDisplay,
      stage2MobileDecisionCard: rankings.stage2MobileDecisionCard,
      stage2AppScreenPayload: rankings.stage2AppScreenPayload
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'SCANNER_STAGE2_APP_FAILED',
      message: err && err.message ? err.message : String(err)
    })
  }
})

app.get('/scanner/rankings', (req, res) => {
  try {
    res.json({
      ...readScannerRankings(),
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

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
app.post('/coach', async (req, res) => {
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

    const stage2Payload = await buildStage2LcmPayload();

    res.json(attachStage2ToCoachingOutput(out, stage2Payload));
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --------------------
// /ops/run endpoint
// --------------------
app.post('/ops/run', async (req, res) => {
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

    const stage2Payload = await buildStage2LcmPayload();

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

      // Freshness gate: strict only during confirmed regular session; relaxed otherwise for off-hours/historical validation.
      const maxFreshSecRegular = Number(process.env.P3_MAX_FRESH_SEC_REGULAR || 600);      // 10 min
      const maxFreshSecClosed  = Number(process.env.P3_MAX_FRESH_SEC_CLOSED  || 604800);  // 7 days
      const isRegularSession = session === 'regular';
      const maxFreshSec = isRegularSession ? maxFreshSecRegular : maxFreshSecClosed;

      const staleHard = (ageSec === null)
        ? true
        : (isRegularSession ? (ageSec > maxFreshSec) : false);

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
        }, {
          telemetry: getStreamTelemetry({ nowMs }),
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
      stage2Lcm: stage2Payload,
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

if (!app.__geminiOperatorDashboardRoutesRegistered) {
  registerOperatorDashboardRoutes(app);
}

app.listen(PORT, HOST, async () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  try {
    await startMarketDataStream();
    console.log('[server] market data stream started');
  } catch (e) {
    console.error('[server] market data stream failed to start:', e);
  }
});
