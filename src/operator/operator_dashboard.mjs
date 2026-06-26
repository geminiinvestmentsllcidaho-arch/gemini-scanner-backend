import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const OPERATOR_DASHBOARD_VERSION = 'stage3-operator-dashboard-v2';
export const DEFAULT_OPERATOR_TOKEN_FILE = '/home/gemini/.gemini-scanner-operator-token';
export const OPERATOR_DASHBOARD_REFRESH_SEC = 30;

export const OPERATOR_PANELS = Object.freeze([
  { id: 'operator', title: 'Operator Status', route: '/operator/status', group: 'core', description: 'Read-only operator mode, execution lock, and protected route metadata.' },
  { id: 'health', title: 'Health', route: '/health', group: 'runtime', description: 'Runtime health, stream state, degraded issues, and process status.' },
  { id: 'readiness', title: 'Readiness', route: '/readiness', group: 'runtime', description: 'Readiness gate for live diagnostics and uptime checks.' },
  { id: 'diagnostics', title: 'Diagnostics', route: '/diagnostics', group: 'runtime', description: 'Diagnostic snapshot for data feed, cache, telemetry, and service internals.' },
  { id: 'stage2', title: 'Stage 2 App', route: '/scanner/stage2-app', group: 'scanner', description: 'Stage 2 LCM app shell status and decision-assist configuration.' },
  { id: 'rankings', title: 'Rankings', route: '/scanner/rankings', group: 'scanner', description: 'Scanner rankings, confidence, stale state, safety gates, and symbol outputs.' },
  { id: 'marketdata', title: 'Market Data', route: '/marketdata', group: 'scanner', description: 'Current cached market data snapshot exposed by the backend.' },
  { id: 'runlog', title: 'Run Log', route: '/runlog', group: 'audit', description: 'Recent decision-assist run records for review and replay.' }
]);

const WEAK_TOKENS = new Set([
  '',
  'password',
  'operator',
  'changeme',
  'secret',
  'token',
  'admin',
  'gemini',
  'geminiscanner',
  'stage3'
]);

