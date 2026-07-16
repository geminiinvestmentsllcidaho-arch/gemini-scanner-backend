import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
import { formatCustomerDateTime } from "./customer_time.mjs";

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
    account: options.account ?? null,
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
  <div class="label">${esc(formatCustomerDateTime(entry?.eventAt, page.account, { fallback: "Unknown time" }))}</div>
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
${renderGlobalThemeCss({ surface: "customer" })}
<style>
.wrap{max-width:820px;margin:0 auto;padding:42px 20px 72px}
.customer-nav{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}
.customer-nav a{color:var(--gs-accent);text-decoration:none;border:1px solid var(--gs-line);border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.58);box-shadow:0 0 12px rgba(57,255,32,.15)}
.panel{padding:18px}
.row{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:16px;padding:12px 0;border-bottom:1px solid var(--gs-line)}
.row:last-child{border-bottom:0}
.label{color:var(--gs-muted);font-weight:700}
.value{overflow-wrap:anywhere}
.muted{color:var(--gs-muted)}
@media (max-width:600px){.row{grid-template-columns:1fr;gap:4px}}
</style>
</head>
<body data-gs-page="customer-security-activity">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap" data-role="customer" data-page="security-activity">
<nav class="customer-nav" aria-label="Customer navigation">
<a href="/customer">Home</a>
<a href="/customer/scanner">Scanner</a>
<a href="/customer/portfolio">Portfolio</a>
<a href="/customer/reports">Reports</a>
<a href="/customer/watchlist">Watchlist</a>
<a href="/customer/settings">Settings</a>
</nav>
<section class="card panel">
<h1>${esc(page.title)}</h1>
<p class="muted">Recent security changes for this customer account. This history is read-only.</p>
${rows}
</section>
</main>
${renderGlobalFooter()}
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerSecurityActivityPage,
  renderCustomerSecurityActivityPageHtml,
};
