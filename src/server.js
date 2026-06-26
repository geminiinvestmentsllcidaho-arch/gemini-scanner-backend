import dotenv from 'dotenv';
import express from 'express';
import { startMarketDataStream } from './market_data_stream.js';
import { marketDataDump } from './utils/market_data_dump.js';
import { getDiagnostics } from './diagnostics/index.js';
import { health, readiness } from './utils/health.js';
import { getStreamTelemetry } from './utils/stream_telemetry.js';
import { nextStep } from './next-step.js';

import { buildLiveSnapshot } from './utils/live_snapshot.js';
import { buildBarsByTfFrom1m } from './pillar3/aggregate_bars.mjs';

import { getCoaching } from './pillar2/coaching_engine.js';
import { computeContext as computeContextV3 } from './pillar3/context_engine.mjs';
import { writeRunlog } from './runlog-write.js';
import { listRuns, readRun, runlogIndex } from './utils/runlog_index.js';
import { readScannerRankings } from './scanner/ranking_store.mjs';

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
app.use(express.json());

const P3_ENABLED = process.env.P3_ENABLED === '1';

// --------------------
// Health / Readiness / Diagnostics / Marketdata / Runlog
// --------------------
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#070b1f" />
  <title>GeminiScanner | Decision-Assist Trading Intelligence</title>
  <style>
    :root {
      --bg: #070b1f;
      --panel: rgba(255,255,255,.075);
      --panel2: rgba(255,255,255,.105);
      --line: rgba(255,255,255,.16);
      --text: #f4f7ff;
      --muted: #aeb8d6;
      --soft: #d8def3;
      --green: #26d06f;
      --amber: #ffb84d;
      --red: #ff5c7a;
      --cyan: #66e4ff;
      --blue: #8aa4ff;
      --shadow: 0 24px 90px rgba(0,0,0,.38);
      --radius: 28px;
    }

    * { box-sizing: border-box; }

    html {
      scroll-behavior: smooth;
      background: var(--bg);
    }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 18% 0%, rgba(95,117,255,.34), transparent 33rem),
        radial-gradient(circle at 88% 12%, rgba(28,214,152,.20), transparent 31rem),
        radial-gradient(circle at 50% 90%, rgba(102,228,255,.12), transparent 42rem),
        linear-gradient(180deg, #111846 0%, #081027 44%, #050814 100%);
      overflow-x: hidden;
    }

    body:before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,.45), transparent 72%);
    }

    a { color: inherit; text-decoration: none; }

    .shell {
      width: min(1180px, calc(100% - 36px));
      margin: 0 auto;
      padding: 24px 0 72px;
      position: relative;
      z-index: 1;
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 12px 0 28px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 900;
      letter-spacing: -.04em;
      font-size: clamp(1.35rem, 3.5vw, 2rem);
    }

    .logo {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 15px;
      background:
        linear-gradient(135deg, rgba(102,228,255,.25), rgba(38,208,111,.18)),
        rgba(255,255,255,.08);
      border: 1px solid var(--line);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
    }

    .navlinks {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .pill, .btn {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.07);
      border-radius: 999px;
      padding: 10px 14px;
      color: var(--soft);
      font-size: .94rem;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    }

    .btn {
      cursor: pointer;
      font-weight: 800;
      transition: transform .18s ease, background .18s ease, border-color .18s ease;
    }

    .btn:hover {
      transform: translateY(-1px);
      background: rgba(255,255,255,.12);
      border-color: rgba(255,255,255,.28);
    }

    .dot {
      width: 11px;
      height: 11px;
      border-radius: 999px;
      background: var(--green);
      box-shadow: 0 0 0 7px rgba(38,208,111,.12), 0 0 22px rgba(38,208,111,.75);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr);
      gap: 24px;
      align-items: stretch;
      margin-top: 10px;
    }

    .hero-card, .card {
      background:
        linear-gradient(180deg, rgba(255,255,255,.105), rgba(255,255,255,.052)),
        rgba(6,10,24,.72);
      border: 1px solid var(--line);
      box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,.10);
      border-radius: var(--radius);
      backdrop-filter: blur(16px);
    }

    .hero-card {
      padding: clamp(26px, 5vw, 54px);
      min-height: 510px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .hero-card:after {
      content: "";
      position: absolute;
      width: 340px;
      height: 340px;
      right: -120px;
      top: -90px;
      background: radial-gradient(circle, rgba(102,228,255,.24), transparent 65%);
      pointer-events: none;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      width: fit-content;
      color: #d7fff0;
      font-weight: 850;
      background: rgba(38,208,111,.12);
      border: 1px solid rgba(38,208,111,.30);
      padding: 9px 13px;
      border-radius: 999px;
      margin-bottom: 22px;
    }

    h1 {
      font-size: clamp(3rem, 9vw, 6.5rem);
      line-height: .9;
      letter-spacing: -.075em;
      margin: 0;
    }

    .grad {
      background: linear-gradient(135deg, #ffffff 0%, #8eeaff 44%, #9dffcb 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .lead {
      color: var(--muted);
      font-size: clamp(1.05rem, 2.7vw, 1.34rem);
      line-height: 1.62;
      max-width: 680px;
      margin: 24px 0 0;
    }

    .cta-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 30px;
    }

    .primary {
      background: linear-gradient(135deg, rgba(102,228,255,.22), rgba(38,208,111,.18));
      color: white;
      border-color: rgba(102,228,255,.34);
    }

    .danger {
      background: rgba(255,92,122,.12);
      border-color: rgba(255,92,122,.26);
      color: #ffdce3;
    }

    .dashboard {
      display: grid;
      gap: 18px;
    }

    .status-card {
      padding: 24px;
      min-height: 238px;
      position: relative;
      overflow: hidden;
    }

    .status-card:before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 78% 20%, rgba(255,184,77,.18), transparent 17rem);
      pointer-events: none;
    }

    .status-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      position: relative;
    }

    .label {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .14em;
      font-weight: 900;
      font-size: .78rem;
    }

    .command {
      font-size: clamp(1.65rem, 6vw, 3rem);
      font-weight: 950;
      letter-spacing: -.055em;
      margin: 12px 0 6px;
    }

    .denied {
      color: #ffdce3;
      text-shadow: 0 0 30px rgba(255,92,122,.26);
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 20px;
      position: relative;
    }

    .metric {
      border: 1px solid var(--line);
      background: rgba(0,0,0,.18);
      border-radius: 18px;
      padding: 15px;
    }

    .metric b {
      display: block;
      font-size: 1.35rem;
      letter-spacing: -.04em;
      margin-top: 4px;
    }

    .metric span {
      color: var(--muted);
      font-size: .86rem;
    }

    .phone {
      border-radius: 34px;
      padding: 16px;
      background: rgba(3,6,16,.80);
      border: 1px solid rgba(255,255,255,.16);
      box-shadow: inset 0 0 0 7px rgba(255,255,255,.035), var(--shadow);
    }

    .phone-screen {
      border-radius: 25px;
      min-height: 410px;
      padding: 22px;
      background:
        radial-gradient(circle at 50% 0%, rgba(102,228,255,.16), transparent 17rem),
        linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.025));
      border: 1px solid rgba(255,255,255,.12);
    }

    .mini-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--muted);
      font-size: .86rem;
      margin-bottom: 22px;
    }

    .lock {
      display: grid;
      place-items: center;
      width: 84px;
      height: 84px;
      border-radius: 28px;
      background: rgba(255,92,122,.12);
      border: 1px solid rgba(255,92,122,.28);
      font-size: 2.1rem;
      margin-bottom: 20px;
    }

    .phone h2 {
      font-size: 2rem;
      line-height: 1;
      letter-spacing: -.055em;
      margin: 0 0 10px;
    }

    .phone p {
      color: var(--muted);
      line-height: 1.55;
      margin: 0;
    }

    .phone-actions {
      display: grid;
      gap: 10px;
      margin-top: 24px;
    }

    .phone-button {
      padding: 14px 16px;
      border-radius: 17px;
      text-align: center;
      font-weight: 900;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.08);
    }

    .phone-button.disabled {
      color: #ffdce3;
      background: rgba(255,92,122,.12);
      border-color: rgba(255,92,122,.25);
    }

    section {
      margin-top: 24px;
    }

    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 18px;
      margin: 46px 0 18px;
    }

    .section-head h2 {
      margin: 0;
      font-size: clamp(1.8rem, 5vw, 3rem);
      letter-spacing: -.06em;
    }

    .section-head p {
      margin: 0;
      color: var(--muted);
      max-width: 560px;
      line-height: 1.55;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .grid.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .card {
      padding: 22px;
      min-height: 184px;
    }

    .card-icon {
      width: 46px;
      height: 46px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: rgba(102,228,255,.10);
      border: 1px solid rgba(102,228,255,.22);
      margin-bottom: 16px;
      font-size: 1.25rem;
    }

    .card h3 {
      margin: 0 0 8px;
      letter-spacing: -.03em;
      font-size: 1.2rem;
    }

    .card p, .card li {
      color: var(--muted);
      line-height: 1.55;
      margin: 0;
    }

    .stack {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .stack-item {
      padding: 15px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.055);
      color: var(--soft);
      font-weight: 820;
      min-height: 86px;
      display: flex;
      align-items: end;
    }

    .endpoint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      border-radius: 18px;
      background: rgba(0,0,0,.18);
      border: 1px solid var(--line);
      margin-top: 10px;
    }

    code {
      color: #e9eeff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: .92em;
    }

    .tag {
      color: var(--muted);
      border: 1px solid var(--line);
      background: rgba(255,255,255,.06);
      padding: 6px 9px;
      border-radius: 999px;
      font-size: .78rem;
      white-space: nowrap;
    }

    .timeline {
      display: grid;
      gap: 12px;
    }

    .timeline-row {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      gap: 14px;
      padding: 16px;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.055);
    }

    .timeline-row strong {
      color: #fff;
    }

    .timeline-row span {
      color: var(--muted);
      line-height: 1.55;
    }

    .footer {
      color: var(--muted);
      text-align: center;
      margin-top: 48px;
      padding-top: 22px;
      border-top: 1px solid var(--line);
      line-height: 1.6;
    }

    @media (max-width: 900px) {
      .hero, .grid, .grid.two, .stack {
        grid-template-columns: 1fr;
      }

      .nav {
        align-items: flex-start;
        flex-direction: column;
      }

      .navlinks {
        justify-content: flex-start;
      }

      .hero-card {
        min-height: auto;
      }

      .section-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .timeline-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 520px) {
      .shell {
        width: min(100% - 24px, 1180px);
        padding-top: 14px;
      }

      .metric-grid {
        grid-template-columns: 1fr;
      }

      .hero-card, .card, .status-card {
        border-radius: 22px;
      }

      .endpoint {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav">
      <a class="brand" href="/">
        <span class="logo">◇</span>
        <span>GeminiScanner</span>
      </a>
      <div class="navlinks">
        <a class="pill" href="/health"><span class="dot"></span> Live system</a>
        <a class="pill" href="#features">Features</a>
        <a class="pill" href="#endpoints">Endpoints</a>
      </div>
    </nav>

    <section class="hero">
      <div class="hero-card">
        <div>
          <div class="eyebrow"><span class="dot"></span> Decision-assist only • No execution</div>
          <h1><span class="grad">Trading intelligence</span><br />for protected decisions.</h1>
          <p class="lead">
            GeminiScanner converts live market signals into a controlled decision packet:
            rankings, capital protection, LCM coaching, app display payloads, and execution-safe
            user guidance.
          </p>
          <div class="cta-row">
            <a class="btn primary" href="/scanner/stage2-app">Open Stage 2 App Payload</a>
            <a class="btn" href="/scanner/rankings">View Scanner Rankings</a>
            <a class="btn danger" href="#safety">Safety Mode Active</a>
          </div>
        </div>
      </div>

      <div class="dashboard">
        <div class="status-card">
          <div class="status-top">
            <div>
              <div class="label">Current command</div>
              <div class="command denied">DO NOT TRADE</div>
              <div class="pill">Capital protection active</div>
            </div>
            <span class="tag">Stage 2</span>
          </div>
          <div class="metric-grid">
            <div class="metric"><span>Permission</span><b>Denied</b></div>
            <div class="metric"><span>Mode</span><b>Watch-only</b></div>
            <div class="metric"><span>Safety</span><b>Locked</b></div>
            <div class="metric"><span>LCM</span><b>Connected</b></div>
          </div>
        </div>

        <div class="phone">
          <div class="phone-screen">
            <div class="mini-top"><span>GeminiScanner App</span><span>Protected</span></div>
            <div class="lock">🛡️</div>
            <h2>No entry authorized right now</h2>
            <p>
              Defensive capital protection is active. The app receives a clean mobile decision card,
              app screen payload, and LCM coaching packet.
            </p>
            <div class="phone-actions">
              <div class="phone-button disabled">Do Not Enter</div>
              <div class="phone-button">View Details</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="features">
      <div class="section-head">
        <h2>Built like an app backend.</h2>
        <p>Clean outputs for mobile screens, coaching, diagnostics, and operator validation.</p>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-icon">📊</div>
          <h3>Scanner rankings</h3>
          <p>Ranks candidates with quality, confidence, freshness, and intelligence layers.</p>
        </div>
        <div class="card">
          <div class="card-icon">🧠</div>
          <h3>LCM coaching</h3>
          <p>Coaching responses now carry Stage 2 decision payloads for app display.</p>
        </div>
        <div class="card">
          <div class="card-icon">🛡️</div>
          <h3>Capital protection</h3>
          <p>Exit, invalidation, reentry, restart, deployment, and final command controls.</p>
        </div>
        <div class="card">
          <div class="card-icon">📱</div>
          <h3>Mobile decision card</h3>
          <p>App-ready card fields: severity, command, buttons, disabled states, and issues.</p>
        </div>
        <div class="card">
          <div class="card-icon">🧩</div>
          <h3>Screen payload</h3>
          <p>One clean object for app hero, controls, banner, copy, and diagnostics.</p>
        </div>
        <div class="card">
          <div class="card-icon">🔒</div>
          <h3>No auto-execution</h3>
          <p>Decision-assist only. The system can inform a user but cannot place trades.</p>
        </div>
      </div>
    </section>

    <section id="safety">
      <div class="section-head">
        <h2>Stage 2 command stack.</h2>
        <p>Every layer is designed to stop weak or unsafe entries before they reach the user.</p>
      </div>

      <div class="stack">
        <div class="stack-item">Exit protection</div>
        <div class="stack-item">Invalidation</div>
        <div class="stack-item">Protection command</div>
        <div class="stack-item">Reentry control</div>
        <div class="stack-item">Restart governance</div>
        <div class="stack-item">Deployment authorization</div>
        <div class="stack-item">Final decision directive</div>
        <div class="stack-item">User decision packet</div>
        <div class="stack-item">Decision assist output</div>
        <div class="stack-item">Stage 2 final command</div>
      </div>
    </section>

    <section id="endpoints">
      <div class="section-head">
        <h2>Operational endpoints.</h2>
        <p>Public landing stays readable. Protected endpoints require credentials through Nginx Basic Auth.</p>
      </div>

      <div class="grid two">
        <div class="card">
          <h3>App payloads</h3>
          <div class="endpoint"><code>GET /scanner/stage2-app</code><span class="tag">mobile app</span></div>
          <div class="endpoint"><code>GET /scanner/rankings</code><span class="tag">full scanner</span></div>
          <div class="endpoint"><code>POST /coach</code><span class="tag">LCM packet</span></div>
          <div class="endpoint"><code>POST /ops/run</code><span class="tag">ops validation</span></div>
        </div>
        <div class="card">
          <h3>System checks</h3>
          <div class="endpoint"><code>GET /health</code><span class="tag">health</span></div>
          <div class="endpoint"><code>GET /readiness</code><span class="tag">readiness</span></div>
          <div class="endpoint"><code>GET /diagnostics</code><span class="tag">diagnostics</span></div>
          <div class="endpoint"><code>GET /marketdata</code><span class="tag">snapshot</span></div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Product path.</h2>
        <p>The scanner is moving from backend intelligence to app-ready user experience.</p>
      </div>

      <div class="timeline">
        <div class="timeline-row"><strong>Stage 1</strong><span>Scanner health, ranking confidence, normalization, quality, and defensive stale-state handling.</span></div>
        <div class="timeline-row"><strong>Stage 2</strong><span>Capital protection, decision-assist command stack, app display payload, mobile card, and LCM integration.</span></div>
        <div class="timeline-row"><strong>Stage 3</strong><span>Next intelligence expansion after the website and app-facing outputs are frozen.</span></div>
      </div>
    </section>

    <footer class="footer">
      <strong>GeminiScanner</strong><br />
      Decision-assist trading intelligence. No trade execution. Operator-controlled.
    </footer>
  </main>
</body>
</html>`)
});

app.get('/health', health);
app.get('/readiness', readiness);
app.get('/diagnostics', getDiagnostics);
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

app.listen(PORT, HOST, async () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  try {
    await startMarketDataStream();
    console.log('[server] market data stream started');
  } catch (e) {
    console.error('[server] market data stream failed to start:', e);
  }
});
