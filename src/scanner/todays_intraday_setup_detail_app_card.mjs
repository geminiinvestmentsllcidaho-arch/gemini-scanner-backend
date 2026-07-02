export const VERSION = "todays_intraday_setup_detail_app_card_v1";

const SAFETY = Object.freeze({
  readOnly: true,
  monitorOnly: true,
  diagnosticsOnly: true,
  noExecutionControls: true,
  decisionAssistOnly: true,
  orderPlacementAllowed: false,
  orderSubmitAllowed: false,
  brokerContactAllowed: false,
  accountMutationAllowed: false,
  liveTradingAllowed: false,
  autoTradingAllowed: false,
  retryAllowed: false,
  orderSubmitAttempted: false,
  orderSubmitted: false,
  brokerContactAttempted: false,
  accountMutationAttempted: false,
});

export const DEFAULT_DETAIL_THRESHOLDS = Object.freeze({
  minConfidence: 0.55,
  minMomentumPct: 0.75,
  minGapPct: 1.25,
  minRelativeVolume: 2,
  minVolume: 100000,
  maxSpreadPct: 0.35,
  maxPullbackPct: 1.75,
});

function isoNow(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function labelText(value) {
  return safeText(value)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeSymbol(value) {
  return safeText(value).trim().toUpperCase();
}

function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

function sanitizeInputs(inputs = {}) {
  const out = {};
  for (const [key, value] of Object.entries(inputs ?? {})) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "string") out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else if (value === null) out[key] = null;
  }
  return out;
}

function refreshIntervalSec(source = {}) {
  const n = Number(source?.refreshIntervalSec);
  return Number.isFinite(n) && n > 0 ? Math.max(5, Math.round(n)) : 30;
}

function buildCandidateDetail(candidate = null) {
  if (!candidate) {
    return {
      found: false,
      status: "SYMBOL_NOT_FOUND_READONLY",
      primarySetup: "NO_TRADE",
      primarySetupText: "No Trade",
      setupLabels: ["NO_TRADE"],
      setupLabelText: ["No Trade"],
      reasons: ["symbol_not_found_in_current_intraday_setup_card"],
      reasonText: ["Symbol was not found in the current read-only intraday setup card."],
      inputs: {},
      noTradeExplanation: ["Symbol was not found in the current read-only intraday setup card."],
      ...SAFETY,
    };
  }

  const primarySetup = safeText(candidate.primarySetup, "NO_TRADE");
  const status = safeText(candidate.status, primarySetup === "NO_TRADE" ? "NO_TRADE_READONLY" : "SETUP_CANDIDATE_READONLY");
  const setupLabels = asList(candidate.setupLabels).map((x) => safeText(x));
  const setupLabelText = asList(candidate.setupLabelText).map((x, idx) => safeText(x, labelText(setupLabels[idx])));
  const reasons = asList(candidate.reasons).map((x) => safeText(x));
  const reasonText = asList(candidate.reasonText).map((x) => safeText(x));
  const isNoTrade = primarySetup === "NO_TRADE" || status.includes("NO_TRADE");

  return {
    found: true,
    symbol: normalizeSymbol(candidate.symbol),
    status,
    primarySetup,
    primarySetupText: safeText(candidate.primarySetupText, labelText(primarySetup)),
    setupLabels: setupLabels.length ? setupLabels : [primarySetup],
    setupLabelText: setupLabelText.length ? setupLabelText : [labelText(primarySetup)],
    reasons,
    reasonText,
    inputs: sanitizeInputs(candidate.inputs),
    noTradeExplanation: isNoTrade ? (reasonText.length ? reasonText : reasons.map(labelText)) : [],
    ...SAFETY,
  };
}

export function buildTodaysIntradaySetupDetailAppCard(card = {}, options = {}) {
  const requestedSymbol = normalizeSymbol(options.symbol ?? options.ticker ?? card?.symbol);
  const candidates = asList(card.candidates);
  const candidate = requestedSymbol
    ? candidates.find((entry) => normalizeSymbol(entry?.symbol) === requestedSymbol)
    : candidates[0] ?? null;
  const detail = buildCandidateDetail(candidate);
  const symbol = requestedSymbol || detail.symbol || "";
  const generatedAt = isoNow(options.now ?? new Date());
  const refreshSec = refreshIntervalSec(card);

  return {
    ok: true,
    version: VERSION,
    panelType: "mobile_app_detail_card",
    title: symbol ? `Today's Intraday Setup Detail: ${symbol}` : "Today's Intraday Setup Detail",
    displayState: detail.found ? "TODAYS_INTRADAY_SETUP_DETAIL_READY_READONLY" : "TODAYS_INTRADAY_SETUP_DETAIL_SYMBOL_NOT_FOUND_READONLY",
    headline: detail.found ? `${detail.symbol}: ${detail.primarySetupText}` : `${symbol || "Symbol"}: Not Found`,
    requestedSymbol: symbol,
    symbol: detail.symbol ?? symbol,
    found: detail.found,
    source: safeText(card.source, "scanner_rankings"),
    intradayFeatureSource: safeText(card.intradayFeatureSource, "live_snapshot_bars"),
    generatedAt,
    lastUpdatedAt: safeText(card.lastUpdatedAt, generatedAt),
    sourceUpdatedAt: Object.prototype.hasOwnProperty.call(card, "sourceUpdatedAt") ? card.sourceUpdatedAt : null,
    autoRefreshEnabled: card.autoRefreshEnabled === false ? false : true,
    refreshIntervalSec: refreshSec,
    rankingCount: Number.isFinite(Number(card.rankingCount)) ? Number(card.rankingCount) : candidates.length,
    availableSymbols: candidates.map((entry) => normalizeSymbol(entry?.symbol)).filter(Boolean),
    thresholds: { ...DEFAULT_DETAIL_THRESHOLDS,...(options.thresholds ?? {}) },
    detail,
    ...SAFETY,
  };
}

