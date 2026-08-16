export const VERSION = "paper_auto_execution_exit_decision_v1";

const upper = (value) => String(value ?? "").trim().toUpperCase();
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const text = (value) => String(value ?? "").trim();

function evidenceStale(candidate = {}) {
  const sourceAgeSec = finite(candidate?.sourceAgeSec);
  const maxSourceAgeSec = finite(candidate?.maxSourceAgeSec);
  return candidate?.sourceStale === true
    || (sourceAgeSec !== null && maxSourceAgeSec !== null && sourceAgeSec > maxSourceAgeSec);
}

function hold(base, status, reasonCodes = []) {
  return Object.freeze({
    ...base,
    decision: "HOLD",
    exitRequired: false,
    status,
    reasonCodes: Object.freeze([...reasonCodes]),
  });
}

export function buildAuthoritativePaperExitDecision({
  lifecycle = {},
  brokerPosition = {},
  candidate = {},
  observedAt = null,
} = {}) {
  const lifecycleId = text(lifecycle?.lifecycleId) || null;
  const symbol = upper(lifecycle?.selectedSymbol) || null;
  const lifecycleQty = finite(lifecycle?.filledQuantity);
  const brokerSymbol = upper(brokerPosition?.symbol) || null;
  const brokerQty = finite(brokerPosition?.qty ?? brokerPosition?.quantity);
  const brokerPositionIdentity = text(lifecycle?.brokerPositionIdentity) || null;
  const expectedIdentity = symbol && lifecycleQty !== null ? `${symbol}:${lifecycleQty}` : null;
  const candidateSymbol = upper(candidate?.symbol) || null;
  const sourceAgeSec = finite(candidate?.sourceAgeSec);
  const maxSourceAgeSec = finite(candidate?.maxSourceAgeSec);
  const stale = evidenceStale(candidate);
  const sourceObservedAt = text(candidate?.observedAt ?? candidate?.sourceObservedAt ?? candidate?.fetchedAt) || null;

  const base = Object.freeze({
    version: VERSION,
    paperOnly: true,
    liveTradingAllowed: false,
    lifecycleId,
    symbol,
    brokerPositionIdentity,
    quantity: lifecycleQty,
    observedAt: text(observedAt) || sourceObservedAt,
    freshness: Object.freeze({
      fresh: !stale,
      stale,
      sourceAgeSec,
      maxSourceAgeSec,
    }),
    protectiveExit: false,
    strategyExit: false,
    priority: "normal",
    severity: "normal",
    sourceEvidence: Object.freeze({
      source: text(candidate?.source) || "customer_owned_position_monitor_source",
      symbol: candidateSymbol,
      resultState: upper(candidate?.resultState) || null,
      decision: upper(candidate?.decision) || null,
      ownedExitReviewTriggered: candidate?.ownedExitReviewTriggered === true,
      ownedExitReviewReason: text(candidate?.ownedExitReviewReason) || null,
      policyVersion: text(candidate?.ownedExitReviewPolicyVersion ?? candidate?.policyVersion) || null,
      sourceCoverage: text(candidate?.sourceCoverage) || null,
      sourceStale: candidate?.sourceStale === true,
      sourceAgeSec,
      maxSourceAgeSec,
    }),
  });

  if (lifecycle?.scannerEvidence?.paperOnly === false || lifecycle?.paperOnly === false) {
    return hold(base, "FAIL_CLOSED_NON_PAPER_LIFECYCLE", ["NON_PAPER_LIFECYCLE"]);
  }
  if (upper(lifecycle?.state) !== "MONITORING") {
    return hold(base, "FAIL_CLOSED_LIFECYCLE_NOT_MONITORING", ["LIFECYCLE_NOT_MONITORING"]);
  }
  if (!lifecycleId || !symbol || !(lifecycleQty > 0) || !brokerPositionIdentity || brokerPositionIdentity !== expectedIdentity) {
    return hold(base, "FAIL_CLOSED_LIFECYCLE_IDENTITY_INVALID", ["LIFECYCLE_IDENTITY_INVALID"]);
  }
  if (brokerSymbol !== symbol || brokerQty !== lifecycleQty) {
    return hold(base, "FAIL_CLOSED_BROKER_POSITION_MISMATCH", ["BROKER_POSITION_MISMATCH"]);
  }
  if (!candidateSymbol || candidateSymbol !== symbol) {
    return hold(base, "OWNED_EXIT_CANDIDATE_REQUIRED", ["OWNED_EXIT_CANDIDATE_REQUIRED"]);
  }
  if (base.freshness.stale) {
    return hold(base, "STALE_EXIT_EVIDENCE_SUPPRESSED", ["STALE_EXIT_EVIDENCE"]);
  }

  const resultState = upper(candidate?.resultState ?? candidate?.decision);
  const triggered = candidate?.ownedExitReviewTriggered === true;
  const reason = text(candidate?.ownedExitReviewReason);

  if (!(triggered && resultState === "EXIT")) {
    return hold(base, "MONITORING_HOLD", []);
  }

  const authoritativeReason = reason || "OWNED_POSITION_EXIT_REVIEW_TRIGGERED";
  return Object.freeze({
    ...base,
    decision: "EXIT",
    exitRequired: true,
    status: "AUTHORITATIVE_PAPER_EXIT",
    reasonCodes: Object.freeze([authoritativeReason]),
    strategyExit: true,
  });
}

export default {
  VERSION,
  buildAuthoritativePaperExitDecision,
};
