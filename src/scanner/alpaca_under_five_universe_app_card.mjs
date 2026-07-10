export const VERSION = "alpaca_under_five_universe_app_card_v1";

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
  return Number.isFinite(n) && n > 0 ? Math.max(5, Math.round(n)) : 30;
}

export function buildAlpacaUnderFiveUniverseAppCard(source = {}, options = {}) {
  const candidates = list(source.candidates).map((candidate) => ({
    symbol: candidate?.symbol ?? null,
    name: candidate?.name ?? null,
    price: round(candidate?.price),
    dailyVolume: finite(candidate?.dailyVolume),
    dollarVolume: round(candidate?.dollarVolume, 2),
    previousClose: round(candidate?.previousClose),
    changePct: round(candidate?.changePct),
    spreadPct: round(candidate?.spreadPct),
    sourceTs: candidate?.sourceTs ?? null,
    sourceAgeSec: round(candidate?.sourceAgeSec, 3),
    sourceStale: candidate?.sourceStale === true,
    readonlyPotentialScore: round(candidate?.readonlyPotentialScore, 2),
    readonlyPotentialLabel: candidate?.readonlyPotentialLabel ?? "low_priority",
    readonlyPotentialFlags: list(candidate?.readonlyPotentialFlags),
    decision: candidate?.decision ?? "DO_NOT_ENTER",
    briefExplanation: candidate?.briefExplanation ?? "Do not enter: decision data is unavailable.",
    blockingFlags: list(candidate?.blockingFlags),
    detailHref: candidate?.symbol
      ? `/customer-zero/under-five-scanner/${encodeURIComponent(String(candidate.symbol).toUpperCase())}`
      : null,
    decisionAssistOnly: true,
    buyRecommendation: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  }));

  const generatedAt = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  const refreshSec = refreshIntervalSec(options);

  return {
    ok: source?.ok === true,
    version: VERSION,
    panelType: "mobile_app_card",
    title: "Under $5 Read-Only Potential",
    displayState: source?.status === "connected_readonly"
      ? "UNDER_FIVE_READONLY_APP_CARD_CONNECTED"
      : "UNDER_FIVE_READONLY_APP_CARD_NOT_CONNECTED",
    generatedAt,
    lastUpdatedAt: generatedAt,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: refreshSec,
    sourceVersion: source?.version ?? null,
    sourceStatus: source?.status ?? null,
    assetCount: Number(source?.assetCount ?? 0),
    snapshotCount: Number(source?.snapshotCount ?? 0),
    candidateCount: Number(source?.candidateCount ?? candidates.length),
    candidates,
    marketClock: {
      isOpen: source?.marketClock?.isOpen === true,
      timestamp: source?.marketClock?.timestamp ?? null,
      nextOpen: source?.marketClock?.nextOpen ?? null,
      nextClose: source?.marketClock?.nextClose ?? null,
    },
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    decisionAssistOnly: true,
    noExecutionControls: true,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    brokerContactAttempted: false,
    accountMutationAttempted: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  };
}

