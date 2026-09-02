import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_probation_eligibility_gate_v1";

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

const present = (v) => typeof v === "string" && v.trim().length > 0;

export function evaluateAiLogicProbationEligibility(input = {}) {
  const evidence = input.acceptanceEvidence ?? {};
  const knownGood = input.knownGood ?? {};
  const probation = input.probationEvidence ?? {};
  const manifest = verifyImmutablePolicyManifest();
  const reasons = [];
  if (manifest.ok !== true || manifest.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("IMMUTABLE_MANIFEST_NOT_VERIFIED");
  }

  if (evidence.version !== "ai_logic_acceptance_evidence_store_v1") {
    reasons.push("ACCEPTANCE_EVIDENCE_VERSION_INVALID");
  }
  if (!present(evidence.recordId)) reasons.push("ACCEPTANCE_RECORD_ID_REQUIRED");
  if (!present(evidence.candidateId)) reasons.push("CANDIDATE_ID_REQUIRED");
  if (!present(evidence.knownGoodRecordId)) reasons.push("KNOWN_GOOD_RECORD_ID_REQUIRED");
  if (!present(evidence.replayId)) reasons.push("REPLAY_ID_REQUIRED");
  if (!present(evidence.sourceCommitBefore)) reasons.push("SOURCE_COMMIT_BEFORE_REQUIRED");
  if (!present(evidence.sourceCommitAfter)) reasons.push("SOURCE_COMMIT_AFTER_REQUIRED");
  if (evidence.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("ACCEPTANCE_IMMUTABLE_MANIFEST_INVALID");
  }

  if (knownGood.valid !== true) reasons.push("KNOWN_GOOD_INVALID");
  if (knownGood.status !== "KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWN_GOOD_STATUS_INVALID");
  if (knownGood.rollbackTargetIdentified !== true) reasons.push("KNOWN_GOOD_ROLLBACK_TARGET_REQUIRED");
  if (!present(knownGood.recordId) || knownGood.recordId !== evidence.knownGoodRecordId) {
    reasons.push("KNOWN_GOOD_RECORD_BINDING_MISMATCH");
  }
  if (!present(knownGood.sourceCommit) || knownGood.sourceCommit !== evidence.sourceCommitBefore) {
    reasons.push("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH");
  }
  if (knownGood.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
  }

  if (probation.status !== "SHADOW_PROBATION_EVIDENCE_COMPLETE") {
    reasons.push("PROBATION_EVIDENCE_NOT_COMPLETE");
  }
  if (!Number.isInteger(probation.sampleCount) || probation.sampleCount < 1) {
    reasons.push("PROBATION_SAMPLE_COUNT_REQUIRED");
  }
  if (probation.candidateId !== evidence.candidateId) {
    reasons.push("PROBATION_CANDIDATE_BINDING_MISMATCH");
  }
  if (probation.knownGoodRecordId !== evidence.knownGoodRecordId) {
    reasons.push("PROBATION_KNOWN_GOOD_BINDING_MISMATCH");
  }
  if (probation.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("PROBATION_IMMUTABLE_MANIFEST_INVALID");
  }

  const forbiddenTrue = [
    "productionRuntimeWiringAllowed",
    "persistenceAllowed",
    "promotionAllowed",
    "rollbackExecutionAllowed",
    "brokerContactAllowed",
    "orderPlacementAllowed",
    "liveTradingAllowed",
    "accountMutationAllowed",
    "immutablePolicyMutationAllowed",
    "thresholdMutationAllowed",
    "sizingMutationAllowed",
    "allocationMutationAllowed",
  ];
  for (const key of forbiddenTrue) {
    if (evidence[key] === true || knownGood[key] === true || probation[key] === true) {
      reasons.push(`FORBIDDEN_PERMISSION_OPEN_${key.toUpperCase()}`);
    }
  }

  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible
      ? "AI_LOGIC_PROBATION_ELIGIBILITY_EVIDENCE"
      : "AI_LOGIC_PROBATION_ELIGIBILITY_HOLD",
    disposition: eligible ? "PROBATION_ELIGIBILITY_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
    reasons: Object.freeze([...new Set(reasons)].sort()),
    binding: Object.freeze({
      acceptanceRecordId: present(evidence.recordId) ? evidence.recordId : null,
      candidateId: present(evidence.candidateId) ? evidence.candidateId : null,
      knownGoodRecordId: present(evidence.knownGoodRecordId) ? evidence.knownGoodRecordId : null,
      replayId: present(evidence.replayId) ? evidence.replayId : null,
      sourceCommitBefore: present(evidence.sourceCommitBefore) ? evidence.sourceCommitBefore : null,
      sourceCommitAfter: present(evidence.sourceCommitAfter) ? evidence.sourceCommitAfter : null,
    }),
    probationEvidence: Object.freeze({
      status: present(probation.status) ? probation.status : null,
      sampleCount: Number.isInteger(probation.sampleCount) ? probation.sampleCount : null,
    }),
    immutableManifestStatus: manifest.status,
    ...LOCKS,
  });
}

export default Object.freeze({ VERSION, evaluateAiLogicProbationEligibility });
