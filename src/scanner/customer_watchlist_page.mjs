export const VERSION = "customer_watchlist_page_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCustomerWatchlistPage(options = {}) {
  const symbols = Array.isArray(options.symbols)
    ? options.symbols.map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean)
    : [];

  return Object.freeze({
    version: VERSION,
    route: "/customer/watchlist",
    title: "Watchlist",
    symbols: Object.freeze(symbols),
    updatedAt: options.updatedAt ?? null,
    saved: options.saved === true,
    decisionAssistOnly: true,
    orderPlacementAllowed: false,
  });
}

export function renderCustomerWatchlistPageHtml(page = buildCustomerWatchlistPage(), account = null) {
  const symbolValue = esc(page.symbols.join(", "));
  const updated = page.updatedAt ? esc(page.updatedAt) : "Not saved yet";
  const savedNotice = page.saved
    ? '<div class="notice" role="status">Watchlist saved.</div>'
    : "";

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
.panel{background:#101c2f;border:1px solid #263a58;border-radius:16px;padding:18px;margin-bottom:16px}
label{display:block;font-weight:700;margin-bottom:8px}
textarea{width:100%;min-height:130px;border:1px solid #304766;border-radius:12px;background:#08111f;color:#e8eef8;padding:12px;font:inherit}
button{margin-top:12px;border:1px solid #4774aa;border-radius:10px;padding:10px 14px;background:#1d4f86;color:white;font:inherit;font-weight:700;cursor:pointer}
p,.meta{color:#b8c7dc}
.notice{background:#173d2a;border:1px solid #2d7450;border-radius:12px;padding:12px;margin-bottom:16px}
</style>
</head>
<body>
<main class="wrap" data-role="customer" data-page="watchlist">
<nav aria-label="Customer navigation">
<a href="/customer">Home</a>
<a href="/customer/scanner">Scanner</a>
<a href="/customer/scanner/under-five">Under $5</a>
<a href="/customer/watchlist">Watchlist</a>
<a href="/customer/settings">Settings</a>
</nav>
${savedNotice}
<section class="panel">
<h1>${esc(page.title)}</h1>
<p>Save up to 50 stock symbols. Separate symbols with commas. Symbols are normalized to uppercase.</p>
<form method="post" action="/customer/watchlist">
<label for="symbols">Stock symbols</label>
<textarea id="symbols" name="symbols" autocomplete="off" spellcheck="false" placeholder="AAPL, MSFT, NVDA">${symbolValue}</textarea>
<button type="submit">Save watchlist</button>
</form>
<p class="meta">Last updated: ${updated}</p>
</section>
<section class="panel"><b>Safety:</b> Decision assist only. Saving a symbol does not place or prepare an order.</section>
</main>
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerWatchlistPage,
  renderCustomerWatchlistPageHtml,
};
