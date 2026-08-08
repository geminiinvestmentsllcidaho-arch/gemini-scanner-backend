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
*{box-sizing:border-box}
body{margin:0;background:#070b12;color:#eef4ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.wrap{max-width:1050px;margin:auto;padding:24px 18px 46px}
nav{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
nav a{color:#dbe8ff;text-decoration:none;border:1px solid #304766;border-radius:10px;padding:10px 13px;background:#101c2f}\nbutton{cursor:pointer;border:1px solid #4b6f9f;border-radius:10px;padding:10px 13px;background:#173052;color:#eef4ff;font-weight:800}
.hero,.card{background:#101c2f;border:1px solid #263a58;border-radius:16px;padding:20px;margin-bottom:16px}
.eyebrow{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:#8eb4ff}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}
.card a{color:#9ee4ff}
p{color:#b8c7dc;line-height:1.6}
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
