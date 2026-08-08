export const VERSION = "admin_surface_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildAdminSurface(options = {}) {
  const alpacaAccess = options.alpacaAccess ?? {
    enabled: false,
    accessMode: "ALPACA_ACCOUNT_ACCESS_OFF",
    readAccessAllowed: false,
    credentialResolutionAllowed: false,
    brokerMutationAllowed: false,
    orderPlacementAllowed: false,
    orderCancellationAllowed: false,
    liveTradingAllowed: false,
    paperTradingSubmissionAllowed: false,
    reason: "unavailable",
    updatedBy: "system",
    updatedAt: null,
  };
  return Object.freeze({
    version: VERSION,
    route: "/admin",
    role: "admin",
    title: "GeminiScanner Admin",
    subtitle: "Protected operations, diagnostics, security, and customer management.",
    navigation: Object.freeze([
      Object.freeze({ label: "Overview", href: "/admin" }),
      Object.freeze({ label: "Scanners", href: "/admin/scanners" }),
      Object.freeze({ label: "Shared Cache", href: "/admin/shared-cache" }),
      Object.freeze({ label: "System Health", href: "/admin/system-health" }),
      Object.freeze({ label: "Security", href: "/admin/security" }),
      Object.freeze({ label: "Customers", href: "/admin/customers" }),
    ]),
    readOnly: true,
    decisionAssistOnly: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    alpacaAccess: Object.freeze({ ...alpacaAccess }),
  });
}

