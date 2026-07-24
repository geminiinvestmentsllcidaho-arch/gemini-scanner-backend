import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
import { customerLocale, customerTimezone, formatCustomerDateTime } from "./customer_time.mjs";
import {
  renderCustomerPrimaryNavigation,
  renderCustomerPrimaryNavigationCss,
} from "./customer_primary_navigation.mjs";

export const VERSION = "customer_reports_page_v1";

const PERIODS = Object.freeze([
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["yearly", "Yearly"],
  ["ytd", "Year-to-Date"],
  ["lifetime", "Lifetime"],
]);

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

function number(value, locale = "en-US", suffix = "") {
  const parsed = finite(value);
  if (parsed === null) return "No data yet";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(parsed)}${suffix}`;
}

function duration(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  const milliseconds = finite(value);
  if (milliseconds === null || milliseconds < 0) return "No data yet";

  let seconds = Math.round(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.slice(0, 2).join(" ");
}

function metric(label, value, className = "") {
  return `<article class="metric ${esc(className)}"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;
}

function timeZoneLabel(timeZone) {
  const labels = {
    "America/New_York": "Eastern Time",
    "America/Chicago": "Central Time",
    "America/Denver": "Mountain Time",
    "America/Los_Angeles": "Pacific Time",
  };
  return labels[timeZone] ?? String(timeZone || "Local time").replaceAll("_", " ");
}

function reportStatusLabel(report = {}) {
  if (report.stale) return "Waiting for current paper-trading data";
  return "Paper-trading data is current";
}

export function buildCustomerReportsPage(options = {}) {
  return Object.freeze({
    version: VERSION,
    route: "/customer/reports",
    report: options.report ?? {},
    account: options.account ?? {},
    locale: customerLocale(options.account),
    timeZone: customerTimezone(options.account),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
  });
}

