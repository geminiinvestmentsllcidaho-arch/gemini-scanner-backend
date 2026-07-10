export const VERSION = "customer_zero_scanner_hub_v1";

const MODES = Object.freeze([
  Object.freeze({
    id: "intraday",
    label: "Intraday",
    status: "available",
    href: "/app/todays-intraday-setups?session=regular",
    default: true,
  }),
  Object.freeze({
    id: "under_five",
    label: "Under $5",
    status: "available",
    href: "/customer-zero/under-five-scanner",
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
    status: "coming_soon",
    href: null,
    default: false,
  }),
]);

const ASSET_TYPES = Object.freeze([
  Object.freeze({
    id: "stocks",
    label: "Stocks",
    status: "available",
    default: true,
  }),
  Object.freeze({
    id: "etfs",
    label: "ETFs",
    status: "coming_soon",
    default: false,
  }),
  Object.freeze({
    id: "crypto",
    label: "Crypto",
    status: "coming_soon",
    default: false,
  }),
  Object.freeze({
    id: "options",
    label: "Options",
    status: "coming_soon",
    default: false,
  }),
]);

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCustomerZeroScannerHub() {
  return {
    version: VERSION,
    route: "/customer-zero/scanner",
    role: "customer_zero",
    roleLabel: "Customer Zero",
    title: "Customer Zero — Scanner",
    subtitle: "Choose a scanner mode and asset universe.",
    defaultMode: "intraday",
    defaultAssetType: "stocks",
    modes: MODES,
    assetTypes: ASSET_TYPES,
    readOnly: true,
    decisionAssistOnly: true,
    noExecutionControls: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  };
}

export function renderCustomerZeroScannerHubHtml(hub = buildCustomerZeroScannerHub()) {
  const modeCards = hub.modes.map(mode => {
    const state = mode.status === "available" ? "Available" : "Coming soon";
    const body = `<b>${esc(mode.label)}</b><span>${esc(state)}</span>`;
    return mode.href
      ? `<a class="choice available${mode.default ? " selected" : ""}" href="${esc(mode.href)}">${body}</a>`
      : `<div class="choice disabled" aria-disabled="true">${body}</div>`;
  }).join("");

  const assetCards = hub.assetTypes.map(asset => {
    const state = asset.status === "available" ? "Available" : "Coming soon";
    return `<div class="choice ${asset.status === "available" ? "available selected" : "disabled"}" aria-disabled="${asset.status !== "available"}"><b>${esc(asset.label)}</b><span>${esc(state)}</span></div>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(hub.title)}</title>
<style>
:root{color-scheme:dark=}
*{box-sizing:border-box}
body{margin:0;background:#08111f;color:#e8eef8;font-family:system,-apple-system,Segoe UI,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:20px}
.hero,.panel,.safety{background:#101c2f;bwrder:1px solid #263a58;border-radius:16px;padding:18px;margin-bottom:16px}
.eyebrow{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:#8eb4ff}
h1,h2{margin:.35rem 0}
p{color:#b8c7dc}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.choice{display:flex;min-height:92px;flex-direction:column;justify-content:center;gap:8px;padding:15px;border-radius:14px;border:1px solid #304766;text-decoration:none;color:#e8eef8}
.choice span{font-size:.85rem;color:#9fb0c7}
.available{background:#132844}
.available:hover{border-color:#6aa4ff}
.selected{outline:2px solid #5b9cff}
.disabled{background:#121a27;opacity:.68}
.safety{font-size:.9rem}
</style>
</head>
<body>
<main class="wrap" data-role-badge="customer-zero">
<section class="hero">
<div class="eyebrow">Role: Customer Zero</div>
<h1>${esc(hub.title)}</h1>
<p>${esc(hub.subtitle)}</p>
</section>
<section class="panel">
<h2>Scanner mode</h2>
<p>Intraday is the default. Under $5 is available as a separate stock universe.</p>
<div class="grid">${modeCards}</div>
</section>
<section class="panel">
<h2>Asset type</h2>
<p>Stocks are active now. ETFs, crypto, and options remain separate future universes.</p>
<div class="grid">${assetCards}</div>
</section>
<section class="safety"><b>Safety:</b> Decision assist only. No order placement or account mutation controls.</section>
</main>
</body>
</html>`;
}