function esc(value) {
  return safeText(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[ch]);
}

export function renderTodaysIntradaySetupDetailAppCardHtml(detailCard = {}) {
  const detail = detailCard.detail ?? {};
  const inputs = detail.inputs ?? {};
  const refreshSec = refreshIntervalSec(detailCard);
  const delayMs = refreshSec * 1000;

  const labelChips = asList(detail.setupLabelText?.length ? detail.setupLabelText : detail.setupLabels)
    .map((label) => `<span class="chip">${esc(labelText(label))}</span>`)
    .join("");

  const reasonItems = asList(detail.reasonText?.length ? detail.reasonText : detail.reasons)
    .map((reason) => `<li>${esc(reason)}</li>`)
    .join("") || "<li>No detail reason available.</li>";

  const noTradeItems = asList(detail.noTradeExplanation)
    .map((reason) => `<li>${esc(reason)}</li>`)
    .join("");

  const inputRows = Object.entries(inputs)
    .map(([key, value]) => `<tr><td>${esc(labelText(key))}</td><td>${esc(value)}</td></tr>`)
    .join("") || "<tr><td>No live feature inputs available.</td><td></td></tr>";

  const thresholdRows = Object.entries(detailCard.thresholds ?? {})
    .map(([key, value]) => `<tr><td>${esc(labelText(key))}</td><td>${esc(value)}</td></tr>`)
    .join("");

  const availableLinks = asList(detailCard.availableSymbols)
    .map((symbol) => `<a href="/app/todays-intraday-setups/${encodeURIComponent(symbol)}?session=regular">${esc(symbol)}</a>`)
    .join(" ") || "No symbols available.";

  const noTradeBlock = noTradeItems
    ? `<section class="card"><h2>NO_TRADE Explanation</h2><ul>${noTradeItems}</ul></section>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(detailCard.title)}</title>
<style>
body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:820px;margin:auto}.hero,.card{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.chip,a{display:inline-block;background:#eee;border-radius:999px;padding:7px 10px;margin:4px;font-size:12px;color:#111;text-decoration:none}table{width:100%;border-collapse:collapse}td{padding:7px;border-bottom:1px solid #eee}
</style></head><body><main class="wrap">
<section class="hero"><h1>${esc(detailCard.title)}</h1><p>${esc(detailCard.headline)}</p><p>${esc(detailCard.displayState)}</p><p>Last updated: ${esc(detailCard.lastUpdatedAt)} | Refresh: ${esc(refreshSec)}s</p></section>
<section class="card"><b>Symbol:</b> ${esc(detailCard.symbol)}<br><b>Status:</b> ${esc(detail.status)}<br><b>Primary setup:</b> ${esc(detail.primarySetupText)}<br><b>Source:</b> ${esc(detailCard.source)} | <b>Features:</b> ${esc(detailCard.intradayFeatureSource)}</section>
<section class="card"><h2>Setup Labels</h2>${labelChips}</section>
<section class="card"><h2>Reasons</h2><ul>${reasonItems}</ul></section>
${noTradeBlock}
<section class="card"><h2>Live Feature Inputs</h2><table>${inputRows}</table></section>
<section class="card"><h2>Thresholds</h2><table>${thresholdRows}</table></section>
<section class="card"><h2>Other Symbols</h2>${availableLinks}</section>
<section class="card"><b>No execution controls:</b> ${esc(detailCard.noExecutionControls)}<br><b>Order submitted:</b> ${esc(detailCard.orderSubmitted)}<br><b>Broker contact attempted:</b> ${esc(detailCard.brokerContactAttempted)}<br><b>Account mutation attempted:</b> ${esc(detailCard.accountMutationAttempted)}</section>
<script data-readonly-auto-refresh="true">
(() => {
  const delayMs = ${JSON.stringify(delayMs)};
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;
  window.setTimeout(() => {
    window.location.reload();
  }, delayMs);
})();
</script>
</main></body></html>`;
}
