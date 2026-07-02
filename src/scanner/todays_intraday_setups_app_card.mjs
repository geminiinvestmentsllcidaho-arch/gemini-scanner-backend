export const VERSION = "todays_intraday_setups_app_card_v1";

const LABELS = Object.freeze([
  "GAP_AND_GO",
  "OPENING_RANGE_BREAKOUT",
  "INTRADAY_MOMENTUM",
  "HIGH_RELATIVE_VOLUME",
  "VWAP_RECLAIM",
  "PULLBACK_CONTINUATION",
  "SCALP_CANDIDATE",
  "NO_TRADE",
]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 4) {
  const n = finite(value);
  if (n === null) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function human(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function explain(reason) {
  const map = {
    confidence_below_threshold: "Confidence is below threshold.",
    no_intraday_setup_confirmed: "No intraday setup confirmed.",
    last_price_missing: "Live last price is missing.",
    opening_range_high_break: "Opening range break confirmed.",
    positive_intraday_momentum: "Positive intraday momentum.",
    price_reclaimed_vwap: "Price reclaimed VWAP.",
    controlled_pullback_continuation: "Controlled pullback continuation.",
    liquid_low_spread_intraday_candidate: "Liquid, low-spread candidate.",
  };
  return map[String(reason)] ?? human(reason);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function refreshIntervalSec(source = {}) {
  const n = Number(source?.refreshIntervalSec);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 30;
}

function generatedAt(options = {}) {
  return options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
}

function inputSummary(inputs = {}) {
  return {
    lastPrice: round(inputs.lastPrice),
    dayOpen: round(inputs.dayOpen),
    vwap: round(inputs.vwap),
    openingRangeHigh: round(inputs.openingRangeHigh),
    relativeVolume: round(inputs.relativeVolume),
    volume: finite(inputs.volume),
    spreadPct: round(inputs.spreadPct),
    confidence: round(inputs.confidence),
    changePct: round(inputs.changePct),
    gapPct: round(inputs.gapPct),
    pullbackPct: round(inputs.pullbackPct),
  };
}

export function buildTodaysIntradaySetupsAppCard(report = {}, options = {}) {
  const candidates = list(report.candidates).map((candidate) => {
    const primarySetup = candidate?.primarySetup ?? "NO_TRADE";
    return {
      symbol: candidate?.symbol ?? null,
      detailHref: candidate?.symbol ? `/app/todays-intraday-setups/${encodeURIComponent(String(candidate.symbol).toUpperCase())}?session=regular` : null,
      status: primarySetup === "NO_TRADE" ? "NO_TRADE_READONLY" : "SETUP_CANDIDATE_READONLY",
      primarySetup,
      primarySetupText: human(primarySetup),
      setupLabels: list(candidate?.setupLabels),
      setupLabelText: list(candidate?.setupLabels).map(human),
      reasons: list(candidate?.reasons),
      reasonText: list(candidate?.reasons).map(explain),
      inputs: inputSummary(candidate?.inputs ?? {}),
      readOnly: true,
      monitorOnly: true,
      diagnosticsOnly: true,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    };
  });

  const setupCounts = {};
  for (const label of LABELS) setupCounts[label] = Number(report?.setupCounts?.[label] ?? 0);
  if (!Object.prototype.hasOwnProperty.call(report?.setupCounts ?? {}, "NO_TRADE")) {
    setupCounts.NO_TRADE = Number(report?.noTradeCount ?? setupCounts.NO_TRADE ?? 0);
  }

  const firstTrade = candidates.find((candidate) => candidate.primarySetup !== "NO_TRADE");
  const headline = firstTrade
    ? `${firstTrade.symbol}: ${firstTrade.primarySetupText}`
    : "No supported intraday setup confirmed";
  const refreshSec = refreshIntervalSec(report);
  const cardGeneratedAt = generatedAt(options);

  return {
    ok: true,
    version: VERSION,
    panelType: "mobile_app_card",
    title: "Today's Intraday Setups",
    displayState: "TODAYS_INTRADAY_SETUPS_APP_CARD_READY_READONLY",
    generatedAt: cardGeneratedAt,
    lastUpdatedAt: cardGeneratedAt,
    sourceUpdatedAt: report?.sourceTs ?? report?.ts ?? report?.generatedAt ?? null,
    autoRefreshEnabled: report?.autoRefreshEnabled !== false,
    refreshIntervalSec: refreshSec,
    refreshHint: "Refresh this read-only card to update scanner rankings and live snapshot bars.",
    sourceDisplayState: report?.displayState ?? null,
    headline,
    source: report?.source ?? null,
    intradayFeatureSource: report?.intradayFeatureSource ?? null,
    scannerHealth: report?.scannerHealth ?? null,
    rankingConfidence: report?.rankingConfidence ?? null,
    rankingCount: Number(report?.rankingCount ?? candidates.length),
    tradeCandidateCount: Number(report?.tradeCandidateCount ?? candidates.filter((c) => c.primarySetup !== "NO_TRADE").length),
    noTradeCount: Number(report?.noTradeCount ?? candidates.filter((c) => c.primarySetup === "NO_TRADE").length),
    setupCounts,
    setupChips: LABELS.map((label) => ({
      label,
      text: human(label),
      count: setupCounts[label] ?? 0,
      active: (setupCounts[label] ?? 0) > 0,
    })),
    candidates,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    brokerContactAttempted: false,
    accountMutationAttempted: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
  };
}

function renderCandidate(candidate) {
  const chips = candidate.setupLabelText.map((label) => `<span class="chip">${esc(label)}</span>`).join("");
  const reasons = candidate.reasonText.map((reason) => `<li>${esc(reason)}</li>`).join("");
  const i = candidate.inputs;
  const symbolText = esc(candidate.symbol);
  const symbolHtml = candidate.detailHref ? `<a href="${esc(candidate.detailHref)}">${symbolText}</a>` : symbolText;
  return `<article class="candidate">
<h2>${symbolHtml} <small>${esc(candidate.status)}</small></h2>
<h3>${esc(candidate.primarySetupText)}</h3>
<div>${chips}</div>
<ul>${reasons}</ul>
<table>
<tr><td>Last</td><td>${esc(i.lastPrice)}</td><td>VWAP</td><td>${esc(i.vwap)}</td></tr>
<tr><td>Change %</td><td>${esc(i.changePct)}</td><td>Rel Vol</td><td>${esc(i.relativeVolume)}</td></tr>
<tr><td>Volume</td><td>${esc(i.volume)}</td><td>Confidence</td><td>${esc(i.confidence)}</td></tr>
</table>
</article>`;
}


function renderReadOnlyAutoRefreshScript(source = {}) {
  if (source?.autoRefreshEnabled !== true) return "";
  const seconds = Number(source?.refreshIntervalSec);
  const intervalSec = Number.isFinite(seconds) && seconds > 0 ? Math.max(5, Math.round(seconds)) : 30;
  const delayMs = intervalSec * 1000;
  return `<script data-readonly-auto-refresh="true">
(() => {
  const delayMs = ${JSON.stringify(delayMs)};
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;
  window.setTimeout(() => {
    window.location.reload();
  }, delayMs);
})();
</script>`;
}

export function renderTodaysIntradaySetupsAppCardHtml(card = {}) {
  const chips = list(card.setupChips).map((chip) => `<span class="chip">${esc(chip.text)}: ${esc(chip.count)}</span>`).join("");
  const candidates = list(card.candidates).map(renderCandidate).join("") || "<p>No candidates.</p>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(card.title)}</title>
<style>
body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.candidate{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.chip{display:inline-block;background:#eee;border-radius:999px;padding:7px 10px;margin:4px;font-size:12px}.candidate h2{margin:0}.candidate h3{margin:4px 0 8px;color:#444}table{width:100%;border-collapse:collapse}td{padding:7px;border-bottom:1px solid #eee}small{font-size:11px;color:#777}
</style></head><body><main class="wrap">
<section class="hero"><h1>${esc(card.title)}</h1><p>${esc(card.headline)}</p><p>${esc(card.displayState)}</p></section>
<section class="card"><b>Last updated:</b> ${esc(card.lastUpdatedAt)} | Refresh: ${esc(card.refreshIntervalSec ?? 30)}s<br><b>Source:</b> ${esc(card.source)} | <b>Features: </b> ${esc(card.intradayFeatureSource)}<br><b>Rankings:</b> ${esc(card.rankingCount)} | <b>Setup candidates:</b> ${esc(card.tradeCandidateCount)} | <b>No trade:</b> ${esc(card.noTradeCount)}</section>
<section class="card">${chips}</section>
${candidates}
<section class="card"><b>No execution controls:</b> ${esc(card.noExecutionControls)}<br><b>Order submitted:</b> ${esc(card.orderSubmitted)}<br><b>Broker contact attempted:</b> ${esc(card.brokerContactAttempted)}<br><b>Account mutation attempted:</b> ${esc(card.accountMutationAttempted)}</section>
${renderReadOnlyAutoRefreshScript(card)}
</main></body></html>`;
}
