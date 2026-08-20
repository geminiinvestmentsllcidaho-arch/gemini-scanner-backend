import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
import { formatCustomerDateTime } from "./customer_time.mjs";

export const VERSION = "customer_zero_under_five_symbol_detail_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function decisionLabel(value) {
  return String(value ?? "DO_NOT_ENTER").replaceAll("_", " ");
}

function issueLabel(value) {
  const issue = String(value ?? "").trim().toUpperCase();
  const labels = {
    QUOTE_STALE: "Quote data is stale.",
    RANKINGS_STALE: "Scanner rankings are stale.",
    RANKING_MISSING: "Current scanner ranking is unavailable.",
    MARKET_CLOCK_STALE: "Market session status is stale.",
    STREAM_STALE: "Live market data stream is stale.",
    STREAM_DISCONNECTED: "Live market data stream is disconnected.",
    STRATEGY_STATE_NOT_ENTER: "The setup is not currently an ENTER candidate.",
    STRATEGY_SOURCE_STALE: "The strategy source data is stale.",
    STRATEGY_RANKING_NOT_CONNECTED: "Current scanner ranking data is not connected.",
    STRATEGY_P3_GATE_NOT_OK: "The setup did not pass the required market-context check.",
    STRATEGY_SETUP_SCORE_REQUIRED: "A setup score is required before entry.",
    STRATEGY_SETUP_SCORE_BELOW_MINIMUM: "The setup score is below the required entry minimum.",
    STRATEGY_RANKING_CONFIDENCE_REQUIRED: "Ranking confidence is required before entry.",
    STRATEGY_RANKING_CONFIDENCE_BELOW_MINIMUM: "Ranking confidence is below the required entry minimum.",
    STRATEGY_RANKING_QUALITY_REQUIRED: "Ranking quality is required before entry.",
    STRATEGY_RANKING_QUALITY_BELOW_MINIMUM: "Ranking quality is below the required entry minimum.",
    LOWER_DOLLAR_VOLUME: "Dollar volume is below the stronger liquidity tier.",
  };
  return labels[issue] ?? issue.replaceAll("_", " ").toLowerCase();
}

export function buildCustomerZeroUnderFiveSymbolDetail(candidate = {}, options = {}) {
  const routeBase = String(options.routeBase ?? "/customer-zero/under-five-scanner").replace(/\/$/, "");
  const role = String(options.role ?? "customer");
  const roleLabel = String(options.roleLabel ?? "Customer");
  const tenant = String(options.tenant ?? "customer");
  const flags = list(candidate.readonlyPotentialFlags);
  const blockers = list(candidate.blockingFlags);
  const staleReasons = list(candidate.staleReasons);
  const runtimeHealthReasons = staleReasons.map(issueLabel);
  const strategyAuthorizationBlockers = list(
    candidate?.canonicalAuthorizationBlockers ?? candidate?.strategyAuthorization?.blockers
  );
  const resultState = candidate.sourceStale === true
    ? "STALE_DATA"
    : candidate.resultState ?? candidate.decision ?? "DO_NOT_ENTER";
  const sourceStale = candidate.sourceStale === true || resultState === "STALE_DATA";
  return {
    version: VERSION,
    route: candidate.symbol
      ? `${routeBase}/${encodeURIComponent(String(candidate.symbol).toUpperCase())}`
      : null,
    backHref: routeBase,
    role,
    roleLabel,
    tenant,
    title: `${candidate.symbol ?? "Unknown"} — Under $5 Scan Detail`,
    symbol: candidate.symbol ?? null,
    name: candidate.name ?? null,
    decision: resultState,
    decisionLabel: decisionLabel(resultState),
    manualDecision: candidate?.manualDecision ?? candidate?.decision ?? null,
    manualResultState: candidate?.manualResultState ?? null,
    strategyAuthorization: candidate?.strategyAuthorization ?? null,
    briefExplanation: candidate.briefExplanation ?? "Decision detail is unavailable.",
    score: candidate.readonlyPotentialScore ?? null,
    potentialLabel: candidate.readonlyPotentialLabel ?? "low_priority",
    price: candidate.price ?? null,
    previousClose: candidate.previousClose ?? null,
    changePct: candidate.changePct ?? null,
    spreadPct: candidate.spreadPct ?? null,
    dailyVolume: candidate.dailyVolume ?? null,
    dollarVolume: candidate.dollarVolume ?? null,
    sourceTs: candidate.sourceTs ?? null,
    sourceAgeSec: candidate.sourceAgeSec ?? null,
    sourceStale,
    staleReasons,
    runtimeHealthReasons,
    flags,
    blockers: [...new Set([...runtimeHealthReasons, ...blockers, ...strategyAuthorizationBlockers])],
    passedChecks: [
      sourceStale !== true ? "Freshness check passed" : null,
      Number(candidate.spreadPct) <= 1 ? "Spread check passed" : null,
      Number(candidate.dollarVolume) >= 1000000 ? "Liquidity check passed" : null,
      Number(candidate.changePct) > 0 ? "Momentum check passed" : null,
      Number(candidate.readonlyPotentialScore) >= 70 ? "Score threshold passed" : null,
    ].filter(Boolean),
    readOnly: true,
    decisionAssistOnly: true,
    noExecutionControls: true,
    buyRecommendation: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  };
}

