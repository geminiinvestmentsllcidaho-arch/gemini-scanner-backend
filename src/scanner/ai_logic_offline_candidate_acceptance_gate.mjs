export const VERSION = "ai_logic_offline_candidate_acceptance_gate_v1";

const LOCKS = Object.freeze({
  productionRuntimeWiringAllowed: false,
  persistenceAllowed: false,
  promotionAllowed: false,
  rollbackExecutionAllowed: false,
  brokerContactAllowed: false,
  orderPlacementAllowed: false,
  liveTradingAllowed: false,
  accountMutationAllowed: false,
  immutablePolicyMutationAllowed: false,
  thresholdMutationAllowed: false,
  sizingMutationAllowed: false,
  allocationMutationAllowed: false,
});

const finite = (v) => typeof v === "number" && Number.isFinite(v);

export function evaluateAiLogicOfflineCandidateAcceptance(safetyGateResult = {}) {
  const replay = safetyGateResult?.replay ?? {};
  const baseline = replay?.baselineMetrics ?? null;
  const candidate = replay?.candidateMetrics ?? null;
  const reasons = [];

  if (safetyGateResult?.eligible !== true) reasons.push("SAFETY_GATE_NOT_ELIGIBLE");
  if (safetyGateResult?.disposition !== "OFFLINE_EVIDENCE_ONLY") reasons.push("SAFETY_GATE_DISPOSITION_INVALID");
  if (!(Number.isInteger(replay?.sampleCount) && replay.sampleCount > 0)) reasons.push("REPLAY_EVIDENCE_REQUIRED");
  if (!baseline) reasons.push("BASELINE_METRICS_REQUIRED");
  if (!candidate) reasons.push("CANDIDATE_METRICS_REQUIRED");

  const ba = baseline?.accuracy;
  const ca = candidate?.accuracy;
  const delta = candidate?.accuracyDelta;
  const changed = candidate?.changedCount;

  if (!finite(ba)) reasons.push("BASELINE_ACCURACY_REQUIRED");
  if (!finite(ca)) reasons.push("CANDIDATE_ACCURACY_REQUIRED");
  if (!finite(delta)) reasons.push("ACCURACY_DELTA_REQUIRED");
  if (!(Number.isInteger(changed) && changed >= 0)) reasons.push("CHANGED_COUNT_INVALID");

  const evidenceValid = reasons.length === 0;
  const accepted = evidenceValid && ca >= ba && delta >= 0;
  if (evidenceValid && !accepted) reasons.push("CANDIDATE_UNDERPERFORMS_BASELINE");

  return Object.freeze({
    version: VERSION,
    eligible: accepted,
    status: accepted
      ? "AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_EVIDENCE"
      : "AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_HOLD",
    disposition: accepted ? "OFFLINE_ACCEPTANCE_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
    reasons: Object.freeze([...new Set(reasons)].sort()),
    comparison: Object.freeze({
      sampleCount: replay?.sampleCount ?? null,
      baselineAccuracy: finite(ba) ? ba : null,
      candidateAccuracy: finite(ca) ? ca : null,
      accuracyDelta: finite(delta) ? delta : null,
      changedCount: Number.isInteger(changed) && changed >= 0 ? changed : null,
      candidateAtLeastBaseline: finite(ba) && finite(ca) ? ca >= ba : null,
      nonnegativeAccuracyDelta: finite(delta) ? delta >= 0 : null,
    }),
    ...LOCKS,
  });
}

export default Object.freeze({
  VERSION,
  evaluateAiLogicOfflineCandidateAcceptance,
});
