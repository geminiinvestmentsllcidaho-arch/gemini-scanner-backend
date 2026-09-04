import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_shadow_probation_consumer_v1";

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

export function evaluateAiLogicShadowProbationEvidence(input = {}) {
  const acceptance = input.acceptanceEvidence ?? {};
  const knownGood = input.knownGood ?? {};
  const shadow = input.shadowProbationEvidence ?? {};
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
  if (knownGood.recordId !== acceptance.knownGoodRecordId) reasons.push("KNOWN_GOOD_RECORD_BINDING_MISMATCH");
  if (knownGood.sourceCommit !== acceptance.sourceCommitBefore) reasons.push("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH");
  if (knownGood.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
  if (shadow.status !== "SHADOW_PROBATION_EVIDENCE_COMPLETE") reasons.push("SHADOW_PROBATION_EVIDENCE_NOT_COMPLETE");
  if (!Number.isInteger(shadow.sampleCount) || shadow.sampleCount < 1) reasons.push("SHADOW_PROBATION_SAMPLE_COUNT_REQUIRED");
  if (shadow.candidateId !== acceptance.candidateId) reasons.push("SHADOW_CANDIDATE_BINDING_MISMATCH");
  if (shadow.candidateSourceHash !== acceptance.candidateSourceHash) reasons.push("SHADOW_CANDIDATE_SOURCE_HASH_MISMATCH");
  if (shadow.knownGoodRecordId !== acceptance.knownGoodRecordId) reasons.push("SHADOW_KNOWN_GOOD_BINDING_MISMATCH");
  if (shadow.acceptanceRecordId !== acceptance.recordId) reasons.push("SHADOW_ACCEPTANCE_RECORD_BINDING_MISMATCH");
  if (shadow.replayId !== acceptance.replayId) reasons.push("SHADOW_REPLAY_BINDING_MISMATCH");
  if (shadow.sourceCommitBefore !== acceptance.sourceCommitBefore) reasons.push("SHADOW_SOURCE_COMMIT_BEFORE_MISMATCH");
  if (shadow.sourceCommitAfter !== acceptance.sourceCommitAfter) reasons.push("SHADOW_SOURCE_COMMIT_AFTER_MISMATCH");
  if (shadow.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("SHADOW_IMMUTABLE_MANIFEST_INVALID");

  for (const key of Object.keys(LOCKS)) {
    if (acceptance[key] !== false || knownGood[key] === true || shadow[key] !== false || input[key] === true) {
      reasons.push(`MUTATION_LOCK_NOT_CLOSED_${key.toUpperCase()}`);
    }
  }

  const accepted = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    accepted,
    status: accepted
      ? "AI_LOGIC_SHADOW_PROBATION_ASSESSMENT_EVIDENCE"
      : "AI_LOGIC_SHADOW_PROBATION_ASSESSMENT_HOLD",
    disposition: accepted ? "ISOLATED_PROBATION_ASSESSMENT_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
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
    shadowEvidence: Object.freeze({
      status: present(shadow.status) ? shadow.status : null,
      sampleCount: Number.isInteger(shadow.sampleCount) ? shadow.sampleCount : null,
    }),
    immutableManifestStatus: manifest.status,
    ...LOCKS,
  });
}

export default Object.freeze({ VERSION, evaluateAiLogicShadowProbationEvidence });
