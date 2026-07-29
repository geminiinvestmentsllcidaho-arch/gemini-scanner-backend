export const VERSION = "customer_owned_position_scale_in_review_policy_v1";

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const stateOf = (candidate = {}) =>
  String(candidate?.resultState ?? candidate?.decision ?? "NO_SETUP").toUpperCase();
const flagsOf = (candidate = {}) =>
  Array.isArray(candidate?.readonlyPotentialFlags)
    ? candidate.readonlyPotentialFlags.map((value) => String(value))
    : [];

function ownedReturnPct(position = {}, candidate = {}) {
  const supplied = finite(candidate?.ownedReturnPct);
  if (supplied !== null) return supplied;
  const alpaca = finite(position?.unrealizedPlpc);
  if (alpaca !== null) return alpaca * 100;
  const entry = finite(position?.averageEntryPrice ?? position?.avgEntryPrice);
  const current = finite(
    position?.currentPrice ??
    position?.current_price ??
    candidate?.currentPrice ??
    candidate?.price
  );
  return entry !== null && entry > 0 && current !== null
    ? ((current - entry) / entry) * 100
    : null;
}

export function applyOwnedPositionScaleInReviewPolicy(candidate = {}, position = {}) {
  const state = stateOf(candidate);
  const returnPct = ownedReturnPct(position, candidate);
  const sourceAgeSec = finite(candidate?.sourceAgeSec);
  const maxSourceAgeSec =
    finite(candidate?.maxSourceAgeSec ?? candidate?.sourceMaxAgeSec) ?? 180;
  const sourceFresh =
    candidate?.sourceStale === false &&
    sourceAgeSec !== null &&
    sourceAgeSec <= maxSourceAgeSec;
  const score = finite(candidate?.readonlyPotentialScore);
  const changePct = finite(candidate?.changePct);
  const positiveMomentum =
    !flagsOf(candidate).includes("negative_momentum") &&
    changePct !== null &&
    changePct >= 0.5;

  const review =
    state === "ENTER" &&
    sourceFresh &&
    returnPct !== null &&
    returnPct >= 1 &&
    score !== null &&
    score >= 75 &&
    positiveMomentum;

  return Object.freeze({
    ...candidate,
    resultState: review ? "ENTER" : (state === "ENTER" ? "WAIT" : candidate?.resultState),
    decision: review ? "ENTER" : (state === "ENTER" ? "WAIT" : candidate?.decision),
    ownedReturnPct: returnPct,
    ownedScaleInReviewTriggered: review,
    ownedScaleInReviewReason: review
      ? "OWNED_POSITION_CONFIRMED_STRENGTH_REVIEW"
      : null,
    ownedScaleInReviewPolicyVersion: VERSION,
    automaticScaleInAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}
