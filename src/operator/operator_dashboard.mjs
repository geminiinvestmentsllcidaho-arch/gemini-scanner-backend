import { timingSafeEqual } from 'node:crypto';

export const OPERATOR_DASHBOARD_VERSION = 'stage3-operator-dashboard-v1';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getHeader(req, name) {
  const headers = req?.headers || {};
  return cleanString(headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || (typeof req?.get === 'function' ? req.get(name) : ''));
}

function decodeBasicToken(value) {
  const encoded = cleanString(value).replace(/^Basic\s+/i, '');
  if (!encoded) return '';
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const splitAt = decoded.indexOf(':');
    return splitAt >= 0 ? decoded.slice(splitAt + 1) : decoded;
  } catch {
    return '';
  }
}

export function getOperatorDashboardConfig(env = process.env) {
  const token = cleanString(env.GEMINI_OPERATOR_TOKEN || env.OPERATOR_DASHBOARD_TOKEN);
  return {
    enabled: token.length >= 24,
    token,
    minTokenLength: 24,
    authSchemes: ['Basic password', 'Bearer token']
  };
}

export function timingSafeCompare(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''));
  const right = Buffer.from(String(rightValue || ''));

  if (!left.length || !right.length) return false;

  if (left.length !== right.length) {
    const size = Math.max(left.length, right.length);
    const leftPadded = Buffer.alloc(size);
    const rightPadded = Buffer.alloc(size);
    left.copy(leftPadded);
    right.copy(rightPadded);
    timingSafeEqual(leftPadded, rightPadded);
    return false;
  }

  return timingSafeEqual(left, right);
}

export function readOperatorAuthToken(req = {}) {
  const header = getHeader(req, 'authorization');

  if (/^Bearer\s+/i.test(header)) {
    return cleanString(header.replace(/^Bearer\s+/i, ''));
  }

  if (/^Basic\s+/i.test(header)) {
    return decodeBasicToken(header);
  }

  return '';
}

export function isOperatorAuthorized(req = {}, env = process.env) {
  const config = getOperatorDashboardConfig(env);
  if (!config.enabled) return false;
  return timingSafeCompare(readOperatorAuthToken(req), config.token);
}

function wantsHtml(req = {}) {
  return getHeader(req, 'accept').includes('text/html');
}