export function renderCustomerReportsPageHtml(page = {}) {
  const report = page.report ?? {};
  const account = page.account ?? {};
  const locale = page.locale || customerLocale(account);
  const timeZone = page.timeZone || customerTimezone(account);
  const performance = report.performance ?? {};
  const trades = report.trades ?? {};
  const scanner = report.scanner ?? {};
  const aiReview = report.aiReview ?? {};
  const aiProposals = Array.isArray(aiReview.proposals) ? aiReview.proposals : [];
  const realtimeAiReview = report.realtimeAiReview ?? {};
  const realtimeAiText = typeof realtimeAiReview.reviewText === "string"
    ? realtimeAiReview.reviewText.trim()
    : "";
  const decisionQualityProposals = report.decisionQualityProposals ?? {};
  const proposalRows = Array.isArray(decisionQualityProposals.proposals)
    ? decisionQualityProposals.proposals
    : [];
  const proposalCalibrationReview = report.proposalCalibrationReview ?? {};
  const calibrationRows = Array.isArray(proposalCalibrationReview.calibrationReviewQueue)
    ? proposalCalibrationReview.calibrationReviewQueue
    : [];
  const proposalCalibrationHistory = report.proposalCalibrationHistory ?? {};
  const calibrationHistoryRows = Array.isArray(proposalCalibrationHistory.records)
    ? proposalCalibrationHistory.records
    : [];
  const activities = Array.isArray(report.activity) ? report.activity : [];
  const winners = Array.isArray(report.largestWinners) ? report.largestWinners : [];
  const losers = Array.isArray(report.largestLosers) ? report.largestLosers : [];
  const activePeriod = String(report.period || "lifetime");
  const periodLinks = PERIODS.map(([value, label]) =>
    `<a href="/customer/reports?period=${value}"${value === activePeriod ? ' aria-current="page" class="active"' : ""}>${label}</a>`
  ).join("");
  const reportSectionLinks = [
    ["performance-summary", "Performance"],
    ["trade-statistics", "Trades"],
    ["scanner-accuracy", "Scanner"],
    ["winners-losers", "Winners & Losers"],
    ["ai-review", "AI Review"],
    ["calibration", "Calibration"],
    ["detailed-activity", "Activity"],
  ].map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join("");

  const activityRows = activities.length
    ? activities.map((row) => `<tr>
<td>${esc(formatCustomerDateTime(row.timestamp ?? row.createdAt, account))}</td>
<td>${esc(row.symbol ?? "—")}</td>
<td>${esc(row.action ?? row.state ?? "—")}</td>
<td>${esc(money(row.realizedPnl ?? row.pnl, locale))}</td>
<td>${esc(row.status ?? "read-only")}</td>
</tr>`).join("")
    : '<tr><td colspan="5">No in-range paper activity is available.</td></tr>';

  const rankingRows = (rows, emptyText) => rows.length
    ? rows.map((row) => `<li><strong>${esc(row.symbol ?? "Unknown")}</strong> ${esc(money(row.realizedPnl ?? row.pnl, locale))}</li>`).join("")
    : `<li>${esc(emptyText)}</li>`;

  const labelToken = (value) => String(value ?? "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const proposalCards = proposalRows.length
    ? proposalRows.slice(0, 12).map((proposal) => `<article class="report-row proposal-card">
<h3>${esc(proposal.title ?? labelToken(proposal.proposalType) ?? "Review proposal")}</h3>
<p><strong>Area:</strong> ${esc(labelToken(proposal.targetArea) || "General review")} | <strong>Risk:</strong> ${esc(labelToken(proposal.riskLevel) || "Review")}</p>
<p><strong>Suggested direction:</strong> ${esc(proposal.suggestedDirection ?? "Historical review required.")}</p>
<p><strong>Evidence:</strong> ${esc(proposal.evidence?.symbol ?? "No symbol")} · confidence ${esc(number(proposal.evidence?.rankingConfidence, locale))} · potential ${esc(number(proposal.evidence?.readonlyPotentialScore, locale))}</p>
</article>`).join("")
    : "<p>No historical decision-quality proposals are available yet.</p>";

  const calibrationCards = calibrationRows.length
    ? calibrationRows.slice(0, 12).map((group) => `<article class="report-row calibration-card">
<h3>${esc(labelToken(group.groupKey) || "Calibration review group")}</h3>
<p><strong>Status:</strong> ${esc(labelToken(group.calibrationReviewStatus))} | <strong>Sample:</strong> ${esc(number(group.sampleCount, locale))} | <strong>Band:</strong> ${esc(labelToken(group.calibrationBand))}</p>
<p><strong>High-confidence concern rate:</strong> ${esc(number(group.disagreementRatePct, locale, "%"))} | <strong>Average confidence:</strong> ${esc(number(group.averageRankingConfidence, locale))}</p>
<p><strong>Symbols:</strong> ${esc(number(group.uniqueSymbolCount, locale))} | <strong>Scans:</strong> ${esc(number(group.uniqueScanCount, locale))}</p>
<p><strong>Observable sources:</strong> ${esc(number(group.observableSourceCount, locale))} | <strong>Stale sources:</strong> ${esc(number(group.staleSourceCount, locale))}</p>
</article>`).join("")
    : "<p>No calibration review groups are available yet.</p>";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner — Customer reports</title>
${renderGlobalThemeCss({ surface: "customer" })}
${renderCustomerPrimaryNavigationCss()}
<style>
.wrap{max-width:1180px;margin:0 auto;padding:36px 18px 72px}
.periods{display:flex;flex-wrap:wrap;gap:10px}
.periods a{color:var(--gs-accent);text-decoration:none;border:1px solid var(--gs-line);border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.58)}
.periods{margin:18px 0 24px}
.periods a.active{box-shadow:0 0 18px rgba(57,255,32,.38);border-color:var(--gs-accent)}
.report-section-nav{display:flex;flex-wrap:wrap;gap:9px;padding:14px;margin-bottom:18px}
.report-section-nav a{display:inline-flex;align-items:center;min-height:38px;color:var(--gs-text);text-decoration:none;border:1px solid var(--gs-line);border-radius:999px;padding:8px 12px;background:rgba(0,0,0,.5)}
.report-section-nav a:hover,.report-section-nav a:focus-visible{color:var(--gs-accent);border-color:var(--gs-accent)}
.hero,.panel{padding:20px;margin-bottom:18px;scroll-margin-top:18px}
.hero p,.muted{color:var(--gs-muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.metric{padding:16px;border:1px solid var(--gs-line);border-radius:14px;background:rgba(0,0,0,.48)}
.metric span{display:block;color:var(--gs-muted);font-size:13px}
.metric strong{display:block;margin-top:8px;font-size:22px;overflow-wrap:anywhere}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--gs-line)}
.table-wrap{overflow-x:auto}
.placeholder{min-height:130px;display:grid;place-items:center;border:1px dashed var(--gs-line);border-radius:14px;color:var(--gs-muted)}
.status{font-weight:800;color:var(--gs-accent)}
.status.stale{color:#ffd166}
.report-row{padding:14px;margin-top:12px;border:1px solid var(--gs-line);border-radius:12px;background:rgba(0,0,0,.42)}
.report-row h3{margin:0 0 8px}
.safety-locks{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.safety-locks span{border:1px solid var(--gs-line);border-radius:999px;padding:6px 9px;font-size:12px;color:var(--gs-muted)}
@media(max-width:620px){.wrap{padding:24px 12px 56px}.metric strong{font-size:19px}}
</style>
</head>
<body data-gs-page="customer-reports">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap" data-role="customer" data-page="reports">
${renderCustomerPrimaryNavigation({ active: "reports" })}

<section class="card hero">
<p class="muted">Paper-trading performance • ${esc(timeZoneLabel(timeZone))}</p>
<h1>Reports</h1>
<p>Review paper-trading performance, scanner outcomes, and AI-assisted evidence review for the selected period.</p>
<p class="status${report.stale ? " stale" : ""}">Data status: ${esc(reportStatusLabel(report))}</p>
<nav class="periods" aria-label="Report period">${periodLinks}</nav>
</section>

<nav class="card report-section-nav" aria-label="Report sections">${reportSectionLinks}</nav>

<section class="card panel" id="performance-summary">
<h2>Performance summary</h2>
<div class="grid">
${metric("Starting balance", money(performance.startingBalance ?? performance.startingEquity, locale))}
${metric("Ending balance", money(performance.endingBalance ?? performance.endingEquity, locale))}
${metric("Total P/L", money(performance.totalPl ?? performance.totalPnl, locale))}
${metric("Realized P/L", money(performance.realizedPl ?? performance.realizedPnl, locale))}
${metric("Unrealized P/L", money(performance.unrealizedPl ?? performance.unrealizedPnl, locale))}
${metric("Total return", number(performance.totalReturnPct, locale, "%"))}
${metric("Max drawdown", money(performance.maxDrawdown, locale))}
${metric("Capital used", money(performance.totalCapitalUsed, locale))}
</div>
</section>

<div class="two">
<section class="card panel" id="trade-statistics">
<h2>Trade statistics</h2>
<div class="grid">
${metric(trades.lifecycleSourceAvailable ? "Completed trades" : "Symbols with realized P/L", number(trades.totalTrades, locale))}
${metric("Winning trades", number(trades.winningTrades, locale))}
${metric("Losing trades", number(trades.losingTrades, locale))}
${metric("Break-even trades", number(trades.breakevenTrades, locale))}
${metric("Win rate", number(trades.winRatePct, locale, "%"))}
${metric("Positions opened", number(trades.positionsOpened, locale))}
${metric("Partial closes", number(trades.partialCloseCount, locale))}
${metric("Fill events", number(trades.fillEventsObserved, locale))}
${metric("Average gain", money(trades.averageGain, locale))}
${metric("Average loss", money(trades.averageLoss, locale))}
${metric("Average hold time", duration(trades.averageHoldTimeMs ?? trades.averageHoldTime))}
${metric("Average dollars / trade", money(trades.averageDollarsPerTrade, locale))}
</div>
</section>

<section class="card panel" id="scanner-accuracy">
<h2>Scanner accuracy</h2>
<div class="grid">
${metric("Signals", number(scanner.signalsGenerated, locale))}
${metric("ENTER", number(scanner.enter, locale))}
${metric("EXIT", number(scanner.exit, locale))}
${metric("WAIT", number(scanner.wait, locale))}
${metric("DO NOT ENTER", number(scanner.doNotEnter, locale))}
${metric("Blocked", number(scanner.blocked, locale))}
${metric("Stale", number(scanner.stale, locale))}
${metric("Avg confidence", number(scanner.averageConfidence, locale))}
${metric("Avg potential", number(scanner.averagePotentialScore, locale))}
${metric("Profitable signals", number(scanner.profitableSignals, locale))}
${metric("Failed signals", number(scanner.failedSignals, locale))}
${metric("Best scanner mode", scanner.bestScannerMode ?? "No data yet")}
${metric("Best price range", scanner.bestPriceRange ?? "No data yet")}
</div>
</section>
</div>

<div class="two" id="winners-losers">
<section class="card panel">
<h2>Largest winners</h2>
<ol>${rankingRows(winners, "No winning paper trades in this period.")}</ol>
</section>
<section class="card panel">
<h2>Largest losers</h2>
<ol>${rankingRows(losers, "No losing paper trades in this period.")}</ol>
</section>
</div>

<div class="two">
<section class="card panel"><h2>Equity curve</h2><div class="placeholder">Equity curve placeholder</div></section>
<section class="card panel"><h2>Period comparison</h2><div class="placeholder">Comparison details will appear after enough paper-trading history is available.</div></section>
</div>

<section class="card panel" id="ai-review">
<h2>AI-assisted review</h2>
<p>AI reviews scanner evidence and summarizes patterns, risks, and missing information. It cannot change scanner logic, approve its own proposals, bypass deterministic safety gates, contact a broker, or place trades.</p>
<p><strong>Testing required before changes:</strong> ${esc(aiReview.requiresBacktest === true ? "Yes" : "No")} | <strong>Manual approval required:</strong> ${esc(aiReview.requiresOperatorApproval === true ? "Yes" : "No")}</p>
${aiProposals.length
  ? aiProposals.map((proposal) => `<article class="report-row"><h3>${esc(({ data_quality: "Data freshness", signal_quality: "Signal quality", entry_logic: "Entry quality", exit_logic: "Exit timing", risk_logic: "Risk controls", ranking_logic: "Ranking quality", observation: "Review status" })[proposal?.category] ?? "Review item")} · ${esc(({ high: "Important", medium: "Review", low: "Informational" })[proposal?.severity] ?? "Informational")}</h3><p><strong>What we found:</strong> ${esc(proposal?.observation ?? "")}</p><p><strong>Suggested next step:</strong> ${esc(proposal?.proposal ?? "")}</p></article>`).join("")
  : "<p>No improvement suggestions are available for this report yet.</p>"}
</section>

<section class="card panel">
<h2>Historical Decision-Quality Proposals</h2>
<p>These are bounded review proposals generated from measured scanner outcomes. They do not change scanner logic, thresholds, accounts, or orders.</p>
<div class="grid">
${metric("Proposals found", number(decisionQualityProposals.proposalCount, locale))}
${metric("Proposals shown", number(decisionQualityProposals.returnedProposalCount, locale))}
${metric("Source review items", number(decisionQualityProposals.sourceReviewRequiredCount, locale))}
${metric("Automatic learning", decisionQualityProposals.automaticLearningAllowed === true ? "Allowed" : "Locked")}
</div>
${proposalCards}
<div class="safety-locks">
<span>Human review required</span>
<span>Separate approval required</span>
<span>No implementation included</span>
<span>No automatic patching</span>
</div>
</section>

<section class="card panel" id="calibration">
<h2>Proposal Evidence Calibration</h2>
<p>This view groups historical proposals and identifies where high-confidence scanner decisions still produced review concerns.</p>
<div class="grid">
${metric("Analyzed proposals", number(proposalCalibrationReview.analyzedProposalCount, locale))}
${metric("Proposal groups", number(proposalCalibrationReview.proposalTypeGroupCount, locale))}
${metric("Target-area groups", number(proposalCalibrationReview.targetAreaGroupCount, locale))}
${metric("Review groups", number(proposalCalibrationReview.calibrationReviewQueueCount, locale))}
${metric("Market-open evidence", proposalCalibrationReview.marketOpenObservationsOnly === true ? "Only" : "Mixed or unavailable")}
${metric("Fresh-source evidence", proposalCalibrationReview.freshSourceObservationsOnly === true ? "Only" : "Mixed or unavailable")}
</div>
${calibrationCards}
<div class="safety-locks">
<span>Historical measurement only</span>
<span>Scanner mutation locked</span>
<span>Threshold mutation locked</span>
<span>Paper-only decision assist</span>
</div>
</section>

<section class="card panel">
<h2>Calibration History</h2>
<p>This local read-only history tracks changes in proposal evidence over time. Duplicate snapshots are skipped automatically.</p>
<div class="grid">
${metric("Saved snapshots", number(proposalCalibrationHistory.recordCount, locale))}
${metric("Storage", proposalCalibrationHistory.localJsonlOnly === true ? "Local JSONL only" : "No history yet")}
${metric("Automatic learning", proposalCalibrationHistory.automaticLearningAllowed === true ? "Allowed" : "Locked")}
${metric("Scanner mutation", proposalCalibrationHistory.scannerLogicMutationAllowed === true ? "Allowed" : "Locked")}
</div>
${calibrationHistoryRows.length
  ? calibrationHistoryRows.slice(0, 10).map((row) => `<article class="report-row"><h3>${esc(formatCustomerDateTime(row.generatedAt, account))}</h3><p><strong>Analyzed proposals:</strong> ${esc(number(row.analyzedProposalCount, locale))} | <strong>Review groups:</strong> ${esc(number(row.calibrationReviewQueueCount, locale))}</p><p><strong>Proposal groups:</strong> ${esc(number(row.proposalTypeGroupCount, locale))} | <strong>Target-area groups:</strong> ${esc(number(row.targetAreaGroupCount, locale))}</p><p><strong>Market-open evidence:</strong> ${esc(row.marketOpenObservationsOnly === true ? "Only" : "Mixed or unavailable")} | <strong>Fresh-source evidence:</strong> ${esc(row.freshSourceObservationsOnly === true ? "Only" : "Mixed or unavailable")}</p></article>`).join("")
  : "<p>No calibration history snapshots are available yet.</p>"}
<div class="safety-locks">
<span>Local history only</span>
<span>Duplicate snapshots skipped</span>
<span>No automatic learning</span>
<span>No scanner mutation</span>
</div>
</section>

<section class="card panel">
<h2>Real-Time AI Review</h2>
<p>This optional review uses the current paper report only. It cannot change scanner logic, contact a broker, place orders, or modify an account.</p>
<p><strong>Status:</strong> ${esc(({
  disabled: "Disabled",
  not_configured: "Not configured",
  completed_readonly: "Completed — read only",
  empty_response: "No review returned",
  provider_error: "Provider error",
  timeout: "Timed out",
  request_failed: "Request failed",
})[realtimeAiReview.status] ?? "Not active")}</p>
${realtimeAiText
  ? `<article class="report-row"><p>${esc(realtimeAiText).replaceAll("\n", "<br>")}</p></article>`
  : "<p>No real-time AI review is available. The deterministic report review above remains active.</p>"}
<p><strong>Backtesting required:</strong> ${esc(realtimeAiReview.requiresBacktest === true ? "Yes" : "No")} | <strong>Manual approval required:</strong> ${esc(realtimeAiReview.requiresOperatorApproval === true ? "Yes" : "No")}</p>
</section>

<section class="card panel" id="detailed-activity">
<h2>Detailed activity</h2>
<div class="table-wrap">
<table>
<thead><tr><th>Time</th><th>Symbol</th><th>Action</th><th>P/L</th><th>Status</th></tr></thead>
<tbody>${activityRows}</tbody>
</table>
</div>
</section>
</main>
${renderGlobalFooter()}
</body>
</html>`;
}

export default { VERSION, buildCustomerReportsPage, renderCustomerReportsPageHtml };
