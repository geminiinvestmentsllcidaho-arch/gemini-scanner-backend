import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
export const VERSION = "customer_scanner_hub_v1";

const MODES = Object.freeze([
  Object.freeze({
    id: "intraday",
    label: "Intraday",
    status: "available",
    href: "/customer/scanner",
    default: true,
  }),
  Object.freeze({
    id: "under_five",
    label: "Under $5",
    status: "available",
    href: "/customer/scanner/under-five",
    default: false,
  }),
  Object.freeze({
    id: "swing",
    label: "Swing",
    status: "coming_soon",
    href: null,
    default: false,
  }),
  Object.freeze({
    id: "long_term",
    label: "Long-term",
    status: "coming_soon",
    href: null,
    default: false,
  }),
  Object.freeze({
    id: "watchlist",
    label: "Watchlist",
    status: "available",
    href: "/customer/watchlist",
    default: false,
  }),
]);

const ASSET_TYPES = Object.freeze([
  Object.freeze({ id: "stocks", label: "Stocks", status: "available", default: true }),
  Object.freeze({ id: "etfs", label: "ETFs", status: "coming_soon", default: false }),
  Object.freeze({ id: "crypto", label: "Crypto", status: "coming_soon", default: false }),
  Object.freeze({ id: "options", label: "Options", status: "coming_soon", default: false }),
]);

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCustomerScannerHub(options = {}) {
  const tenant = String(options.tenant ?? "customer").trim() || "customer";

  return Object.freeze({
    version: VERSION,
    route: "/customer",
    role: "customer",
    tenant,
    title: "GeminiScanner",
    subtitle: "Choose a scanner mode and asset universe.",
    defaultMode: "intraday",
    defaultAssetType: "stocks",
    modes: MODES,
    assetTypes: ASSET_TYPES,
    performanceReport: options.performanceReport ?? null,
    navigation: Object.freeze([
      Object.freeze({ label: "Home", href: "/customer" }),
      Object.freeze({ label: "Scanner", href: "/customer/scanner" }),
      Object.freeze({ label: "Under $5", href: "/customer/scanner/under-five" }),
      Object.freeze({ label: "Watchlist", href: "/customer/watchlist" }),
      Object.freeze({ label: "Settings", href: "/customer/settings" }),
    ]),
    readOnly: true,
    decisionAssistOnly: true,
    noExecutionControls: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export function renderCustomerScannerHubHtml(hub = buildCustomerScannerHub(), account = null) {
  const nav = hub.navigation
    .map((item) => `<a href="${esc(item.href)}">${esc(item.label)}</a>`)
    .join("");

  const modeCards = hub.modes.map((mode) => {
    const state = mode.status === "available" ? "Available" : "Coming soon";
    const body = `<b>${esc(mode.label)}</b><span>${esc(state)}</span>`;
    return mode.href
      ? `<a class="choice available${mode.default ? " selected" : ""}" href="${esc(mode.href)}">${body}</a>`
      : `<div class="choice disabled" aria-disabled="true">${body}</div>`;
  }).join("");

  const assetCards = hub.assetTypes.map((asset) => {
    const state = asset.status === "available" ? "Available" : "Coming soon";
    return `<div class="choice ${asset.status === "available" ? "available selected" : "disabled"}" aria-disabled="${asset.status !== "available"}"><b>${esc(asset.label)}</b><span>${esc(state)}</span></div>`;
  }).join("");

  const performance = hub.performanceReport;
  const performancePeriod = performance?.period ?? "lifetime";
  const performanceLabel = performancePeriod === "ytd" ? "YEAR TO DATE" : performancePeriod.toUpperCase();
  const performancePanel = performance
    ? `<details class="earnings-overlay performance-${esc(performance.tone ?? "neutral")}">
<summary aria-label="Open earnings period selector"><span>${esc(performanceLabel)} EARNINGS</span><strong>$${esc(performance.netAfterCosts ?? performance.totalPl ?? 0)}</strong></summary>
<div class="earnings-menu">
<nav class="performance-periods" aria-label="Performance period">${["daily","weekly","monthly","yearly","ytd","lifetime"].map((period) => `<a class="${performance.period === period ? "active" : ""}" href="/customer?period=${period}">${period === "ytd" ? "YEAR TO DATE" : period.toUpperCase()}</a>`).join("")}</nav>
<p>Realized: $${esc(performance.realizedPl ?? 0)} | Unrealized: $${esc(performance.unrealizedPl ?? 0)} | Combined: $${esc(performance.totalPl ?? 0)} | Net after costs: $${esc(performance.netAfterCosts ?? 0)}</p>
<p>Winners: ${esc(performance.winners ?? 0)} | Losers: ${esc(performance.losers ?? 0)} | Win rate: ${esc(performance.winRatePct ?? 0)}%</p>
<p>Data timestamp: ${esc(performance.sourceTs ?? "Unavailable")} | Status: ${performance.stale === true ? "STALE — READ ONLY" : "Current — read only"}</p>
</div>
</details>`
    : "";

  const accountEmail = esc(account?.email ?? "");
  const accountPanel = accountEmail
    ? `<section class="card account-panel">
<div>
<div class="eyebrow">Signed in account</div>
<strong>${accountEmail}</strong>
</div>
<div class="account-actions">
<a href="/customer/settings">Settings</a>
<form method="post" action="/logout"><button type="submit">Log out</button></form>
</div>
</section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(hub.title)}</title>
${renderGlobalThemeCss({ surface: "customer" })}
<style>
.wrap{max-width:980px;margin:0 auto;padding:42px 20px 72px}
.customer-nav{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}
.customer-nav a{color:var(--gs-accent);text-decoration:none;border:1px solid var(--gs-line);border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.58);box-shadow:0 0 12px rgba(57,255,32,.15)}
.account-panel,.hero,.panel,.safety{padding:18px;margin-bottom:16px}
.account-panel{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.account-panel strong{display:block;margin-top:6px;overflow-wrap:anywhere}
.account-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.account-actions a,.account-actions button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--gs-line);border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.72);color:var(--gs-text);text-decoration:none;font:inherit;font-weight:700;cursor:pointer}
.account-actions form{margin:0}
.account-actions button{border-color:rgba(255,65,84,.68);color:#ffd8dd}
.eyebrow{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--gs-accent)}
h1,h2{margin:.35rem 0}
p{color:var(--gs-muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.choice{display:flex;min-height:92px;flex-direction:column;justify-content:center;gap:8px;padding:15px;border-radius:14px;border:1px solid var(--gs-line);text-decoration:none;color:var(--gs-text);background:rgba(0,0,0,.62)}
.choice span{font-size:.85rem;color:var(--gs-muted)}
.available{border-color:rgba(57,255,32,.68)}
.selected{outline:2px solid var(--gs-accent)}
.disabled{opacity:.5}
.safety{font-size:.9rem}
.earnings-overlay{position:sticky;top:76px;z-index:20;width:min(100%,620px);margin:0 auto 18px;border-radius:14px;backdrop-filter:blur(12px);box-shadow:0 8px 30px rgba(0,0,0,.5);overflow:hidden;color:#000}
.earnings-overlay summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;cursor:pointer;list-style:none;font-weight:800}
.earnings-overlay summary::-webkit-details-marker{display:none}
.earnings-overlay summary span{font-size:.78rem;letter-spacing:.09em;color:#000}
.earnings-overlay summary strong{font-size:1.3rem;color:#000}
.earnings-menu{padding:0 14px 14px;background:rgba(255,255,255,.12)}
.performance-positive{background:rgba(57,255,32,.90);border:2px solid #39ff20}
.performance-negative{background:rgba(255,36,36,.90);border:2px solid #ff2424}
.performance-neutral{background:rgba(149,155,165,.92);border:2px solid #959ba5}
.performance-periods{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}
.performance-periods a{padding:8px 10px;border-radius:999px;background:#132844;color:#dbe8ff;text-decoration:none;font-weight:800}
.performance-periods a.active{background:#5b9cff;color:#08111f}
</style>
</head>
<body data-gs-page="customer-scanner-hub">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap" data-role="customer" data-tenant="${esc(hub.tenant)}">
${performancePanel}
${accountPanel}
<nav class="customer-nav" aria-label="Customer navigation">${nav}</nav>
<section class="card hero">
<div class="eyebrow">Customer account</div>
<h1>${esc(hub.title)}</h1>
<p>${esc(hub.subtitle)}</p>
</section>
<section class="card panel">
<h2>Scanner mode</h2>
<div class="grid">${modeCards}</div>
</section>
<section class="card panel">
<h2>Asset type</h2>
<div class="grid">${assetCards}</div>
</section>
<section class="card safety"><b>Safety:</b> Decision assist only. No order placement or account mutation controls.</section>
</main>
${renderGlobalFooter()}
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
};
