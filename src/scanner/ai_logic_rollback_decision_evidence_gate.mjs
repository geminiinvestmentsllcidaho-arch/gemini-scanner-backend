export const VERSION = "ai_logic_rollback_decision_evidence_gate_v1";

const REQUIRED_FALSE_LOCKS = Object.freeze([
  "productionRuntimeWiringAllowed",
  "persistenceAllowed",
  "promotionAllowed",
  "promotionExecutionAllowed",
  "rollbackExecutionAllowed",
  "brokerContactAllowed",
  "orderPlacementAllowed",
  "liveTradingAllowed",
  "accountMutationAllowed",
  "immutablePolicyMutationAllowed",
  "thresholdMutationAllowed",
  "sizingMutationAllowed",
  "allocationMutationAllowed",
]);

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireClosedLocks(record, prefix, reasons) {
  for (const key of REQUIRED_FALSE_LOCKS) {
    if (record?.[key] !== false) reasons.push(`${prefix}_${key.toUpperCase()}_LOCK_INVALID`);
  }
}

export function buildAiLogicRollbackDecisionEvidence({
  promotionDecision,
  acceptanceEvidence,
  knownGood,
} = {}) {
  const reasons = [];

  if (promotionDecision?.version !== "ai_logic_promotion_decision_evidence_store_v1") {
    reasons.push("PROMOTION_DECISION_RECORD_VERSION_INVALID");
  }
  if (promotionDecision?.localJsonlOnly !== true) {
    reasons.push("PROMOTION_DECISION_LOCAL_JSONL_ONLY_REQUIRED");
  }
  if (promotionDecision?.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("PROMOTION_DECISION_IMMUTABLE_MANIFEST_INVALID");
  }
  requireClosedLocks(promotionDecision, "PROMOTION_DECISION", reasons);

  if (acceptanceEvidence?.version !== "ai_logic_acceptance_evidence_store_v1") {
    reasons.push("ACCEPTANCE_EVIDENCE_VERSION_INVALID");
  }
  if (acceptanceEvidence?.localJsonlOnly !== true) {
    reasons.push("ACCEPTANCE_LOCAL_JSONL_ONLY_REQUIRED");
  }
  if (acceptanceEvidence?.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("ACCEPTANCE_IMMUTABLE_MANIFEST_INVALID");
  }
  requireClosedLocks(acceptanceEvidence, "ACCEPTANCE", reasons);

  if (knownGood?.valid !== true || knownGood?.status !== "KNOWN_GOOD_RECORD_VALID") {
    reasons.push("KNOWN_GOOD_INVALID");
  }
  if (knownGood?.rollbackTargetIdentified !== true) {
    reasons.push("KNOWN_GOOD_ROLLBACK_TARGET_REQUIRED");
  }
  if (
    knownGood?.rollbackExecutable !== false ||
    knownGood?.promotionEligible !== false ||
    knownGood?.strategySwitchingAllowed !== false
  ) {
    reasons.push("KNOWN_GOOD_EXECUTION_LOCK_INVALID");
  }
  if (knownGood?.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
  }
  requireClosedLocks(knownGood, "KNOWN_GOOD", reasons);

  const p = promotionDecision?.binding ?? {};

  for (const key of [
    "acceptanceRecordId",
    "candidateId",
    "knownGoodRecordId",
    "replayId",
    "sourceCommitBefore",
    "sourceCommitAfter",
    "candidateSourceHash",
  ]) {
    if (!present(p[key])) reasons.push(`PROMOTION_DECISION_${key.toUpperCase()}_REQUIRED`);
  }

  if (promotionDecision?.acceptanceRecordId !== p.acceptanceRecordId) {
    reasons.push("PROMOTION_DECISION_ACCEPTANCE_RECORD_BINDING_MISMATCH");
  }
  if (promotionDecision?.candidateId !== p.candidateId) {
    reasons.push("PROMOTION_DECISION_CANDIDATE_BINDING_MISMATCH");
  }
  if (promotionDecision?.knownGoodRecordId !== p.knownGoodRecordId) {
    reasons.push("PROMOTION_DECISION_KNOWN_GOOD_BINDING_MISMATCH");
  }
  if (promotionDecision?.replayId !== p.replayId) {
    reasons.push("PROMOTION_DECISION_REPLAY_BINDING_MISMATCH");
  }
  if (promotionDecision?.sourceCommitBefore !== p.sourceCommitBefore) {
    reasons.push("PROMOTION_DECISION_SOURCE_COMMIT_BEFORE_MISMATCH");
  }
  if (promotionDecision?.sourceCommitAfter !== p.sourceCommitAfter) {
    reasons.push("PROMOTION_DECISION_SOURCE_COMMIT_AFTER_MISMATCH");
  }
  if (promotionDecision?.candidateSourceHash !== p.candidateSourceHash) {
    reasons.push("PROMOTION_DECISION_CANDIDATE_SOURCE_HASH_MISMATCH");
  }

  if (acceptanceEvidence?.recordId !== p.acceptanceRecordId) {
    reasons.push("ACCEPTANCE_RECORD_BINDING_MISMATCH");
  }
  if (acceptanceEvidence?.candidateId !== p.candidateId) {
    reasons.push("ACCEPTANCE_CANDIDATE_BINDING_MISMATCH");
  }
  if (acceptanceEvidence?.knownGoodRecordId !== p.knownGoodRecordId) {
    reasons.push("ACCEPTANCE_KNOWN_GOOD_BINDING_MISMATCH");
  }
  if (acceptanceEvidence?.replayId !== p.replayId) {
    reasons.push("ACCEPTANCE_REPLAY_BINDING_MISMATCH");
  }
  if (acceptanceEvidence?.sourceCommitBefore !== p.sourceCommitBefore) {
    reasons.push("ACCEPTANCE_SOURCE_COMMIT_BEFORE_MISMATCH");
  }
  if (acceptanceEvidence?.sourceCommitAfter !== p.sourceCommitAfter) {
    reasons.push("ACCEPTANCE_SOURCE_COMMIT_AFTER_MISMATCH");
  }
  if (acceptanceEvidence?.candidateSourceHash !== p.candidateSourceHash) {
    reasons.push("ACCEPTANCE_CANDIDATE_SOURCE_HASH_MISMATCH");
  }

  if (knownGood?.recordId !== p.knownGoodRecordId) {
    reasons.push("KNOWN_GOOD_RECORD_BINDING_MISMATCH");
  }
  if (knownGood?.sourceCommit !== p.sourceCommitBefore) {
    reasons.push("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH");
  }

  const eligible = reasons.length === 0;

  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible
      ? "AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_READY"
      : "AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_HOLD",
    disposition: eligible
      ? "ROLLBACK_DECISION_EVIDENCE_ONLY"
      : "ROLLBACK_DECISION_EVIDENCE_BLOCKED",
    reasons: Object.freeze(reasons),
    immutableManifestStatus:
      promotionDecision?.immutableManifestStatus === "IMMUTABLE_MANIFEST_VERIFIED" &&
      acceptanceEvidence?.immutableManifestStatus === "IMMUTABLE_MANIFEST_VERIFIED" &&
      knownGood?.immutableManifestStatus === "IMMUTABLE_MANIFEST_VERIFIED"
        ? "IMMUTABLE_MANIFEST_VERIFIED"
        : "IMMUTABLE_MANIFEST_INVALID",
    binding: Object.freeze({
      promotionDecisionRecordId: present(promotionDecision?.recordId)
        ? promotionDecision.recordId
        : null,
      acceptanceRecordId: present(acceptanceEvidence?.recordId)
        ? acceptanceEvidence.recordId
        : null,
      candidateId: present(acceptanceEvidence?.candidateId)
        ? acceptanceEvidence.candidateId
        : null,
      knownGoodRecordId: present(knownGood?.recordId) ? knownGood.recordId : null,
      replayId: present(acceptanceEvidence?.replayId)
        ? acceptanceEvidence.replayId
        : null,
      sourceCommitBefore: present(acceptanceEvidence?.sourceCommitBefore)
        ? acceptanceEvidence.sourceCommitBefore
        : null,
      sourceCommitAfter: present(acceptanceEvidence?.sourceCommitAfter)
        ? acceptanceEvidence.sourceCommitAfter
        : null,
      candidateSourceHash: present(acceptanceEvidence?.candidateSourceHash)
        ? acceptanceEvidence.candidateSourceHash
        : null,
    }),
    rollbackTargetIdentified: eligible,
    rollbackDecisionEvidenceOnly: true,
    productionRuntimeWiringAllowed: false,
    persistenceAllowed: false,
    promotionAllowed: false,
    promotionExecutionAllowed: false,
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
}
