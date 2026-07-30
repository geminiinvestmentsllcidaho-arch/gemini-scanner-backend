export const VERSION = "customer_portfolio_wind_down_policy_v1";
function list(value) { return Array.isArray(value) ? value : []; }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function sym(value) { return String(value ?? "").trim().toUpperCase(); }
export function buildCustomerPortfolioWindDown(input = {}) {
  const active = input.exitAllRequested === true;
  const positions = list(input.positions).filter((p) => (finite(p?.qty) ?? 0) > 0 && sym(p?.symbol));
  const steps = active ? positions.map((position) => {
    const qty = finite(position.qty);
    const suggestedQty = qty <= 1 ? qty : Math.max(1, Math.floor(qty * 0.25));
    return Object.freeze({
      symbol: sym(position.symbol),
      ownedQty: qty,
      suggestedReviewQty: Math.min(qty, suggestedQty),
      remainingAfterReview: Math.max(0, qty - Math.min(qty, suggestedQty)),
      reviewOnly: true,
      automaticSaleAllowed: false,
    });
  }) : [];
  return Object.freeze({
    version: VERSION,
    status: active ? "wind_down_review_active" : "inactive",
    exitAllRequested: active,
    newBuyDecisionsBlocked: active,
    scaleInReviewsBlocked: active,
    gradualScaleOutReviewEnabled: active,
    positionsCount: positions.length,
    steps: Object.freeze(steps),
    resumeRequiresExplicitCustomerAction: true,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    automaticSaleAllowed: false,
  });
}
export default { VERSION, buildCustomerPortfolioWindDown };
