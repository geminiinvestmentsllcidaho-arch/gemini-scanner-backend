import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
import { formatCustomerDateTime } from "./customer_time.mjs";
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

const PRICE_RANGES = Object.freeze([
  Object.freeze({ id: "5", label: "$0–$5", status: "available", default: true }),
  Object.freeze({ id: "10", label: "$0–$10", status: "available", default: false }),
  Object.freeze({ id: "50", label: "$0–$50", status: "available", default: false }),
  Object.freeze({ id: "100", label: "$0–$100", status: "available", default: false }),
  Object.freeze({ id: "1000", label: "$0–$1,000", status: "available", default: false }),
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
    priceRanges: PRICE_RANGES,
    performanceReport: options.performanceReport ?? null,
    scannerFilters: options.scannerFilters ?? null,
    filtersSaved: options.filtersSaved === true,
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

  const availableModes = hub.modes.filter((mode) => mode.status === "available");
  const availableAssets = hub.assetTypes.filter((asset) => asset.status === "available");
  const availablePriceRanges = hub.priceRanges.filter((range) => range.status === "available");
  const scannerStates = ["EXIT","BLOCKED","DO_NOT_ENTER","ENTER","WAIT","WATCH","STALE_DATA","NO_SETUP"];
  const selectedScannerStates = Array.isArray(hub.scannerFilters?.states) ? hub.scannerFilters.states : scannerStates;

  const dropdown = ({ name, label, items, selectedIds }) => `<details class="multi-select" data-multiselect="${esc(name)}">
<summary><span>${esc(label)}</span><strong data-selection-count>${selectedIds.length} selected</strong></summary>
<div class="multi-select-menu">
<label class="select-all"><input type="checkbox" data-select-all="${esc(name)}"${selectedIds.length === items.filter((item) => item.status === "available").length ? " checked" : ""}> Select all that apply</label>
<div class="option-list">${items.map((item) => `<label class="option-row${item.status !== "available" ? " disabled-option" : ""}"><input name="${esc(name)}" type="checkbox" value="${esc(item.id)}"${selectedIds.includes(item.id) ? " checked" : ""}${item.status !== "available" ? " disabled" : ""}><span>${esc(item.label)}</span><small>${item.status === "available" ? "Available" : "Coming soon"}</small></label>`).join("")}</div>
</div>
</details>`;

  const scannerControls = `<form class="scanner-run-form" method="get" action="/customer/scanner/run">
${dropdown({
  name: "modes",
  label: "Scanner mode",
  items: hub.modes,
  selectedIds: availableModes.filter((mode) => mode.default).map((mode) => mode.id),
})}
${dropdown({
  name: "assets",
  label: "Asset type",
  items: hub.assetTypes,
  selectedIds: availableAssets.filter((asset) => asset.default).map((asset) => asset.id),
})}
${dropdown({
  name: "priceRanges",
  label: "Price range",
  items: hub.priceRanges,
  selectedIds: availablePriceRanges.filter((range) => range.default).map((range) => range.id),
})}
<details class="multi-select" data-multiselect="states">
<summary><span>Filter menu</span><strong data-selection-count>${selectedScannerStates.length} selected</strong></summary>
<div class="multi-select-menu">
<label class="select-all"><input type="checkbox" data-select-all="states"${selectedScannerStates.length === scannerStates.length ? " checked" : ""}> Select all that apply</label>
<div class="option-list">${scannerStates.map((state) => {
  const className = `state-${state.toLowerCase().replaceAll("_", "-")}`;
  return `<label class="option-row filter-choice ${className}"><input name="states" type="checkbox" value="${state}"${selectedScannerStates.includes(state) ? " checked" : ""}><span>${state.replaceAll("_", " ")}</span></label>`;
}).join("")}</div>
</div>
</details>
${hub.filtersSaved ? '<div class="filter-notice" role="status">Scanner filters saved.</div>' : ''}
<div class="scanner-actions">
<button class="save-filters" type="submit" formaction="/customer/scanner/filters" formmethod="post">Save selections</button>
<button class="run-scanners" type="submit">Run scanner(s) now</button>
<p class="nested-range-note">Nested ranges run once at the highest selected ceiling. All lower ranges are included automatically.</p>
</div>
</form>`;

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
<p>Data timestamp: ${esc(formatCustomerDateTime(performance.sourceTs, account, { fallback: "Unavailable" }))} | Status: ${performance.stale === true ? "STALE — READ ONLY" : "Current — read only"}</p>
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
.earnings-overlay{position:relative;z-index:20;width:min(100%,620px);margin:0 auto 18px;border-radius:14px;backdrop-filter:blur(12px);box-shadow:0 8px 30px rgba(0,0,0,.5);overflow:hidden;color:#000}
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
.filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px}
.filter-choice{display:flex;align-items:center;gap:10px;padding:13px 14px;border:1px solid var(--gs-line);border-left-width:6px;border-radius:12px;font-weight:800;background:rgba(0,0,0,.54)}
.filter-choice input{width:auto}
.state-exit,.state-blocked{border-color:#ff3547;color:#ffd5da;background:rgba(255,53,71,.12)}
.state-do-not-enter{border-color:#ff7a1a;color:#ffe0c2;background:rgba(255,122,26,.12)}
.state-enter{border-color:#39ff14;color:#d8ffd0;background:rgba(57,255,20,.11)}
.state-wait{border-color:#ffd23f;color:#fff1b5;background:rgba(255,210,63,.11)}
.state-watch{border-color:#18d7ff;color:#d8f8ff;background:rgba(24,215,255,.10)}
.state-stale-data{border-color:#a78bfa;color:#e8ddff;background:rgba(167,139,250,.10)}
.state-no-setup{border-color:#78848b;color:#d7dde0;background:rgba(120,132,139,.10)}
.save-filters{padding:12px 18px;border:1px solid var(--gs-line);border-radius:10px;background:#3d72d9;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.filter-notice{margin:12px 0;padding:11px 13px;border:1px solid rgba(57,255,20,.7);border-radius:10px;background:rgba(57,255,20,.1);color:#d8ffd0;font-weight:800}
.scanner-run-form{display:grid;gap:12px;margin-top:14px}
.multi-select{border:1px solid var(--gs-line);border-radius:13px;background:rgba(0,0,0,.58);overflow:hidden}
.multi-select>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;cursor:pointer;list-style:none;font-weight:900}
.multi-select>summary::-webkit-details-marker{display:none}
.multi-select>summary::after{content:"+";color:var(--gs-accent);font-size:1.3rem}
.multi-select[open]>summary::after{content:"−"}
.multi-select>summary strong{font-size:.82rem;color:var(--gs-accent)}
.multi-select-menu{padding:0 14px 14px;border-top:1px solid var(--gs-line)}
.select-all,.option-row{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid rgba(120,145,160,.2)}
.select-all{font-weight:900;color:var(--gs-accent)}
.option-row:last-child{border-bottom:0}
.option-row input,.select-all input{width:auto}
.option-row span{flex:1;font-weight:800}
.option-row small{color:var(--gs-muted)}
.disabled-option{opacity:.45}
.scanner-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:4px}
.nested-range-note{flex-basis:100%;margin:0;color:#b9c8ce;font-size:.86rem;line-height:1.4}
.run-scanners,.save-filters{flex:1;min-width:210px;padding:14px 20px;border-radius:11px;font:inherit;font-weight:900;cursor:pointer}
.run-scanners{border:1px solid #39ff14;background:rgba(57,255,20,.18);color:#d8ffd0;box-shadow:0 0 18px rgba(57,255,20,.18)}

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
<section class="card panel scanner-controls">
<h2>Scanner controls</h2>
<p>Select all scanner modes, asset types, and result filters that apply.</p>
${scannerControls}
</section>
<section class="card safety"><b>Safety:</b> Decision assist only. No order placement or account mutation controls.</section>
</main>
${renderGlobalFooter()}
<script src="/assets/customer-scanner-controls.js" defer></script>
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
};
