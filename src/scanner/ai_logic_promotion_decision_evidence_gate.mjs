import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_promotion_decision_evidence_gate_v1";

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

export function evaluateAiLogicPromotionDecisionEvidence(input = {}) {
  const acceptance = input.acceptanceEvidence ?? {};
  const knownGood = input.knownGood ?? {};
  const assessment = input.shadowAssessment ?? {};
  const manifest = verifyImmutablePolicyManifest();
  const reasons = [];

  if (manifest.ok !== true || manifest.status !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("IMMUTABLE_MANIFEST_NOT_VERIFIED");
  if (acceptance.version !== "ai_logic_acceptance_evidence_store_v1") reasons.push("ACCEPTANCE_EVIDENCE_VERSION_INVALID");
  for (const key of ["recordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"]) {
    if (!present(acceptance[key])) reasons.push(`ACCEPTANCE_${key.toUpperCase()}_REQUIRED`);
  }
  if (acceptance.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("ACCEPTANCE_IMMUTABLE_MANIFEST_INVALID");
  if (acceptance.localJsonlOnly !== true) reasons.push("ACCEPTANCE_LOCAL_JSONL_ONLY_REQUIRED");
  if (knownGood.valid !== true || knownGood.status !== "KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWN_GOOD_INVALID");
  if (knownGood.rollbackTargetIdentified !== true) reasons.push("KNOWN_GOOD_ROLLBACK_TARGET_REQUIRED");
  if (knownGood.rollbackExecutable !== false || knownGood.promotionEligible !== false || knownGood.strategySwitchingAllowed !== false) reasons.push("KNOWN_GOOD_EXECUTION_LOCK_INVALID");
  if (knownGood.recordId !== acceptance.knownGoodRecordId) reasons.push("KNOWN_GOOD_RECORD_BINDING_MISMATCH");
  if (knownGood.sourceCommit !== acceptance.sourceCommitBefore) reasons.push("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH");
  if (knownGood.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
  if (assessment.version !== "ai_logic_shadow_probation_consumer_v1") reasons.push("SHADOW_ASSESSMENT_VERSION_INVALID");
  if (assessment.accepted !== true || assessment.status !== "AI_LOGIC_SHADOW_PROBATION_ASSESSMENT_EVIDENCE") reasons.push("SHADOW_ASSESSMENT_NOT_ACCEPTED");
  if (assessment.disposition !== "ISOLATED_PROBATION_ASSESSMENT_EVIDENCE_ONLY") reasons.push("SHADOW_ASSESSMENT_DISPOSITION_INVALID");
  const b = assessment.binding ?? {};
  if (b.acceptanceRecordId !== acceptance.recordId) reasons.push("ASSESSMENT_ACCEPTANCE_BINDING_MISMATCH");
  if (b.candidateId !== acceptance.candidateId) reasons.push("ASSESSMENT_CANDIDATE_BINDING_MISMATCH");
  if (b.knownGoodRecordId !== acceptance.knownGoodRecordId) reasons.push("ASSESSMENT_KNOWN_GOOD_BINDING_MISMATCH");
  if (b.replayId !== acceptance.replayId) reasons.push("ASSESSMENT_REPLAY_BINDING_MISMATCH");
  if (b.sourceCommitBefore !== acceptance.sourceCommitBefore) reasons.push("ASSESSMENT_SOURCE_COMMIT_BEFORE_MISMATCH");
  if (b.sourceCommitAfter !== acceptance.sourceCommitAfter) reasons.push("ASSESSMENT_SOURCE_COMMIT_AFTER_MISMATCH");
  if (b.candidateSourceHash !== acceptance.candidateSourceHash) reasons.push("ASSESSMENT_CANDIDATE_SOURCE_HASH_MISMATCH");
  if (assessment.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("ASSESSMENT_IMMUTABLE_MANIFEST_INVALID");

  for (const key of Object.keys(LOCKS)) {
    if (acceptance[key] !== false || knownGood[key] === true || assessment[key] !== false || input[key] === true) {
      reasons.push(`MUTATION_LOCK_NOT_CLOSED_${key.toUpperCase()}`);
    }
  }

  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible ? "AI_LOGIC_PROMOTION_DECISION_EVIDENCE_READY" : "AI_LOGIC_PROMOTION_DECISION_EVIDENCE_HOLD",
    disposition: eligible ? "PROMOTION_DECISION_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
    reasons: Object.freeze([...new Set(reasons)].sort()),
    binding: Object.freeze({
      acceptanceRecordId: present(acceptance.recordId) ? acceptance.recordId : null,
      candidateId: present(acceptance.candidateId) ? acceptance.candidateId : null,
      knownGoodRecordId: present(acceptance.knownGoodRecordId) ? acceptance.knownGoodRecordId : null,
      replayId: present(acceptance.replayId) ? acceptance.replayId : null,
      sourceCommitBefore: present(acceptance.sourceCommitBefore) ? acceptance.sourceCommitBefore : null,
      sourceCommitAfter: present(acceptance.sourceCommitAfter) ? acceptance.sourceCommitAfter : null,
      candidateSourceHash: present(acceptance.candidateSourceHash) ? acceptance.candidateSourceHash : null,
    }),
    immutableManifestStatus: manifest.status,
    promotionExecutionAllowed: false,
    rollbackExecutionAllowed: false,
    ...LOCKS,
  });
}

export default Object.freeze({ VERSION, evaluateAiLogicPromotionDecisionEvidence });