function cleanToken(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function readOperatorTokenFile(tokenFilePath = DEFAULT_OPERATOR_TOKEN_FILE) {
  try {
    return cleanToken(readFileSync(tokenFilePath, 'utf8'));
  } catch {
    return '';
  }
}

export function resolveOperatorDashboardToken(options = {}) {
  return (
    cleanToken(options.token) ||
    cleanToken(process.env.GEMINI_OPERATOR_DASHBOARD_TOKEN) ||
    cleanToken(process.env.OPERATOR_DASHBOARD_TOKEN) ||
    readOperatorTokenFile(options.tokenFilePath || process.env.GEMINI_OPERATOR_DASHBOARD_TOKEN_FILE || DEFAULT_OPERATOR_TOKEN_FILE)
  );
}

export function isStrongOperatorToken(token) {
  const value = cleanToken(token);
  if (value.length < 16) return false;
  if (WEAK_TOKENS.has(value.toLowerCase())) return false;
  if (/^\d+$/.test(value)) return false;
  if (/^\s|\s$/.test(value)) return false;
  return true;
}

export function isOperatorDashboardEnabled(options = {}) {
  return isStrongOperatorToken(resolveOperatorDashboardToken(options));
}

function safeTimingEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractOperatorAuthToken(req = {}) {
  const headers = req.headers || {};
  const directToken = cleanToken(headers['x-operator-token'] || headers['X-Operator-Token']);
  if (directToken) return directToken;

  const authorization = cleanToken(headers.authorization || headers.Authorization);
  if (!authorization) return '';

  const firstSpace = authorization.indexOf(' ');
  if (firstSpace <= 0) return '';

  const scheme = authorization.slice(0, firstSpace).toLowerCase();
  const credentials = authorization.slice(firstSpace + 1).trim();

  if (scheme === 'bearer') return cleanToken(credentials);

  if (scheme === 'basic') {
    try {
      const decoded = Buffer.from(credentials, 'base64').toString('utf8');
      const colon = decoded.indexOf(':');
      return colon >= 0 ? cleanToken(decoded.slice(colon + 1)) : '';
    } catch {
      return '';
    }
  }

  return '';
}

export function createRequireOperatorDashboardAuth(options = {}) {
  return function requireOperatorDashboardAuth(req, res, next) {
    const configuredToken = resolveOperatorDashboardToken(options);

    if (!isStrongOperatorToken(configuredToken)) {
      return res.status(503).json({
        ok: false,
        error: 'operator_dashboard_disabled',
        reason: 'strong_operator_token_required'
      });
    }

    const providedToken = extractOperatorAuthToken(req);

    if (providedToken && safeTimingEqual(providedToken, configuredToken)) {
      return next();
    }

    if (typeof res.setHeader === 'function') {
      res.setHeader('WWW-Authenticate', 'Basic realm="GeminiScanner Operator"');
    }

    return res.status(401).json({
      ok: false,
      error: 'operator_auth_required'
    });
  };
}

export const requireOperatorDashboardAuth = createRequireOperatorDashboardAuth();

export function buildOperatorDashboardPayload({ now = new Date(), panels = OPERATOR_PANELS } = {}) {
  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  return {
    ok: true,
    version: OPERATOR_DASHBOARD_VERSION,
    route: '/operator',
    statusRoute: '/operator/status',
    mode: 'read_only',
    execution: 'disabled',
    safetyState: 'decision_assist_only',
    brokerExecution: false,
    orderPlacement: false,
    protectedBy: 'GEMINI_OPERATOR_DASHBOARD_TOKEN',
    refreshSec: OPERATOR_DASHBOARD_REFRESH_SEC,
    generatedAt,
    summary: {
      panelCount: panels.length,
      readOnly: true,
      decisionAssistOnly: true,
      executionDisabled: true
    },
    panels: panels.map((panel) => ({
      id: panel.id,
      title: panel.title,
      route: panel.route,
      group: panel.group,
      description: panel.description,
      method: 'GET',
      readOnly: true
    })),
    warnings: [
      'Operator dashboard is read-only.',
      'No broker execution.',
      'No order placement.',
      'Decision-assist only.'
    ]
  };
}

export const buildOperatorStatusPayload = buildOperatorDashboardPayload;
export const buildOperatorDashboardStatusPayload = buildOperatorDashboardPayload;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildOperatorDashboardHtml(payload = buildOperatorDashboardPayload()) {
  const safePayload = JSON.stringify(payload).replaceAll('<', '\\u003c');

  const panelCards = payload.panels.map((panel) => `
        <article class="card panel-card" id="card-${escapeHtml(panel.id)}">
          <div class="card-head">
            <div>
              <p class="eyebrow">${escapeHtml(panel.group)}</p>
              <h2>${escapeHtml(panel.title)}</h2>
            </div>
            <span class="route">${escapeHtml(panel.route)}</span>
          </div>
          <p class="desc">${escapeHtml(panel.description)}</p>
          <pre id="${escapeHtml(panel.id)}">Loading...</pre>
        </article>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GeminiScanner Operator</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070b12;
      --panel: #0f1724;
      --panel2: #121d2e;
      --line: #263449;
      --text: #eef4ff;
      --muted: #9fb0c9;
      --good: #36d399;
      --warn: #fbbf24;
      --bad: #fb7185;
      --accent: #7dd3fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top, #172033 0, var(--bg) 45%);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main { width: min(1440px, 94vw); margin: 0 auto; padding: 28px 0 42px; }
    header {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(125,211,252,.16), rgba(15,23,36,.92));
      padding: 26px;
      box-shadow: 0 24px 80px rgba(0,0,0,.35);
    }
    h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 52px); letter-spacing: -.04em; }
    h2 { margin: 0; font-size: 18px; }
    .lead { max-width: 980px; color: var(--muted); line-height: 1.55; margin: 0; }
    .bar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; align-items: center; }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 9px 13px;
      background: rgba(15,23,36,.72);
      color: var(--muted);
      font-size: 13px;
    }
    .pill.good { color: var(--good); border-color: rgba(54,211,153,.38); }
    .pill.warn { color: var(--warn); border-color: rgba(251,191,36,.38); }
    .pill.bad { color: var(--bad); border-color: rgba(251,113,133,.38); }
    button {
      border: 1px solid rgba(125,211,252,.42);
      background: rgba(125,211,252,.12);
      color: var(--text);
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
      font-weight: 700;
    }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .metric {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      background: rgba(15,23,36,.75);
    }
    .metric span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .metric strong { display: block; margin-top: 8px; font-size: 20px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(18,29,46,.95), rgba(10,16,26,.95));
      padding: 16px;
      min-height: 260px;
      overflow: hidden;
    }
    .card.ok { border-color: rgba(54,211,153,.35); }
    .card.error { border-color: rgba(251,113,133,.5); }
    .card-head { display: flex; justify-content: space-between; gap: 14px; align-items: start; }
    .eyebrow { margin: 0 0 5px; color: var(--accent); font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .route { color: var(--muted); font-size: 12px; white-space: nowrap; }
    .desc { color: var(--muted); line-height: 1.45; font-size: 13px; min-height: 38px; }
    pre {
      margin: 12px 0 0;
      padding: 14px;
      border-radius: 14px;
      background: rgba(2,6,12,.7);
      border: 1px solid rgba(38,52,73,.72);
      overflow: auto;
      max-height: 420px;
      color: #dbeafe;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .footer { color: var(--muted); margin: 18px 2px 0; font-size: 13px; }
    @media (max-width: 900px) {
      main { width: min(100% - 24px, 760px); padding-top: 14px; }
      header { padding: 18px; border-radius: 18px; }
      .metrics, .grid { grid-template-columns: 1fr; }
      .route { white-space: normal; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>GeminiScanner Operator</h1>
      <p class="lead">Live protected operator dashboard for Stage 2 app, LCM, health, readiness, diagnostics, rankings, market data, run logs, and safety state. This surface is read-only: no broker execution and no order placement.</p>
      <div class="bar">
        <span class="pill good">Mode: ${escapeHtml(payload.mode)}</span>
        <span class="pill good">Execution: ${escapeHtml(payload.execution)}</span>
        <span class="pill good">Safety: ${escapeHtml(payload.safetyState)}</span>
        <span class="pill" id="last-refresh">Waiting for first refresh...</span>
        <button id="refresh-now" type="button">Refresh now</button>
      </div>
    </header>

    <section class="metrics">
      <div class="metric"><span>Protected Route</span><strong>${escapeHtml(payload.route)}</strong></div>
      <div class="metric"><span>Status Route</span><strong>${escapeHtml(payload.statusRoute)}</strong></div>
      <div class="metric"><span>Panels</span><strong>${escapeHtml(payload.summary.panelCount)}</strong></div>
      <div class="metric"><span>Refresh</span><strong>${escapeHtml(payload.refreshSec)}s</strong></div>
    </section>

    <section class="grid">
${panelCards}
    </section>

    <p class="footer">Read-only operator shell. Decision-assist only. Version: ${escapeHtml(payload.version)}.</p>
  </main>

  <script>
    const boot = ${safePayload};
    const panels = boot.panels || [];
    const refreshMs = Math.max(10, Number(boot.refreshSec || 30)) * 1000;

    function text(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      return JSON.stringify(value, null, 2);
    }

    function summarize(data) {
      if (!data || typeof data !== 'object') return text(data);

      const preferred = [
        'ok',
        'status',
        'degraded',
        'mode',
        'execution',
        'safetyState',
        'scannerHealth',
        'rankingQuality',
        'rankingConfidence',
        'governanceState',
        'portfolioPermission',
        'capitalPreservationState',
        'resilienceState',
        'telemetryCoverage'
      ];

      const lines = [];
      for (const key of preferred) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          lines.push(key + ': ' + text(data[key]));
        }
      }

      if (Array.isArray(data.issues) && data.issues.length) lines.push('issues: ' + data.issues.join(', '));
      if (Array.isArray(data.warnings) && data.warnings.length) lines.push('warnings: ' + data.warnings.join(', '));
      if (Array.isArray(data.rankings)) lines.push('rankings: ' + data.rankings.length);

      const compact = lines.length ? lines.join('\\n') + '\\n\\n' : '';
      return compact + JSON.stringify(data, null, 2);
    }

    async function loadPanel(panel) {
      const target = document.getElementById(panel.id);
      const card = document.getElementById('card-' + panel.id);
      if (!target) return false;

      try {
        const res = await fetch(panel.route, { cache: 'no-store', credentials: 'same-origin' });
        const raw = await res.text();

        let body = raw;
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }

        target.textContent = 'HTTP ' + res.status + ' ' + res.statusText + '\\n\\n' + summarize(body);
        if (card) {
          card.classList.toggle('ok', res.ok);
          card.classList.toggle('error', !res.ok);
        }
        return res.ok;
      } catch (error) {
        target.textContent = 'ERROR: ' + error.message;
        if (card) {
          card.classList.remove('ok');
          card.classList.add('error');
        }
        return false;
      }
    }

    async function refresh() {
      const results = await Promise.all(panels.map(loadPanel));
      const okCount = results.filter(Boolean).length;
      const status = document.getElementById('last-refresh');
      if (status) {
        status.textContent = 'Last refresh: ' + new Date().toLocaleString() + ' | OK panels: ' + okCount + '/' + panels.length;
        status.className = 'pill ' + (okCount === panels.length ? 'good' : okCount > 0 ? 'warn' : 'bad');
      }
    }

    document.getElementById('refresh-now')?.addEventListener('click', refresh);
    refresh();
    setInterval(refresh, refreshMs);
  </script>
</body>
</html>`;
}

export function registerOperatorDashboardRoutes(app, options = {}) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('registerOperatorDashboardRoutes requires an Express-like app with app.get');
  }

  if (!app.locals) app.locals = {};
  const routes = ['/operator', '/operator/status'];

  if (app.locals.__geminiScannerOperatorDashboardRegistered) {
    return { ok: true, registered: false, routes };
  }

  const auth = createRequireOperatorDashboardAuth(options);

  app.get('/operator', auth, (_req, res) => {
    const payload = buildOperatorDashboardPayload();
    if (typeof res.type === 'function') res.type('html');
    return res.send(buildOperatorDashboardHtml(payload));
  });

  app.get('/operator/status', auth, (_req, res) => {
    return res.json(buildOperatorDashboardPayload());
  });

  app.locals.__geminiScannerOperatorDashboardRegistered = true;
  return { ok: true, registered: true, routes };
}

export const registerOperatorDashboard = registerOperatorDashboardRoutes;

export default {
  OPERATOR_DASHBOARD_VERSION,
  OPERATOR_PANELS,
  buildOperatorDashboardHtml,
  buildOperatorDashboardPayload,
  buildOperatorDashboardStatusPayload,
  buildOperatorStatusPayload,
  createRequireOperatorDashboardAuth,
  extractOperatorAuthToken,
  isOperatorDashboardEnabled,
  isStrongOperatorToken,
  readOperatorTokenFile,
  registerOperatorDashboard,
  registerOperatorDashboardRoutes,
  resolveOperatorDashboardToken
};