export function renderCustomerZeroUnderFiveSymbolDetailHtml(detail = {}, account = null) {
  const passed = list(detail.passedChecks).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>None</li>";
  const flags = list(detail.flags).map((item) => `<li>${esc(issueLabel(item))}</li>`).join("") || "<li>None</li>";
  const blockers = list(detail.blockers).map((item) => `<li>${esc(issueLabel(item))}</li>`).join("") || "<li>None</li>";
  const runtimeHealth = list(detail.runtimeHealthReasons).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>None</li>";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(detail.title)}</title>
${renderGlobalThemeCss({ surface: "customer" })}
<style>
.wrap{max-width:760px;margin:auto;padding:42px 16px 72px}.card{background:rgba(0,0,0,.72)!important;color:var(--gs-text)!important;border:1px solid var(--gs-line);border-radius:18px;padding:16px;margin:12px 0;box-shadow:0 8px 22px #0008}.hero{background:rgba(0,0,0,.82)!important}.decision{display:inline-block;padding:10px 14px;border-radius:999px;font-weight:800}.enter{background:#dff7e7;color:#11652e}.wait{background:#fff2c8;color:#765800}.do-not-enter,.stale-data{background:#ffe0e0;color:#8a1111}.runtime-health-block{border-color:#ff7b7b!important}a{color:var(--gs-accent);font-weight:700}
</style></head><body data-gs-page="customer-under-five-symbol-detail">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap" data-role="${esc(detail.role ?? "customer")}" data-page="under-five-symbol-detail" data-tenant="${esc(detail.tenant ?? "customer")}">
<section class="card hero"><p><a href="${esc(detail.backHref ?? "/customer/scanner/under-five")}" style="color:white">← Back to scanner</a></p><h1>${esc(detail.title)}</h1><p><b>Role:</b> ${esc(detail.roleLabel ?? "Customer")}</p></section>
<section class="card"><span class="decision ${esc(String(detail.decision).toLowerCase().replaceAll("_","-"))}">${esc(detail.decisionLabel)}</span><p>${esc(detail.briefExplanation)}</p></section>
<section class="card"><h2>Scan results</h2>
<p><b>Score:</b> ${esc(detail.score)} · <b>Potential:</b> ${esc(detail.potentialLabel)}</p>
<p><b>Price:</b> ${esc(detail.price)} · <b>Previous close:</b> ${esc(detail.previousClose)} · <b>Change:</b> ${esc(detail.changePct)}%</p>
<p><b>Spread:</b> ${esc(detail.spreadPct)}% · <b>Daily volume:</b> ${esc(detail.dailyVolume)} · <b>Dollar volume:</b> ${esc(detail.dollarVolume)}</p>
<p><b>Data timestamp:</b> ${esc(formatCustomerDateTime(detail.sourceTs, account, { fallback: "Unavailable" }))}</p>
<p><b>Source age:</b> ${esc(detail.sourceAgeSec)}s · <b>Stale:</b> ${esc(detail.sourceStale)}</p></section>
<section class="card"><h2>Checks passed</h2><ul>${passed}</ul></section>
${detail.sourceStale ? `<section class="card runtime-health-block"><h2>Why this result is blocked</h2><p>Current data cannot be trusted for a fresh scanner decision.</p><ul>${runtimeHealth}</ul></section>` : ""}
<section class="card"><h2>Flags</h2><ul>${flags}</ul><h2>Blocking reasons</h2><ul>${blockers}</ul></section>
<section class="card"><b>Decision assist only:</b> ${esc(detail.decisionAssistOnly)}<br><b>Buy recommendation:</b> ${esc(detail.buyRecommendation)}<br><b>No execution controls:</b> ${esc(detail.noExecutionControls)}</section>
</main>
${renderGlobalFooter()}
</body></html>`;
}
