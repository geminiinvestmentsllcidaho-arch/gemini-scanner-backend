export const VERSION = "ai_logic_acceptance_evidence_binding_v1";

const LOCKS = Object.freeze({
  persistenceAllowed: false,
  promotionAllowed: false,
  rollbackExecutionAllowed: false,
  productionRuntimeWiringAllowed: false,
  brokerContactAllowed: false,
  orderPlacementAllowed: false,
  liveTradingAllowed: false,
  accountMutationAllowed: false,
  immutablePolicyMutationAllowed: false,
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const present = (v) => typeof v === "string" && v.trim().length > 0;

export function evaluateAiLogicAcceptanceEvidenceBinding(input = {}) {
  const knownGood = input.knownGood ?? {};
  const experiment = input.experiment ?? {};
  const safetyGate = input.safetyGate ?? {};
  const replay = safetyGate.replay ?? input.replay ?? {};
  const acceptance = input.acceptance ?? {};
  const reasons = [];

  if (knownGood.valid !== true) reasons.push("KNOWN_GOOD_INVALID");
  if (knownGood.status !== "KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWN_GOOD_STATUS_INVALID");
  if (knownGood.rollbackTargetIdentified !== true) reasons.push("KNOWN_GOOD_ROLLBACK_TARGET_REQUIRED");
  if (knownGood.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
  if (!present(knownGood.sourceCommit)) reasons.push("KNOWN_GOOD_SOURCE_COMMIT_REQUIRED");
  if (!present(knownGood.versionId)) reasons.push("KNOWN_GOOD_VERSION_ID_REQUIRED");
  if (!present(knownGood.logicScope)) reasons.push("KNOWN_GOOD_LOGIC_SCOPE_REQUIRED");
  if (knownGood.rollbackExecutable !== false) reasons.push("KNOWN_GOOD_ROLLBACK_EXECUTABLE_MUST_BE_FALSE");
  if (knownGood.promotionEligible !== false) reasons.push("KNOWN_GOOD_PROMOTION_ELIGIBLE_MUST_BE_FALSE");

  if (safetyGate.eligible !== true) reasons.push("SAFETY_GATE_NOT_ELIGIBLE");
  if (safetyGate.status !== "AI_LOGIC_CANDIDATE_SAFETY_GATE_ELIGIBLE") reasons.push("SAFETY_GATE_STATUS_INVALID");
  if (safetyGate.disposition !== "OFFLINE_EVIDENCE_ONLY") reasons.push("SAFETY_GATE_DISPOSITION_INVALID");

  if (replay.status !== "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE") reasons.push("REPLAY_NOT_COMPLETE");
  if (replay.disposition !== "OFFLINE_EVIDENCE_ONLY") reasons.push("REPLAY_DISPOSITION_INVALID");
  if (!present(replay.replayId)) reasons.push("REPLAY_ID_REQUIRED");
  if (!present(replay.baselineHash)) reasons.push("BASELINE_HASH_REQUIRED");
  if (!present(replay.candidateHash)) reasons.push("CANDIDATE_HASH_REQUIRED");
  if (replay.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("REPLAY_IMMUTABLE_MANIFEST_INVALID");

  if (acceptance.eligible !== true) reasons.push("ACCEPTANCE_NOT_ELIGIBLE");
  if (acceptance.status !== "AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_EVIDENCE") reasons.push("ACCEPTANCE_STATUS_INVALID");
  if (acceptance.disposition !== "OFFLINE_ACCEPTANCE_EVIDENCE_ONLY") reasons.push("ACCEPTANCE_DISPOSITION_INVALID");

  if (!present(safetyGate.candidateId) || safetyGate.candidateId !== replay.candidateId) reasons.push("CANDIDATE_ID_BINDING_MISMATCH");
  if (!present(knownGood.sourceCommit) || knownGood.sourceCommit !== experiment.sourceCommitBefore) reasons.push("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH");
  if (!present(experiment.sourceCommitAfter)) reasons.push("EXPERIMENT_SOURCE_COMMIT_AFTER_REQUIRED");
  if (experiment.immutablePolicyCompatibility?.ok !== true) reasons.push("EXPERIMENT_IMMUTABLE_COMPATIBILITY_INVALID");
  if (experiment.immutablePolicyCompatibility?.status !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("EXPERIMENT_IMMUTABLE_STATUS_INVALID");

  if (!same(experiment.baselineMetrics, replay.baselineMetrics)) reasons.push("BASELINE_METRICS_BINDING_MISMATCH");
  if (!same(experiment.candidateMetrics, replay.candidateMetrics)) reasons.push("CANDIDATE_METRICS_BINDING_MISMATCH");
  if (experiment.sampleInfo?.count !== replay.sampleCount) reasons.push("SAMPLE_COUNT_BINDING_MISMATCH");
  if (acceptance.comparison?.sampleCount !== replay.sampleCount) reasons.push("ACCEPTANCE_SAMPLE_COUNT_BINDING_MISMATCH");
  if (acceptance.comparison?.baselineAccuracy !== replay.baselineMetrics?.accuracy) reasons.push("ACCEPTANCE_BASELINE_ACCURACY_BINDING_MISMATCH");
  if (acceptance.comparison?.candidateAccuracy !== replay.candidateMetrics?.accuracy) reasons.push("ACCEPTANCE_CANDIDATE_ACCURACY_BINDING_MISMATCH");
  if (acceptance.comparison?.accuracyDelta !== replay.candidateMetrics?.accuracyDelta) reasons.push("ACCEPTANCE_ACCURACY_DELTA_BINDING_MISMATCH");
  if (acceptance.comparison?.changedCount !== replay.candidateMetrics?.changedCount) reasons.push("ACCEPTANCE_CHANGED_COUNT_BINDING_MISMATCH");

  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible ? "AI_LOGIC_ACCEPTANCE_EVIDENCE_BINDING_VALID" : "AI_LOGIC_ACCEPTANCE_EVIDENCE_BINDING_HOLD",
    disposition: eligible ? "OFFLINE_ACCEPTANCE_BINDING_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
    reasons: Object.freeze([...new Set(reasons)].sort()),
    binding: Object.freeze({
      candidateId: present(replay.candidateId) ? replay.candidateId : null,
      knownGoodRecordId: present(knownGood.recordId) ? knownGood.recordId : null,
      replayId: present(replay.replayId) ? replay.replayId : null,
      sourceCommitBefore: present(experiment.sourceCommitBefore) ? experiment.sourceCommitBefore : null,
      sourceCommitAfter: present(experiment.sourceCommitAfter) ? experiment.sourceCommitAfter : null,
    }),
    ...LOCKS,
  });
}

export default Object.freeze({ VERSION, evaluateAiLogicAcceptanceEvidenceBinding });
