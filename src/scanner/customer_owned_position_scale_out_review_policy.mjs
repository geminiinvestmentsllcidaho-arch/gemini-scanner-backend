import { calculateScaleOutTarget } from "./automatic_position_target_allocation_policy.mjs";
export const VERSION = "customer_owned_position_scale_out_review_policy_v1";

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const list = (value) => Array.isArray(value) ? value : [];
const stateOf = (candidate = {}) =>
  String(candidate?.resultState ?? candidate?.decision ?? "NO_SETUP").toUpperCase();

function ownedReturnPct(position = {}, candidate = {}) {
  const supplied = finite(candidate?.ownedReturnPct);
  if (supplied !== null) return supplied;
  const alpaca = finite(position?.unrealizedPlpc ?? position?.unrealized_plpc);
  if (alpaca !== null) return alpaca * 100;
  const entry = finite(position?.averageEntryPrice ?? position?.avgEntryPrice ?? position?.avg_entry_price);
  const current = finite(candidate?.price ?? candidate?.currentPrice ?? position?.currentPrice ?? position?.current_price);
  return entry !== null && entry > 0 && current !== null ? ((current - entry) / entry) * 100 : null;
}

export function applyOwnedPositionScaleOutReviewPolicy(candidate = {}, position = {}) {
  const state = stateOf(candidate);
  const returnPct = ownedReturnPct(position, candidate);
  const sourceAgeSec = finite(candidate?.sourceAgeSec);
  const maxSourceAgeSec = finite(candidate?.maxSourceAgeSec ?? candidate?.sourceMaxAgeSec) ?? 180;
  const sourceFresh = candidate?.sourceStale === false && sourceAgeSec !== null && sourceAgeSec <= maxSourceAgeSec;
  const score = finite(candidate?.readonlyPotentialScore);
  const changePct = finite(candidate?.changePct);
  const flags = list(candidate?.readonlyPotentialFlags).map((value) => String(value ?? "").trim().toLowerCase());
  const weakeningMomentum = flags.includes("negative_momentum") || (changePct !== null && changePct <= -0.25);
  const qty = finite(position?.qty);
  const review = state !== "EXIT" && sourceFresh && qty !== null && qty >= 2 && returnPct !== null && returnPct >= 2 && score !== null && score < 70 && weakeningMomentum;
  const suggestedFraction = review ? (returnPct >= 5 || score < 55 ? 0.5 : 0.25) : null;
  const targetAllocation = review
    ? calculateScaleOutTarget({
        accountEquity: candidate?.paperAccountEquity,
        currentQuantity: qty,
        currentPrice: candidate?.price ?? candidate?.currentPrice ?? position?.currentPrice ?? position?.current_price,
        reductionFraction: suggestedFraction,
      })
    : null;
  const suggestedQty = targetAllocation?.ok === true
    ? targetAllocation.reduceQuantity
    : (review ? Math.max(1, Math.min(qty - 1, Math.floor(qty * suggestedFraction))) : null);

  return Object.freeze({
    ...candidate,
    ownedReturnPct: returnPct,
    ownedScaleOutReviewTriggered: review,
    ownedScaleOutReviewReason: review ? "OWNED_POSITION_PROFIT_PROTECTION_REVIEW" : null,
    ownedScaleOutReviewPolicyVersion: VERSION,
    ownedScaleOutSuggestedFraction: suggestedFraction,
    ownedScaleOutSuggestedQty: suggestedQty,
    ownedScaleOutTargetAllocation: targetAllocation,
    ownedScaleOutResultingQuantity: targetAllocation?.ok === true ? targetAllocation.remainingQuantity : null,
    ownedScaleOutResultingAllocationPercent: targetAllocation?.resultingAllocationPercent ?? null,
    automaticScaleOutAllowed: false,
    readOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}
