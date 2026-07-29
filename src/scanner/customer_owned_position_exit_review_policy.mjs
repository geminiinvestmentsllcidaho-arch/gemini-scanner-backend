export const VERSION = "customer_owned_position_exit_review_policy_v1";

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const list = (value) => Array.isArray(value) ? value : [];

function ownedReturnPct(position = {}, candidate = {}) {
  const direct = finite(position?.unrealizedPlpc ?? position?.unrealized_plpc);
  if (direct !== null) return direct * 100;
  const entry = finite(position?.averageEntryPrice ?? position?.avgEntryPrice ?? position?.avg_entry_price);
  const current = finite(candidate?.price ?? candidate?.currentPrice ?? position?.currentPrice ?? position?.current_price);
  if (!(entry > 0) || current === null) return null;
  return ((current - entry) / entry) * 100;
}

export function applyOwnedPositionExitReviewPolicy(candidate = {}, position = {}) {
  const sourceAgeSec = finite(candidate?.sourceAgeSec);
  const maxSourceAgeSec = finite(candidate?.maxSourceAgeSec);
  const stale = candidate?.sourceStale === true
    || (sourceAgeSec !== null && maxSourceAgeSec !== null && sourceAgeSec > maxSourceAgeSec);
  const returnPct = ownedReturnPct(position, candidate);
  const changePct = finite(candidate?.changePct);
  const score = finite(candidate?.readonlyPotentialScore);
  const flags = list(candidate?.readonlyPotentialFlags).map((value) => String(value ?? "").trim().toLowerCase());
  const negativeMomentum = flags.includes("negative_momentum") || (changePct !== null && changePct < 0);

  let exitReview = false;
  let reason = null;
  if (!stale && returnPct !== null) {
    if (returnPct <= -3) {
      exitReview = true;
      reason = "OWNED_POSITION_HARD_LOSS_REVIEW";
    } else if (
      returnPct <= -1.5
      && changePct !== null
      && changePct <= -0.5
      && negativeMomentum
      && score !== null
      && score < 60
    ) {
      exitReview = true;
      reason = "OWNED_POSITION_CONFIRMED_DETERIORATION_REVIEW";
    }
  }

  return Object.freeze({
    ...candidate,
    resultState: exitReview ? "EXIT" : candidate?.resultState,
    decision: exitReview ? "EXIT" : candidate?.decision,
    ownedReturnPct: returnPct,
    ownedExitReviewTriggered: exitReview,
    ownedExitReviewReason: reason,
    ownedExitReviewPolicyVersion: VERSION,
    automaticExitAllowed: false,
    readOnly: true,
    paperOnly: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}