export function renderAlpacaUnderFiveUniverseAppCardHtml(card = {}) {
  const decisionClass = (decision) =>
    String(decision ?? "DO_NOT_ENTER").toLowerCase().replaceAll("_", "-");
  const decisionLabel = (decision) =>
    String(decision ?? "DO_NOT_ENTER").replaceAll("_", " ");

  const rows = list(card.candidates).map((candidate) => `
<article class="candidate">
<div class="candidate-head">
  <h2>${esc(candidate.symbol)} <small>${esc(candidate.readonlyPotentialLabel)}</small></h2>
  <details class="decision-popover ${esc(decisionClass(candidate.decision))}">
    <summary title="${esc(candidate.briefExplanation)}">${esc(decisionLabel(candidate.decision))}</summary>
    <p>${esc(candidate.briefExplanation)}</p>
  </details>
</div>
<p><b>Price:</b> ${esc(candidate.price)} | <b>Change:</b> ${esc(candidate.changePct)}% | <b>Spread:</b> ${esc(candidate.spreadPct)}%</p>
<p><b>Dollar volume:</b> ${esc(candidate.dollarVolume)} | <b>Source age:</b> ${esc(candidate.sourceAgeSec)}s | <b>Stale:</b> ${esc(candidate.sourceStale)}</p>
<p><b>Read-only potential score:</b> ${esc(candidate.readonlyPotentialScore)}</p>
<p><b>Flags:</b> ${esc(candidate.readonlyPotentialFlags.join(", ") || "none")}</p>
${candidate.detailHref ? `<p><a class="detail-link" href="${esc(candidate.detailHref)}">Tap for more information</a></p>` : ""}
<p><b>Decision assist only:</b> ${esc(candidate.decisionAssistOnly)} | <b>Buy recommendation:</b> ${esc(candidate.buyRecommendation)}</p>
</article>`).join("") || "<p>No under-$5 candidates available.</p>";

  const refreshSec = refreshIntervalSec(card);
  const autoRefresh = card.autoRefreshEnabled === true
    ? `<script data-readonly-auto-refresh="true">
(() => {
  const totalSec = ${JSON.stringify(refreshSec)};
  const countdown = document.querySelector("[data-refresh-countdown]");
  const marketStatus = document.querySelector("[data-market-status]");
  const marketIsOpen = ${JSON.stringify(card?.marketClock?.isOpen === true)};
  const nextCloseMs = Date.parse(${JSON.stringify(card?.marketClock?.nextClose ?? "")});

  const formatDuration = (milliseconds) => {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours + " hours, " + minutes + " minutes, " + seconds + " seconds until market closes";
  };

  const renderMarketStatus = () => {
    if (!marketStatus) return;
    if (!marketIsOpen || !Number.isFinite(nextCloseMs)) {
      marketStatus.textContent = "Market closed";
      return;
    }
    const remainingMs = nextCloseMs - Date.now();
    marketStatus.textContent = remainingMs > 0
      ? "Market open — " + formatDuration(remainingMs)
      : "Market closed";
  };

  renderMarketStatus();
  window.setInterval(renderMarketStatus, 1000);

  if (!Number.isFinite(totalSec) || totalSec <= 0) return;
  let remainingSec = totalSec;
  const render = () => {
    if (countdown) countdown.textContent = String(Math.max(0, remainingSec));
  };
  render();
  const timer = window.setInterval(() => {
    remainingSec -= 1;
    render();
    if (remainingSec <= 0) {
      window.clearInterval(timer);
      window.location.reload();
    }
  }, 1000);
})();
</script>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(card.title)}</title>
<style>
body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.candidate{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.candidate h2{margin:0}.candidate-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.candidate-head h2{flex:1}small{font-size:11px;color:#777}.decision-popover{min-width:138px}.decision-popover summary{cursor:pointer;list-style:none;border-radius:999px;padding:10px 13px;font-weight:800;text-align:center}.decision-popover summary::-webkit-details-marker{display:none}.decision-popover p{margin:8px 0 0;padding:10px;border-radius:12px;background:#f4f6f8;font-size:.92rem}.decision-popover.enter summary{background:#dff7e7;color:#11652e}.decision-popover.wait summary{background:#fff2c8;color:#765800}.decision-popover.do-not-enter summary{background:#ffe0e0;color:#8a1111}.detail-link{display:block;text-align:center;padding:12px;border-radius:12px;background:#111;color:#fff;text-decoration:none;font-weight:800}@media(hover:hover){.decision-popover:not([open]):hover p{display:block}.decision-popover:not([open]) p{display:none}}
</style></head><body><main class="wrap">
<section class="hero"><h1>${esc(card.title)}</h1><p>${esc(card.displayState)}</p><p class="market-status"><b>Market status:</b> <span data-market-status>${card?.marketClock?.isOpen === true ? "Market open" : "Market closed"}</span></p><p class="refresh-countdown"><b>Next refresh in:</b> <span data-refresh-countdown>${esc(card.refreshIntervalSec)}</span> seconds</p></section>
<section class="card"><b>Last updated:</b> ${esc(card.lastUpdatedAt)} | <b>Refresh:</b> ${esc(card.refreshIntervalSec)}s<br><b>Assets:</b> ${esc(card.assetCount)} | <b>Snapshots:</b> ${esc(card.snapshotCount)} | <b>Candidates:</b> ${esc(card.candidateCount)}</section>
${rows}
<section class="card"><b>No execution controls:</b> ${esc(card.noExecutionControls)}<br><b>Order submitted:</b> ${esc(card.orderSubmitted)}<br><b>Broker contact attempted:</b> ${esc(card.brokerContactAttempted)}<br><b>Account mutation attempted:</b> ${esc(card.accountMutationAttempted)}</section>
${autoRefresh}
</main></body></html>`;
}