export function renderAdminSurfaceHtml(surface = buildAdminSurface()) {
  const nav = surface.navigation
    .map((item) => `<a href="${esc(item.href)}">${esc(item.label)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(surface.title)}</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;background:#000;color:#39ff14;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{min-height:100vh;background:#000}
a{color:#39ff14}
.wrap{max-width:1180px;margin:0 auto;padding:24px}
nav{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px;border:1px solid #39ff14;padding:12px;background:#000;box-shadow:0 0 18px rgba(57,255,20,.16)}
nav a{border:1px solid #39ff14;background:#000;color:#39ff14;padding:10px 14px;border-radius:8px;text-decoration:none;font:inherit;cursor:pointer}
nav a:hover,nav a:focus-visible{background:#39ff14;color:#000;outline:none;box-shadow:0 0 16px rgba(57,255,20,.65)}
nav button{border:1px solid #00ffff;background:#000;color:#00ffff;padding:10px 14px;border-radius:8px;font:inherit;cursor:pointer}
nav button:hover,nav button:focus-visible{background:#00ffff;color:#000;outline:none;box-shadow:0 0 16px rgba(0,255,255,.65)}
.hero,.card,.panel,.section{background:#000;border:1px solid #39ff14;border-radius:14px;padding:22px;box-shadow:0 0 18px rgba(57,255,20,.14)}
.hero{margin-bottom:18px}
.ops-group{border:1px solid #39ff14;border-radius:14px;padding:18px;margin-bottom:18px;box-shadow:0 0 18px rgba(57,255,20,.12)}
.ops-group>h2{margin-top:0;color:#00ffff}
.card h3{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
h1,h2,h3,h4,strong,label,.eyebrow{color:#39ff14}
p,li,td,th,small,.muted{color:#39ff14}
table{width:100%;border-collapse:collapse;background:#000;color:#39ff14}
th,td{border:1px solid #39ff14;padding:10px;text-align:left}
input,select,textarea{width:100%;background:#000;color:#39ff14;border:1px solid #39ff14;border-radius:8px;padding:10px;outline:none}
input:focus,select:focus,textarea:focus{box-shadow:0 0 14px rgba(57,255,20,.55)}
button{background:#000;color:#00ffff;border:1px solid #00ffff;cursor:pointer} button:hover,button:focus-visible{background:#00ffff;color:#000;outline:none;box-shadow:0 0 16px rgba(0,255,255,.65)}
hr{border:0;border-top:1px solid #39ff14}
.status,.badge,.pill{background:#000!important;color:#39ff14!important;border:1px solid #39ff14!important}
</style>
</head>
<body>
<main class="wrap" data-role="admin">
<nav aria-label="Admin navigation">${nav}<form method="post" action="/admin/logout" style="margin-left:auto"><button type="submit">Log out</button></form></nav>
<section class="hero">
<div class="eyebrow">Protected admin operations</div>
<h1>${esc(surface.title)}</h1>
<p>${esc(surface.subtitle)}</p>
</section>
<section class="ops-group"><h2>System &amp; Infrastructure Health</h2><div class="grid">
<div class="card"><h3>Server Status Panel</h3><p>CPU usage, memory, disk space, and network traffic.</p><p><strong>Status:</strong> Local telemetry wiring pending.</p><a href="/admin/system-health">Open system health</a></div>
<div class="card"><h3>Uptime &amp; Latency Monitor</h3><p>Server uptime, API response times, and connection latency in milliseconds.</p><p><strong>Status:</strong> Local latency wiring pending.</p></div>
<div class="card"><h3>Error Log Stream</h3><p>Recent server errors, database failures, watchdog incidents, and unhandled exceptions.</p><p><strong>Status:</strong> Local error-stream wiring pending.</p></div>
</div></section>
<section class="ops-group"><h2>Trading Engine &amp; Execution</h2><div class="grid">
<div class="card"><h3>Active Orders &amp; Queue</h3><p>Pending, executing, partially filled, and filled PAPER order evidence.</p><p><strong>Status:</strong> Stored read-only order evidence only until live broker read is explicitly enabled.</p></div>
<div class="card"><h3>Brokerage API Status</h3><p>Alpaca PAPER read connection health, market-data status, and rate-limit visibility.</p><p><strong>Status:</strong> No broker request is made by this admin page.</p></div>
<div class="card"><h3>Execution Latency Panel</h3><p>Signal-to-submit and submit-to-fill timing from stored timestamps.</p><p><strong>Status:</strong> Unavailable when timestamps are not present.</p></div>
</div></section>
<section class="ops-group"><h2>Financial &amp; Risk Management</h2><div class="grid">
<div class="card"><h3>Portfolio &amp; Liquidity Dashboard</h3><p>Cash, buying power, equity, open positions, market value, and margin usage.</p><p><strong>Status:</strong> Read-only PAPER account evidence only.</p></div>
<div class="card"><h3>Kill Switch Control</h3><p>Emergency PAPER automation halt status and future admin control surface.</p><p><strong>Status:</strong> Status-only here. No broker liquidation, submit, cancel, or account mutation.</p></div>
<div class="card"><h3>P&amp;L Tracker</h3><p>Realized, unrealized, per-position, and platform-level PAPER P&amp;L.</p><p><strong>Status:</strong> Read-only stored/account evidence only.</p></div>
</div></section>
<section class="ops-group"><h2>Security &amp; User Activity</h2><div class="grid">
<div class="card"><h3>Security &amp; Failed Logins</h3><p>Failed sign-ins, blocked attempts, suspicious activity, and security audit events.</p><p><strong>Status:</strong> Security audit wiring pending.</p><a href="/admin/security">Open security</a></div>
<div class="card"><h3>Active User Sessions</h3><p>Current and recent customer/admin sessions.</p><p><strong>Status:</strong> Exact concurrent-session counting not yet instrumented.</p></div>
<div class="card"><h3>Database &amp; Queue Backups</h3><p>Backup, snapshot, audit-ledger, and transaction-log protection status.</p><p><strong>Status:</strong> Automatic backup scheduler verification pending.</p></div>
</div></section>
<section class="ops-group"><h2>Administration</h2><div class="grid">
<div class="card"><h3>Scanners</h3><p>Scanner status and operational review.</p><a href="/admin/scanners">Open</a></div>
<div class="card"><h3>Shared Cache</h3><p>Centralized under-$5 shared cache diagnostics.</p><a href="/admin/shared-cache">Open</a></div>
<div class="card"><h3>Customers</h3><p>Customer and tenant administration shell.</p><a href="/admin/customers">Open</a></div>
<div class="card"><h3>Alpaca account access</h3>
<p>Status: <strong>${esc(surface.alpacaAccess?.enabled ? "ON" : "OFF")}</strong></p>
<p>ON allows GeminiScanner to resolve encrypted Alpaca credentials for existing read-only account, positions, open-orders, market-clock, and scanner data reads. OFF denies that encrypted credential resolution path.</p>
<p>Broker mutation, order placement, cancellation, replacement, live trading, and PAPER submission remain locked regardless of this switch.</p>
<form method="post" action="/admin/alpaca-access"><input type="hidden" name="enabled" value="${surface.alpacaAccess?.enabled ? "0" : "1"}"><button type="submit">${surface.alpacaAccess?.enabled ? "Turn OFF Alpaca read access" : "Turn ON Alpaca read access"}</button></form>
</div>
</div></section>
<p>Decision assist only. No automatic execution or account mutation.</p>
</main>
</body>
</html>`;
}

export default {
  VERSION,
  buildAdminSurface,
  renderAdminSurfaceHtml,
};