function renderAuthRequiredHtml() {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>GeminiScanner Operator Auth</title><style>body{margin:0;background:#07111f;color:#e8f1ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:grid;place-items:center;min-height:100vh}.card{max-width:560px;padding:32px;border:1px solid rgba(126,231,255,.25);border-radius:24px;background:linear-gradient(145deg,rgba(17,34,60,.92),rgba(8,18,34,.96));box-shadow:0 30px 100px rgba(0,0,0,.45)}.pill{display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(126,231,255,.12);color:#7ee7ff;font-weight:700;font-size:12px;letter-spacing:.12em;text-transform:uppercase}h1{font-size:32px;margin:18px 0 10px}p{line-height:1.65;color:#b9c7d9}code{color:#7ee7ff}</style></head><body><main class="card"><span class="pill">Private Route</span><h1>Operator authentication required</h1><p>Use username <code>operator</code> and the server token password saved at <code>~/.gemini-scanner-operator-token</code>.</p><p>This dashboard is read-only. It does not place trades or connect to broker execution.</p></main></body></html>';
}

export function buildOperatorDashboardPayload(now = new Date()) {
  return {
    ok: true,
    version: OPERATOR_DASHBOARD_VERSION,
    route: '/operator',
    statusRoute: '/operator/status',
    mode: 'read_only',
    execution: 'disabled',
    safetyState: 'decision_assist_only',
    protectedBy: ['GEMINI_OPERATOR_TOKEN', 'OPERATOR_DASHBOARD_TOKEN'],
    panels: [
      { name: 'Health', route: '/health' },
      { name: 'Rankings', route: '/scanner/rankings' },
      { name: 'Stage 2 App', route: '/scanner/stage2-app' },
      { name: 'Coach', route: '/coach' },
      { name: 'Ops Run', route: '/ops/run' }
    ],
    generatedAt: now.toISOString()
  };
}

function renderOperatorDashboardHtml() {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>GeminiScanner Operator Dashboard</title><style>:root{color-scheme:dark;--bg:#06101e;--panel:#0d1b2f;--panel2:#101f36;--line:rgba(126,231,255,.2);--text:#ecf5ff;--muted:#aab8ca;--accent:#7ee7ff;--good:#76ffb2}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,rgba(126,231,255,.14),transparent 32rem),linear-gradient(180deg,#06101e,#030812);color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}main{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:32px 0 56px}.hero{display:grid;gap:18px;padding:30px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(145deg,rgba(16,31,54,.92),rgba(7,17,31,.96));box-shadow:0 30px 100px rgba(0,0,0,.38)}.top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}.brand{display:flex;gap:12px;align-items:center;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.logo{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--accent),#8f7cff);box-shadow:0 0 40px rgba(126,231,255,.35)}.pill{display:inline-flex;gap:8px;align-items:center;padding:8px 12px;border-radius:999px;background:rgba(126,231,255,.1);border:1px solid var(--line);color:var(--accent);font-weight:800;font-size:12px;letter-spacing:.1em;text-transform:uppercase}h1{font-size:clamp(34px,5vw,62px);line-height:.98;margin:10px 0}.lead{max-width:760px;color:var(--muted);font-size:18px;line-height:1.65;margin:0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}.card{min-height:240px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,rgba(16,31,54,.86),rgba(8,18,33,.92));overflow:hidden}.card h2{font-size:15px;margin:0;padding:16px 18px;border-bottom:1px solid var(--line);color:var(--accent);letter-spacing:.08em;text-transform:uppercase}pre{margin:0;padding:18px;white-space:pre-wrap;word-break:break-word;color:#dbeaff;font-size:13px;line-height:1.5}.status{color:var(--good)}.footer{margin-top:18px;color:var(--muted);font-size:13px}@media(max-width:820px){.grid{grid-template-columns:1fr}main{width:min(100% - 20px,1180px);padding-top:16px}.hero{padding:22px}}</style></head><body><main><section class="hero"><div class="top"><div class="brand"><span class="logo"></span><span>GeminiScanner Operator</span></div><span class="pill">🔐 Authenticated · Read Only</span></div><h1>Private scanner control room.</h1><p class="lead">Live operational snapshot for Stage 2 app, LCM, health, rankings, and safety state. No broker execution. No order placement. Decision-assist only.</p><div class="pill status" id="status">Loading live snapshot...</div></section><section class="grid"><article class="card"><h2>Operator Status</h2><pre id="operator">Loading...</pre></article><article class="card"><h2>Health</h2><pre id="health">Loading...</pre></article><article class="card"><h2>Stage 2 App</h2><pre id="stage2">Loading...</pre></article><article class="card"><h2>Rankings</h2><pre id="rankings">Loading...</pre></article></section><p class="footer">Refresh cadence: 30 seconds. This route is intentionally read-only.</p></main><script>const panels=[{id:"operator",url:"/operator/status"},{id:"health",url:"/health"},{id:"stage2",url:"/scanner/stage2-app"},{id:"rankings",url:"/scanner/rankings"}];function setStatus(text){document.getElementById("status").textContent=text;}async function loadPanel(panel){const node=document.getElementById(panel.id);try{const res=await fetch(panel.url,{cache:"no-store"});const text=await res.text();let formatted=text;try{formatted=JSON.stringify(JSON.parse(text),null,2);}catch(err){}node.textContent="["+res.status+"] "+formatted;}catch(err){node.textContent="ERROR: "+err.message;}}async function refresh(){await Promise.all(panels.map(loadPanel));setStatus("Live read-only snapshot loaded · "+new Date().toLocaleTimeString());}refresh();setInterval(refresh,30000);</script></body></html>';
}

export function requireOperatorDashboardAuth(req, res, next) {
  const config = getOperatorDashboardConfig(process.env);

  if (!config.enabled) {
    return res.status(503).json({
      ok: false,
      error: 'operator_dashboard_disabled',
      message: 'Set GEMINI_OPERATOR_TOKEN or OPERATOR_DASHBOARD_TOKEN with at least 24 characters.'
    });
  }

  if (isOperatorAuthorized(req, process.env)) return next();

  res.set('WWW-Authenticate', 'Basic realm="GeminiScanner Operator", charset="UTF-8"');

  if (wantsHtml(req)) {
    return res.status(401).type('html').send(renderAuthRequiredHtml());
  }

  return res.status(401).json({ ok: false, error: 'operator_auth_required' });
}

export function registerOperatorDashboardRoutes(app) {
  if (!app || typeof app.get !== 'function') {
    throw new TypeError('registerOperatorDashboardRoutes requires an Express app.');
  }

  if (app.__geminiOperatorDashboardRoutesRegistered) return app;

  app.__geminiOperatorDashboardRoutesRegistered = true;

  app.get('/operator', requireOperatorDashboardAuth, (req, res) => {
    res.type('html').send(renderOperatorDashboardHtml());
  });

  app.get('/operator/status', requireOperatorDashboardAuth, (req, res) => {
    res.json(buildOperatorDashboardPayload());
  });

  return app;
}
