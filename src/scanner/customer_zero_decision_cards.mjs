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

export function buildCustomerZeroDecisionCards(candidates = []) {
  return list(candidates).map((candidate) => {
    const state = candidate?.sourceStale === true ? "STALE_DATA" : candidate?.resultState ?? candidate?.decision ?? "NO_SETUP";
    const reasons = [
      candidate?.briefExplanation,
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

export function renderCustomerZeroDecisionCardsHtml(cards = []) {
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
    <p><b>Setup</b><span>${esc(card.setupName)}</span></p>
    <p><b>Confidence</b><span>${esc(card.confidence ?? "Unavailable")}</span></p>
  </div>
  <p class="timestamp"><b>Data timestamp:</b> ${esc(card.sourceTs ?? "Unavailable")}</p>
  <div class="reasons"><b>Why:</b><ul>${card.reasons.length ? card.reasons.map((reason) => `<li>${esc(reason)}</li>`).join("") : "<li>No explanation available.</li>"}</ul></div>
  ${card.allocationPreview ? `<section class="allocation-preview"><b>Read-only allocation preview</b><div class="decision-grid"><p><b>Funds %</b><span>${esc(card.allocationPreview.controls?.availableFundsPct ?? "Unavailable")}%</span></p><p><b>Max per stock</b><span>$${esc(card.allocationPreview.controls?.maxDollarsPerStock ?? "Unavailable")}</span></p><p><b>Calculated amount</b><span>$${esc(card.allocationPreview.preview?.estimatedOrderNotional ?? 0)}</span></p><p><b>Whole shares</b><span>${esc(card.allocationPreview.preview?.estimatedWholeShares ?? 0)}</span></p></div><p class="timestamp">${card.allocationPreview.preview?.ready ? "Preview calculated. No order will be placed." : `Preview blocked: ${esc(card.allocationPreview.warnings?.join(", ") || "Unavailable")}`}</p></section>` : ""}
  ${card.paperEnterExitGate?.exit?.visible ? `<section class="paper-control-preview exit-control-preview"><b>EXIT control preview</b><p class="paper-control priority-red">${esc(card.paperEnterExitGate.exit.label)}</p><p>Quantity: ${esc(card.paperEnterExitGate.exit.quantityPreview)} | Confirmation required: ${esc(card.paperEnterExitGate.exit.confirmationRequired)}</p><p>${card.paperEnterExitGate.exit.ready ? "All preview gates passed." : `Blocked: ${esc(card.paperEnterExitGate.exit.blockedReasons?.join(", ") || "Unavailable")}`}</p><p>No broker contact or order placement.</p></section>` : ""}
  ${card.paperEnterExitGate?.enter?.visible ? `<section class="paper-control-preview enter-control-preview"><b>ENTER control preview</b><p class="paper-control bright-green">${esc(card.paperEnterExitGate.enter.label)}</p><p>Quantity: ${esc(card.paperEnterExitGate.enter.quantityPreview)} | Confirmation required: ${esc(card.paperEnterExitGate.enter.confirmationRequired)}</p><p>${card.paperEnterExitGate.enter.ready ? "All preview gates passed." : `Blocked: ${esc(card.paperEnterExitGate.enter.blockedReasons?.join(", ") || "Unavailable")}`}</p><p>No broker contact or order placement.</p></section>` : ""}
  ${card.detailHref ? `<a class="detail-link" href="${esc(card.detailHref)}">Open decision details</a>` : ""}
</article>`).join("") || '<section class="card"><p>No scanner decisions match the selected filters.</p></section>';
}
