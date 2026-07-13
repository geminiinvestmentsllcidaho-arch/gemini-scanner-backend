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
  ${card.detailHref ? `<a class="detail-link" href="${esc(card.detailHref)}">Open decision details</a>` : ""}
</article>`).join("") || '<section class="card"><p>No scanner decisions match the selected filters.</p></section>';
}
