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
nav a,nav button{border:1px solid #39ff14;background:#000;color:#39ff14;padding:10px 14px;border-radius:8px;text-decoration:none;font:inherit;cursor:pointer}
nav a:hover,nav button:hover,nav a:focus-visible,nav button:focus-visible{background:#39ff14;color:#000;outline:none;box-shadow:0 0 16px rgba(57,255,20,.65)}
.hero,.card,.panel,.section{background:#000;border:1px solid #39ff14;border-radius:14px;padding:22px;box-shadow:0 0 18px rgba(57,255,20,.14)}
.hero{margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
h1,h2,h3,h4,strong,label,.eyebrow{color:#39ff14}
p,li,td,th,small,.muted{color:#39ff14}
table{width:100%;border-collapse:collapse;background:#000;color:#39ff14}
th,td{border:1px solid #39ff14;padding:10px;text-align:left}
input,select,textarea{width:100%;background:#000;color:#39ff14;border:1px solid #39ff14;border-radius:8px;padding:10px;outline:none}
input:focus,select:focus,textarea:focus{box-shadow:0 0 14px rgba(57,255,20,.55)}
button{background:#000;color:#39ff14;border:1px solid #39ff14}
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
<section class="grid">
<div class="card"><h2>Scanners</h2><p>Scanner status and operational review.</p><a href="/admin/scanners">Open</a></div>
<div class="card"><h2>Shared Cache</h2><p>Centralized under-$5 shared cache diagnostics.</p><a href="/admin/shared-cache">Open</a></div>
<div class="card"><h2>System Health</h2><p>Runtime health and readiness.</p><a href="/admin/system-health">Open</a></div>
<div class="card"><h2>Security</h2><p>Protected security and authorization status.</p><a href="/admin/security">Open</a></div>
<div class="card"><h2>Customers</h2><p>Customer and tenant administration shell.</p><a href="/admin/customers">Open</a></div>
<div class="card">
<h2>Alpaca account access</h2>
<p>Status: <strong>${esc(surface.alpacaAccess?.enabled ? "ON" : "OFF")}</strong></p>
<p>ON allows GeminiScanner to resolve encrypted Alpaca credentials for existing read-only account, positions, open-orders, market-clock, and scanner data reads. OFF denies that encrypted credential resolution path.</p>
<p>Broker mutation, order placement, cancellation, replacement, live trading, and PAPER submission remain locked regardless of this switch.</p>
<form method="post" action="/admin/alpaca-access">
<input type="hidden" name="enabled" value="${surface.alpacaAccess?.enabled ? "0" : "1"}">
<button type="submit">${surface.alpacaAccess?.enabled ? "Turn OFF Alpaca read access" : "Turn ON Alpaca read access"}</button>
</form>
</div>
</section>
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
