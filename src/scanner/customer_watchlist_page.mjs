import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
import { formatCustomerDateTime } from "./customer_time.mjs";
import {
  renderCustomerPrimaryNavigation,
  renderCustomerPrimaryNavigationCss,
} from "./customer_primary_navigation.mjs";

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
  const updated = formatCustomerDateTime(page.updatedAt, account, { fallback: "Not saved yet" });
  const savedNotice = page.saved
    ? '<div class="notice" role="status">Watchlist saved.</div>'
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner — ${esc(page.title)}</title>
${renderGlobalThemeCss({ surface: "customer" })}
${renderCustomerPrimaryNavigationCss()}
<style>
.wrap{max-width:820px;margin:0 auto;padding:36px 20px 72px}
.panel{padding:18px;margin-bottom:16px}
label{display:block;font-weight:700;margin-bottom:8px}
textarea{width:100%;min-height:130px;border:1px solid var(--gs-line);border-radius:12px;background:rgba(0,0,0,.72);color:var(--gs-text);padding:12px;font:inherit}
button{margin-top:12px;border:1px solid var(--gs-line);border-radius:10px;padding:10px 14px;background:rgba(0,0,0,.72);color:var(--gs-text);font:inherit;font-weight:700;cursor:pointer}
p,.meta{color:var(--gs-muted)}
.notice{background:rgba(5,84,64,.34);border:1px solid rgba(64,255,198,.45);border-radius:12px;padding:12px;margin-bottom:16px;color:#caffef}
.empty-state{background:rgba(24,215,255,.08);border-color:var(--gs-border);color:var(--gs-text)}
@media(max-width:640px){.wrap{padding:24px 12px 56px}button{width:100%}}
</style>
</head>
<body data-gs-page="customer-watchlist">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap" data-role="customer" data-page="watchlist">
${renderCustomerPrimaryNavigation({ active: "watchlist" })}
${savedNotice}
<section class="panel">
<h1>${esc(page.title)}</h1>
<p>Save up to 50 stock symbols for the manual Watchlist scan. Separate symbols with commas; symbols are normalized to uppercase.</p>
${page.symbols.length === 0 ? '<div class="notice empty-state">No symbols saved yet. Add symbols here, then run the Watchlist mode from Scanner. Saving symbols does not run a scan.</div>' : ''}
<form method="post" action="/customer/watchlist">
<label for="symbols">Stock symbols</label>
<textarea id="symbols" name="symbols" autocomplete="off" spellcheck="false" placeholder="AAPL, MSFT, NVDA">${symbolValue}</textarea>
<button type="submit">Save watchlist</button>
</form>
<p class="meta">Last updated: ${updated}</p>
</section>
<section class="panel"><b>Safety:</b> Decision assist only. Saving a symbol does not place or prepare an order.</section>
</main>
${renderGlobalFooter()}
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerWatchlistPage,
  renderCustomerWatchlistPageHtml,
};
