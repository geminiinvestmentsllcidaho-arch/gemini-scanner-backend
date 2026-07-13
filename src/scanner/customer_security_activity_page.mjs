export const VERSION = "customer_security_activity_page_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCustomerSecurityActivityPage(options = {}) {
  const activity = Array.isArray(options.activity) ? options.activity : [];

  return Object.freeze({
    version: VERSION,
    route: "/customer/security-activity",
    title: "Security activity",
    activity: Object.freeze(activity),
    readOnly: true,
    customerOnly: true,
  });
}

export function renderCustomerSecurityActivityPageHtml(
  page = buildCustomerSecurityActivityPage(),
) {
  const rows = page.activity.length
    ? page.activity.map((entry) => `
<div class="row">
  <div class="label">${esc(entry?.eventAt || "Unknown time")}</div>
  <div class="value">
    <strong>${esc(entry?.eventLabel || "Security activity")}</strong><br>
    ${esc(entry?.outcome || "unknown")} | ${esc(entry?.ip || "unknown")} | ${esc(entry?.userAgent || "unknown")}
  </div>
</div>`).join("")
    : '<p class="muted">No security activity is available yet.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner — ${esc(page.title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#08111f;color:#e8eef8;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:20px}
nav{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}
nav a{color:#dbe8ff;text-decoration:none;border:1px solid #304766;border-radius:10px;padding:9px 12px;background:#101c2f}
.panel{background:#101c2f;border:1px solid #263a58;border-radius:16px;padding:18px}
.row{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:16px;padding:12px 0;border-bottom:1px solid #263a58}
.row:last-child{border-bottom:0}
.label{color:#9eb0c9;font-weight:700}
.value{overflow-wrap:anywhere}
.muted{color:#9eb0c9}
@media (max-width:600px){.row{grid-template-columns:1fr;gap:4px}}
</style>
</head>
<body>
<main class="wrap" data-role="customer" data-page="security-activity">
<nav aria-label="Customer navigation">
<a href="/customer">Home</a>
<a href="/customer/scanner">Scanner</a>
<a href="/customer/watchlist">Watchlist</a>
<a href="/customer/settings">Settings</a>
</nav>
<section class="panel">
<h1>${esc(page.title)}</h1>
<p class="muted">Recent security changes for this customer account. This history is read-only.</p>
${rows}
</section>
</main>
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerSecurityActivityPage,
  renderCustomerSecurityActivityPageHtml,
};
