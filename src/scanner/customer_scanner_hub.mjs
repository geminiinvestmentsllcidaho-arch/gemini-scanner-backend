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
  const performancePanel = performance
    ? `<section class="panel performance-${esc(performance.tone ?? "neutral")}">
<h2>Total earnings — ${esc(performance.period ?? "daily")}</h2>
<nav class="performance-periods" aria-label="Performance period">${["daily","weekly","monthly","yearly","ytd","lifetime"].map((period) => `<a class="${performance.period === period ? "active" : ""}" href="/customer?period=${period}">${period.toUpperCase()}</a>`).join("")}</nav>
<p>Realized: $${esc(performance.realizedPl ?? 0)} | Unrealized: $${esc(performance.unrealizedPl ?? 0)} | Combined: $${esc(performance.totalPl ?? 0)} | Net after costs: $${esc(performance.netAfterCosts ?? 0)}</p>
<p>Winners: ${esc(performance.winners ?? 0)} | Losers: ${esc(performance.losers ?? 0)} | Win rate: ${esc(performance.winRatePct ?? 0)}%</p>
<p>Average gain: $${esc(performance.averageGain ?? 0)} | Average loss: $${esc(performance.averageLoss ?? 0)} | Largest gain: $${esc(performance.largestGain ?? 0)} | Largest loss: $${esc(performance.largestLoss ?? 0)}</p>
<p>Fees: $${esc(performance.fees ?? 0)} | Slippage: $${esc(performance.slippage ?? 0)}</p>
<p>Starting equity: $${esc(performance.startingEquity ?? 0)} | Ending equity: $${esc(performance.endingEquity ?? 0)} | Peak equity: $${esc(performance.peakEquity ?? 0)} | Drawdown: $${esc(performance.drawdown ?? 0)} (${esc(performance.drawdownPct ?? 0)}%)</p>
<p>Period snapshots: ${esc(performance.periodRecordCount ?? 0)} | Period start: ${esc(performance.periodStartTs ?? "Unavailable")} | Period end: ${esc(performance.periodEndTs ?? "Unavailable")}</p>
<p>Data timestamp: ${esc(performance.sourceTs ?? "Unavailable")} | Status: ${performance.stale === true ? "STALE — READ ONLY" : "Current — read only"}</p>
</section>`
    : "";

  const accountEmail = esc(account?.email ?? "");
  const accountPanel = accountEmail
    ? `<section class="account-panel">
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
<style>
*{box-sizing:border-box}
body{margin:0;background:#08111f;color:#e8eef8;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:20px}
nav{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}
nav a{color:#dbe8ff;text-decoration:none;border:1px solid #304766;border-radius:10px;padding:9px 12px;background:#101c2f}
.account-panel,.hero,.panel,.safety{background:#101c2f;border:1px solid #263a58;border-radius:16px;padding:18px;margin-bottom:16px}
.performance-positive{border-left:8px solid #159447}.performance-negative{border-left:8px solid #c62020}.performance-neutral{border-left:8px solid #737983}
.performance-periods{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.performance-periods a{padding:8px 10px;border-radius:999px;background:#132844;color:#dbe8ff;text-decoration:none;font-weight:800}.performance-periods a.active{background:#5b9cff;color:#08111f}
.account-panel{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.account-panel strong{display:block;margin-top:6px;overflow-wrap:anywhere}
.account-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.account-actions a,.account-actions button{display:inline-flex;align-items:center;justify-content:center;border:1px solid #304766;border-radius:10px;padding:9px 12px;background:#132844;color:#e8eef8;text-decoration:none;font:inherit;font-weight:700;cursor:pointer}
.account-actions form{margin:0}
.account-actions button{background:#7c2d3a;border-color:#a33c4c}
.eyebrow{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:#8eb4ff}
h1,h2{margin:.35rem 0}
p{color:#b8c7dc}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.choice{display:flex;min-height:92px;flex-direction:column;justify-content:center;gap:8px;padding:15px;border-radius:14px;border:1px solid #304766;text-decoration:none;color:#e8eef8}
.choice span{font-size:.85rem;color:#9fb0c7}
.available{background:#132844}
.selected{outline:2px solid #5b9cff}
.disabled{background:#121a27;opacity:.68}
.safety{font-size:.9rem}
</style>
</head>
<body>
<main class="wrap" data-role="customer" data-tenant="${esc(hub.tenant)}">
${accountPanel}
<nav aria-label="Customer navigation">${nav}</nav>
<section class="hero">
<div class="eyebrow">Customer account</div>
<h1>${esc(hub.title)}</h1>
<p>${esc(hub.subtitle)}</p>
</section>
${performancePanel}
<section class="panel">
<h2>Scanner mode</h2>
<div class="grid">${modeCards}</div>
</section>
<section class="panel">
<h2>Asset type</h2>
<div class="grid">${assetCards}</div>
</section>
<section class="safety"><b>Safety:</b> Decision assist only. No order placement or account mutation controls.</section>
</main>
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
};
