import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";

export const VERSION = "customer_portfolio_page_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value, locale = "en-US") {
  const number = finite(value);
  if (number === null) return "No data yet";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
}

function amount(value, locale = "en-US", suffix = "") {
  const number = finite(value);
  if (number === null) return "No data yet";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(number)}${suffix}`;
}

function metric(label, value) {
  return `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;
}

const WARNING_LABELS = Object.freeze({
  PAPER_ACCOUNT_UNHEALTHY: "Paper account connection needs attention.",
  PORTFOLIO_DATA_STALE: "Portfolio data is not current.",
  POSITION_PRICE_MISSING: "One or more positions are missing a current price.",
  PORTFOLIO_CONCENTRATION_HIGH: "One position represents at least 25% of portfolio value.",
});

export function buildCustomerPortfolioPage(options = {}) {
  return Object.freeze({
    version: VERSION,
    route: "/customer/portfolio",
    model: options.model ?? {},
    account: options.account ?? {},
    locale: options.locale ?? options.account?.locale ?? "en-US",
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
  });
}

export function renderCustomerPortfolioPageHtml(page = {}) {
  const model = page.model ?? {};
  const summary = model.summary ?? {};
  const locale = page.locale ?? "en-US";
  const positions = Array.isArray(model.positions) ? model.positions : [];
  const warnings = Array.isArray(model.warnings) ? model.warnings : [];

  const rows = positions.length
    ? positions.map((position) => `<tr>
<td><strong>${esc(position.symbol)}</strong></td>
<td>${esc(amount(position.qty, locale))}</td>
<td>${esc(money(position.averageEntryPrice, locale))}</td>
<td>${esc(money(position.currentPrice, locale))}</td>
<td>${esc(money(position.costBasis, locale))}</td>
<td>${esc(money(position.marketValue, locale))}</td>
<td class="${position.unrealizedPl > 0 ? "positive" : position.unrealizedPl < 0 ? "negative" : ""}">${esc(money(position.unrealizedPl, locale))}</td>
<td>${esc(amount(position.unrealizedPlPct, locale, "%"))}</td>
<td>${esc(amount(position.allocationPct, locale, "%"))}</td>
</tr>`).join("")
    : '<tr><td colspan="9">No paper positions are currently available.</td></tr>';

  const warningItems = warnings.length
    ? warnings.map((warning) => `<li>${esc(WARNING_LABELS[warning] ?? warning)}</li>`).join("")
    : "<li>No portfolio risk warnings are currently active.</li>";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner — Portfolio</title>
${renderGlobalThemeCss({ surface: "customer" })}
<style>
.wrap{max-width:1180px;margin:0 auto;padding:32px 16px 64px}
.nav{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.nav a{color:var(--gs-accent);text-decoration:none;border:1px solid var(--gs-line);border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.58)}
.panel{padding:20px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px}
.metric{padding:15px;border:1px solid var(--gs-line);border-radius:14px;background:rgba(0,0,0,.48)}
.metric span{display:block;color:var(--gs-muted);font-size:13px}
.metric strong{display:block;margin-top:8px;font-size:21px;overflow-wrap:anywhere}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:920px}
th,td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--gs-line)}
.positive{color:var(--gs-accent)}
.negative{color:#ff6b6b}
.stale{color:#ffd166}
</style>
</head>
<body data-gs-page="customer-portfolio">

${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap">
<nav class="nav" aria-label="Customer navigation">
<a href="/customer">Home</a>
<a href="/customer/scanner">Scanner</a>
<a href="/customer/portfolio" aria-current="page">Portfolio</a>
<a href="/customer/reports">Reports</a>
<a href="/customer/watchlist">Watchlist</a>
<a href="/customer/settings">Settings</a>
</nav>

<section class="card panel">
<p>Paper portfolio • Read only</p>
<h1>Portfolio dashboard</h1>
<p>Balances, exposure, position performance, allocation, and concentration risk from the paper account.</p>
<p class="${model.stale ? "stale" : "positive"}">Data status: ${model.stale ? "Waiting for current paper-trading data" : "Paper-trading data is current"}</p>
<p>Updated: ${esc(model.sourceTs ?? "No timestamp available")}</p>
</section>

<section class="card panel">
<h2>Account overview</h2>
<div class="grid">
${metric("Portfolio value", money(model.account?.portfolioValue, locale))}
${metric("Equity", money(model.account?.equity, locale))}
${metric("Cash", money(model.account?.cash, locale))}
${metric("Buying power", money(model.account?.buyingPower, locale))}
${metric("Invested capital", money(summary.investedCapital, locale))}
${metric("Total exposure", money(summary.totalExposure, locale))}
${metric("Positions", amount(summary.positionsCount, locale))}
${metric("Average position", money(summary.averagePositionSize, locale))}
</div>
</section>

<section class="card panel">
<h2>Performance and allocation</h2>
<div class="grid">
${metric("Unrealized P/L", money(summary.totalUnrealizedPl, locale))}
${metric("Unrealized return", amount(summary.totalUnrealizedPlPct, locale, "%"))}
${metric("Largest position", summary.largestPosition?.symbol ?? "No data yet")}
${metric("Largest allocation", amount(summary.largestPosition?.allocationPct, locale, "%"))}
${metric("Top winner", summary.topWinner?.symbol ?? "No data yet")}
${metric("Top loser", summary.topLoser?.symbol ?? "No data yet")}
</div>
</section>

<div class="two">
<section class="card panel">
<h2>Risk checks</h2>
<ul>${warningItems}</ul>
</section>
<section class="card panel">
<h2>Safety lock</h2>
<p>Read only. Paper only. Decision assist only.</p>
<p>No live trading, auto trading, order placement, broker contact, or account mutation controls are available.</p>
</section>
</div>

<section class="card panel">
<h2>Open paper positions</h2>
<div class="table-wrap">
<table>
<thead><tr><th>Symbol</th><th>Qty</th><th>Avg entry</th><th>Current</th><th>Cost basis</th><th>Market value</th><th>Unrealized P/L</th><th>P/L %</th><th>Allocation</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</section>
</main>
${renderGlobalFooter()}
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerPortfolioPage,
  renderCustomerPortfolioPageHtml,
};
