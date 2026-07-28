import { formatCustomerDateTime } from "./customer_time.mjs";

export const VERSION = "customer_zero_decision_cards_v1";

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

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stateClass(value) {
  return String(value ?? "NO_SETUP").toLowerCase().replaceAll("_", "-");
}

function stateLabel(value) {
  return String(value ?? "NO_SETUP").replaceAll("_", " ");
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
  };
  return labels[issue] ?? issue.replaceAll("_", " ").toLowerCase();
}

function allocationWarningLabel(value) {
  const warning = String(value ?? "").trim().toUpperCase();
  const labels = {
    BUYING_POWER_UNAVAILABLE: "Paper buying power is unavailable.",
    AVAILABLE_FUNDS_PCT_CAPPED_AT_80: "Available funds percentage was capped at 80%.",
    MAX_DOLLARS_INVALID: "Maximum dollars per stock must be greater than $0.",
    MAX_DOLLARS_EXCEEDS_BUYING_POWER: "Maximum dollars per stock exceeds paper buying power.",
    STALE_DATA_BLOCKED: "Allocation preview is blocked because scanner data is stale.",
    PRICE_UNAVAILABLE: "A current price is unavailable.",
    WHOLE_SHARE_QUANTITY_ZERO: "The calculated amount is not enough for one whole share.",
  };
  return labels[warning] ?? warning.replaceAll("_", " ").toLowerCase();
}

export function buildCustomerZeroDecisionCards(candidates = []) {
  return list(candidates).map((candidate) => {
    const state = candidate?.sourceStale === true ? "STALE_DATA" : candidate?.resultState ?? candidate?.decision ?? "NO_SETUP";
    const staleReasons = list(candidate?.staleReasons);
    const reasons = [
      candidate?.briefExplanation,
      ...staleReasons.map(issueLabel),
      ...list(candidate?.blockingFlags),
      ...list(candidate?.readonlyPotentialFlags),
    ].filter(Boolean);

    return {
      symbol: candidate?.symbol ?? null,
      name: candidate?.name ?? null,
      state,
      stateLabel: stateLabel(state),
      stateClass: stateClass(state),
      price: number(candidate?.price),
      sourceTs: candidate?.sourceTs ?? null,
      sourceAgeSec: number(candidate?.sourceAgeSec),
      stale: candidate?.sourceStale === true || state === "STALE_DATA",
      staleReasons,
      setupName: candidate?.readonlyPotentialLabel ?? "unclassified",
      confidence: number(candidate?.readonlyPotentialScore),
      reasons,
      detailHref: candidate?.detailHref ?? null,
      allocationPreview: candidate?.allocationPreview ?? null,
      paperEnterExitGate: candidate?.paperEnterExitGate ?? null,
      readOnly: true,
      executionAllowed: false,
    };
  });
}

export function renderCustomerZeroDecisionCardsHtml(cards = [], account = null) {
  return list(cards).map((card) => `
<article class="decision-card state-${esc(card.stateClass)}">
  <div class="decision-card-head">
    <div>
      <h2>${esc(card.symbol)}</h2>
      ${card.name ? `<p class="company-name">${esc(card.name)}</p>` : ""}
    </div>
    <span class="state-badge">${esc(card.stateLabel)}</span>
  </div>
  <div class="decision-grid">
    <p><b>Price</b><span>${esc(card.price ?? "Unavailable")}</span></p>
    <p><b>Freshness</b><span>${card.stale ? "STALE — BLOCKED" : `${esc(card.sourceAgeSec ?? "Unknown")}s old`}</span></p>
    <p><b>Setup</b><span>${esc(String(card.setupName ?? "unclassified").replaceAll("_", " "))}</span></p>
    <p><b>Confidence</b><span>${esc(card.confidence ?? "Unavailable")}</span></p>
  </div>
  <p class="timestamp"><b>Data timestamp:</b> ${esc(formatCustomerDateTime(card.sourceTs, account, { fallback: "Unavailable" }))}</p>
  <div class="reasons"><b>Why:</b><ul>${card.reasons.length ? card.reasons.map((reason) => `<li>${esc(reason)}</li>`).join("") : "<li>No explanation available.</li>"}</ul></div>
  ${card.allocationPreview ? `<section class="allocation-preview"><b>Read-only allocation preview</b><div class="decision-grid"><p><b>Funds %</b><span>${esc(card.allocationPreview.controls?.availableFundsPct ?? "Unavailable")}%</span></p><p><b>Max per stock</b><span>$${esc(card.allocationPreview.controls?.maxDollarsPerStock ?? "Unavailable")}</span></p><p><b>Calculated amount</b><span>$${esc(card.allocationPreview.preview?.estimatedOrderNotional ?? 0)}</span></p><p><b>Whole shares</b><span>${esc(card.allocationPreview.preview?.estimatedWholeShares ?? 0)}</span></p></div><p class="timestamp">${card.allocationPreview.preview?.ready ? "Preview calculated. No order will be placed." : `Preview blocked: ${esc(list(card.allocationPreview.warnings).map(allocationWarningLabel).join(" ") || "Unavailable")}`}</p></section>` : ""}
  ${card.paperEnterExitGate?.exit?.visible ? `<section class="paper-control-preview exit-control-preview"><b>EXIT control preview</b><p class="paper-control priority-red">${esc(card.paperEnterExitGate.exit.label)}</p><p>Quantity: ${esc(card.paperEnterExitGate.exit.quantityPreview)} | Confirmation required: ${esc(card.paperEnterExitGate.exit.confirmationRequired)}</p><p>${card.paperEnterExitGate.exit.ready ? "All preview gates passed." : `Blocked: ${esc(card.paperEnterExitGate.exit.blockedReasons?.join(", ") || "Unavailable")}`}</p><p>No broker contact or order placement.</p></section>` : ""}
  ${card.paperEnterExitGate?.enter?.visible ? `<section class="paper-control-preview enter-control-preview"><b>ENTER control preview</b><p class="paper-control bright-green">${esc(card.paperEnterExitGate.enter.label)}</p><p>Quantity: ${esc(card.paperEnterExitGate.enter.quantityPreview)} | Confirmation required: ${esc(card.paperEnterExitGate.enter.confirmationRequired)}</p><p>${card.paperEnterExitGate.enter.ready ? "All preview gates passed." : `Blocked: ${esc(card.paperEnterExitGate.enter.blockedReasons?.join(", ") || "Unavailable")}`}</p><p>No broker contact or order placement.</p></section>` : ""}
  ${card.detailHref ? `<a class="detail-link" href="${esc(card.detailHref)}">Open decision details</a>` : ""}
</article>`).join("") || '<section class="card"><p>No scanner decisions match the selected filters.</p></section>';
}
