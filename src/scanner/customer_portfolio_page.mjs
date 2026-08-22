import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
import {
  renderCustomerPrimaryNavigation,
  renderCustomerPrimaryNavigationCss,
} from "./customer_primary_navigation.mjs";

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
    lifetimePerformance: options.lifetimePerformance ?? null,
    locale: options.locale ?? options.account?.locale ?? "en-US",
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    ownedAssets: options.ownedAssets ?? { positions: [], updatedAt: null },
    connectedPositions: Array.isArray(options.connectedPositions) ? options.connectedPositions : [],
    brokerConnected: options.brokerConnected === true,
    windDown: options.windDown ?? { status: "inactive", steps: [] },
    automaticPaper: options.automaticPaper ?? null,
    saved: options.saved === true,
    windDownUpdated: options.windDownUpdated === true,
  });
}

export function renderCustomerPortfolioPageHtml(page = {}) {
  const model = page.model ?? {};
  const summary = model.summary ?? {};
  const lifetimePerformance = page.lifetimePerformance ?? null;
  const lifetimeTotal = finite(lifetimePerformance?.netAfterCosts ?? lifetimePerformance?.totalPl);
  const lifetimeTone = lifetimeTotal > 0 ? "positive" : lifetimeTotal < 0 ? "negative" : "";
  const locale = page.locale ?? "en-US";
  const positions = Array.isArray(model.positions) ? model.positions : [];
  const warnings = Array.isArray(model.warnings) ? model.warnings : [];
  const connectedPositions = Array.isArray(page.connectedPositions) ? page.connectedPositions : [];
  const connectedSymbols = new Set(connectedPositions.map((position) => String(position?.symbol ?? "").toUpperCase()));
  const ownedAssets = (Array.isArray(page.ownedAssets?.positions) ? page.ownedAssets.positions : [])
    .filter((position) => !connectedSymbols.has(String(position?.symbol ?? "").toUpperCase()));
  const manualRows = [...ownedAssets, {}];
  const windDown = page.windDown ?? {};
  const automaticPaper = page.automaticPaper ?? null;
  const automaticPaperEnterArmed = automaticPaper?.enter?.enabled === true;
  const automaticPaperScaleArmed = automaticPaper?.scale?.enabled === true
    && automaticPaper?.scale?.scaleInEnabled === true
    && automaticPaper?.scale?.scaleOutEnabled === true;
  const automaticPaperExitArmed = automaticPaper?.exit?.enabled === true
    && automaticPaper?.exit?.running === true;
  const connectedRows = connectedPositions.length
    ? connectedPositions.map((position) => `<tr><td><strong>${esc(position.symbol)}</strong></td><td>${esc(amount(position.qty, locale))}</td><td>${esc(money(position.averageEntryPrice, locale))}</td><td>${esc(money(position.currentPrice, locale))}</td><td><span class="source-badge">Synced from Alpaca</span><form method="post" action="/customer/portfolio/manual-exit" style="margin-top:8px"><input type="hidden" name="symbol" value="${esc(position.symbol)}"><input type="hidden" name="quantity" value="${esc(position.qty)}"><input type="hidden" name="paperOnly" value="true"><button type="submit" class="danger-button">EXIT PAPER POSITION</button></form></td></tr>`).join("")
    : '<tr><td colspan="5">No positions are currently available from a connected paper account.</td></tr>';
  const manualInputRows = manualRows.map((position) => `<div class="position-row">
<label>Symbol<input name="symbol" value="${esc(position.symbol ?? "")}" placeholder="AAPL" autocomplete="off"></label>
<label>Quantity<input name="qty" value="${esc(position.qty ?? "")}" placeholder="10" inputmode="decimal"></label>
<label>Average purchase price<input name="averageEntryPrice" value="${esc(position.averageEntryPrice ?? "")}" placeholder="185.40" inputmode="decimal"></label>
<label>Broker/source<input name="brokerLabel" value="${esc(position.brokerLabel ?? "")}" placeholder="Other broker"></label>
<span class="source-badge manual-source">Added manually</span>
<button class="remove-row" type="button" aria-label="Remove position">Remove</button>
</div>`).join("");
  const windRows = Array.isArray(windDown.steps) ? windDown.steps.map((step) => `<li><strong>${esc(step.symbol)}</strong>: review a partial sale of ${esc(amount(step.suggestedReviewQty, locale))} out of ${esc(amount(step.ownedQty, locale))}; estimated quantity remaining: ${esc(amount(step.remainingAfterReview, locale))}.</li>`).join("") : "";

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
${renderCustomerPrimaryNavigationCss()}
<style>
.wrap{max-width:1180px;margin:0 auto;padding:32px 16px 64px}
.panel{padding:20px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px}
.metric{padding:15px;border:1px solid var(--gs-line);border-radius:14px;background:rgba(0,0,0,.48)}
.metric span{display:block;color:var(--gs-muted);font-size:13px}
.metric strong{display:block;margin-top:8px;font-size:21px;overflow-wrap:anywhere}
.lifetime-earnings{padding:22px;margin-bottom:18px;border:2px solid rgba(57,255,32,.55);background:linear-gradient(135deg,rgba(57,255,32,.13),rgba(24,215,255,.08));box-shadow:0 0 24px rgba(57,255,32,.12)}
.lifetime-earnings-head{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
.lifetime-earnings .eyebrow{margin:0 0 6px;color:var(--gs-muted);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.lifetime-earnings h2{margin:0}
.lifetime-total{font-size:clamp(30px,6vw,50px);line-height:1;font-weight:950;overflow-wrap:anywhere}
.lifetime-total.positive{color:var(--gs-accent)}
.lifetime-total.negative{color:#ff6b6b}
.lifetime-breakdown{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
.lifetime-breakdown div{padding:12px;border:1px solid var(--gs-line);border-radius:12px;background:rgba(0,0,0,.34)}
.lifetime-breakdown span,.lifetime-breakdown strong{display:block}
.lifetime-breakdown span{color:var(--gs-muted);font-size:12px}
.lifetime-breakdown strong{margin-top:6px;font-size:18px}
.lifetime-note{margin:14px 0 0;color:var(--gs-muted);font-size:13px}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:920px}
th,td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--gs-line)}
.positive{color:var(--gs-accent)}
.negative{color:#ff6b6b}
.stale{color:#ffd166}
input{width:100%;padding:11px;border-radius:10px;background:rgba(0,0,0,.42);color:var(--gs-text);border:1px solid var(--gs-line);box-sizing:border-box}
.position-row{display:grid;grid-template-columns:1fr 1fr 1.4fr 1.2fr auto;gap:10px;align-items:end;margin:12px 0;padding:12px;border:1px solid var(--gs-line);border-radius:12px;background:rgba(0,0,0,.24)}
.position-row label{font-size:13px;color:var(--gs-muted)}
.position-row label input{display:block;margin-top:6px;color:var(--gs-text)}
.remove-row{background:transparent;color:#ff8f8f;border:1px solid rgba(255,107,107,.55)}
.source-badge{display:inline-block;padding:5px 9px;border-radius:999px;background:rgba(57,255,32,.1);border:1px solid rgba(57,255,32,.35);font-size:12px;font-weight:800}
.form-actions{display:flex;gap:10px;flex-wrap:wrap}
.secondary-button{background:transparent;color:var(--gs-text);border:1px solid var(--gs-line)}
.helper{color:var(--gs-muted)}
button{padding:11px 15px;border-radius:10px;font-weight:850;cursor:pointer}
.danger-button{background:#9b111e;color:#fff;border:1px solid #ff6b6b}
.safe-button{background:var(--gs-accent);color:#001b13;border:0}
.wind-active{border:2px solid #ff6b6b}
.notice{padding:10px;border-radius:10px;background:rgba(57,255,32,.1);border:1px solid rgba(57,255,32,.35)}
.wind-summary{margin:12px 0;padding:12px 14px;border-radius:12px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.35)}
.wind-active .wind-summary{background:rgba(255,107,107,.14);border-color:#ff6b6b}
.wind-actions{margin:14px 0 10px}
.wind-actions button{width:100%;max-width:620px}
@media(max-width:760px){.position-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.position-row label:nth-child(3),.position-row label:nth-child(4){grid-column:span 2}.remove-row{grid-column:span 2}.wrap{padding:24px 12px 48px}.panel{padding:16px}.grid,.two,.lifetime-breakdown{grid-template-columns:minmax(0,1fr)}.metric,.lifetime-earnings,.position-row{min-width:0}.metric strong{font-size:19px}.lifetime-total{font-size:clamp(28px,10vw,42px)}.wind-actions button{max-width:none}.table-wrap{-webkit-overflow-scrolling:touch}}@media(max-width:420px){.position-row{grid-template-columns:minmax(0,1fr)}.position-row label:nth-child(3),.position-row label:nth-child(4),.remove-row{grid-column:auto}.wrap{padding-left:10px;padding-right:10px}}
</style>
</head>
<body data-gs-page="customer-portfolio">

${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap">
${renderCustomerPrimaryNavigation({ active: "portfolio" })}

<section class="card lifetime-earnings" data-lifetime-earnings>
<div class="lifetime-earnings-head">
<div><p class="eyebrow">All recorded paper activity</p><h2>Lifetime Earnings</h2></div>
<strong class="lifetime-total ${lifetimeTone}">${esc(money(lifetimePerformance?.netAfterCosts ?? lifetimePerformance?.totalPl, locale))}</strong>
</div>
<div class="lifetime-breakdown">
<div><span>Realized</span><strong>${esc(money(lifetimePerformance?.realizedPl, locale))}</strong></div>
<div><span>Unrealized</span><strong>${esc(money(lifetimePerformance?.unrealizedPl, locale))}</strong></div>
<div><span>Combined</span><strong>${esc(money(lifetimePerformance?.totalPl, locale))}</strong></div>
<div><span>Return</span><strong>${esc(amount(lifetimePerformance?.totalReturnPct, locale, "%"))}</strong></div>
</div>
<p class="lifetime-note">${lifetimePerformance ? "Read-only lifetime paper performance from broker-confirmed Alpaca PAPER filled-order history and current broker marks." : "Lifetime performance data is not available yet."}</p>
</section>

<section class="card panel">
<p>Paper portfolio • Read only</p>
<h1>Portfolio</h1>
<p>Review paper-account balances, position performance, allocation, and concentration risk.</p>
<p class="${model.stale ? "stale" : "positive"}"><strong>Data status:</strong> ${model.stale ? "Waiting for current paper-trading data" : "Paper-trading data is current"}</p>
<p><strong>Last updated:</strong> ${esc(model.sourceTs ?? "No timestamp available")}</p>
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
<h2>Trading limits</h2>
<p>Portfolio analytics and automatic-runtime status are read-only. Live trading remains disabled. The separate exact-position <strong>EXIT PAPER POSITION</strong> control can submit an authenticated Alpaca PAPER exit only after GeminiScanner verifies one exact MONITORING lifecycle, symbol, quantity, and broker-position identity.</p>
</section>
</div>

<section class="card panel">
<h2>Connected account positions</h2>
<p>${page.brokerConnected ? "Automatically synchronized from Alpaca." : "Connect a supported paper account to synchronize positions automatically."}</p>
<div class="table-wrap"><table><thead><tr><th>Symbol</th><th>Quantity</th><th>Average purchase price</th><th>Current price</th><th>Source / Mechanical test</th></tr></thead><tbody>${connectedRows}</tbody></table></div>
<p class="helper">Broker-synced position data refreshes from Alpaca. Automatic Alpaca PAPER ENTER/SCALE/EXIT runs independently under dedicated fail-closed runtime gates, and the explicit EXIT PAPER POSITION control can request an exact-position PAPER exit for a verified MONITORING lifecycle. Live trading is disabled.</p>
</section>

<section class="card panel">
<h2>Positions you want GeminiScanner to monitor</h2>
<h3>Other positions</h3>
<p>Add positions manually when they are not available from a connected paper account.</p>
<p>Add positions held in another account or broker manually.</p>
<p>Manually added positions are local monitoring inputs only. They are not automatically submitted to Alpaca and do not create broker positions or orders. Automatic Alpaca PAPER execution applies only through its separate verified lifecycle and broker-state contracts.</p>
${page.saved ? '<p class="notice"><strong>Manual positions saved.</strong></p>' : ''}
<form method="post" action="/customer/portfolio/owned-assets" id="owned-position-form">
<div id="owned-position-rows">${manualInputRows}</div>
<div class="form-actions">
<button class="secondary-button" type="button" id="add-position-row">Add position</button>
<button class="safe-button" type="submit">Save positions</button>
</div>
</form>
<p><strong>Manually saved positions:</strong> ${esc(ownedAssets.length)} / <strong>Last updated:</strong> ${esc(page.ownedAssets?.updatedAt ?? "Not saved yet")}</p>
</section>

<section class="card panel ${windDown.exitAllRequested ? "wind-active" : ""}">
<h2>Portfolio wind-down</h2>
<p>Use portfolio wind-down when you want to stop reviewing new purchases and focus on reducing existing paper positions.</p>
${page.windDownUpdated ? '<p class="notice"><strong>Wind-down preference updated.</strong></p>' : ''}
<div class="wind-summary"><p><strong>Status:</strong> ${esc(windDown.exitAllRequested ? "ACTIVE — NEW BUY AND ADD-ON REVIEWS BLOCKED" : "Inactive — new-buy reviews remain available")}</p><p>${windDown.exitAllRequested ? "Wind-down blocks new-buy and add-on review eligibility while preserving qualified EXIT and partial profit-protection evaluation. Automatic Alpaca PAPER execution remains governed by its independent lifecycle, strategy, freshness, identity, and submission safeguards." : "Activating wind-down blocks new-buy and add-on reviews while preserving qualified EXIT and partial profit-protection evaluation. It does not itself submit an order."}</p></div>
${windRows ? `<ul>${windRows}</ul>` : '<p>No wind-down steps are active.</p>'}
<form method="post" action="/customer/portfolio/wind-down">
<input type="hidden" name="action" value="${windDown.exitAllRequested ? "resume" : "exit_all"}">
<p class="wind-actions"><button class="${windDown.exitAllRequested ? "safe-button" : "danger-button"}" type="submit">${windDown.exitAllRequested ? "End wind-down and resume new-buy reviews" : "Start portfolio wind-down"}</button></p>
</form>
<p>This wind-down preference changes review eligibility only; the preference update itself does not contact Alpaca or submit an order. Any automatic PAPER execution remains subject to the independent fail-closed execution runtime. Live trading is disabled.</p>
</section>

<section class="card panel" data-automatic-paper-runtime>
<h2>Automatic Alpaca PAPER execution</h2>
<p>Read-only status from the running GeminiScanner automation. Viewing this Portfolio page does not invoke a runner or submit an order.</p>
<div class="grid">
${metric("Continuity", automaticPaper?.continuity?.enabled ? "ARMED" : "OFF")}
${metric("ENTER", automaticPaperEnterArmed ? "ARMED" : "OFF")}
${metric("SCALE", automaticPaperScaleArmed ? "ARMED" : "OFF")}
${metric("EXIT", automaticPaperExitArmed ? "ARMED" : "OFF")}
${metric("Lifecycle", automaticPaper?.lifecycle?.state ?? "Unavailable")}
${metric("Symbol", automaticPaper?.lifecycle?.selectedSymbol ?? "Unavailable")}
${metric("Quantity", automaticPaper?.lifecycle?.filledQuantity ?? "Unavailable")}
${metric("Last ENTER", String(automaticPaper?.enter?.lastStatus ?? "Unavailable").replaceAll("_", " "))}
${metric("Last SCALE", String(automaticPaper?.scale?.lastStatus ?? "Unavailable").replaceAll("_", " "))}
${metric("Last EXIT", String(automaticPaper?.exit?.lastStatus ?? "Unavailable").replaceAll("_", " "))}
</div>
<p>Automatic execution is PAPER-only and fail-closed. Live trading is disabled. Portfolio observability does not bypass freshness, buying-power, position-sizing, duplicate/in-flight, lifecycle-identity, reconciliation, or EXIT protections.</p>
</section>

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
<script src="/customer-portfolio-owned-assets.js" defer></script>
</body>
</html>`;
}

export default {
  VERSION,
  buildCustomerPortfolioPage,
  renderCustomerPortfolioPageHtml,
};
