import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_shadow_probation_evidence_v1";

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

const present = (value) => typeof value === "string" && value.trim().length > 0;

export function buildAiLogicShadowProbationEvidence(input = {}) {
  const acceptance = input.acceptanceEvidence ?? {};
  const knownGood = input.knownGood ?? {};
  const observations = Array.isArray(input.observations) ? input.observations : [];
  const manifest = verifyImmutablePolicyManifest();
  const reasons = [];

  if (manifest.ok !== true || manifest.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("IMMUTABLE_MANIFEST_NOT_VERIFIED");
  }
  if (acceptance.version !== "ai_logic_acceptance_evidence_store_v1") {
    reasons.push("ACCEPTANCE_EVIDENCE_VERSION_INVALID");
  }
  if (!present(acceptance.recordId)) reasons.push("ACCEPTANCE_RECORD_ID_REQUIRED");
  if (!present(acceptance.candidateId)) reasons.push("CANDIDATE_ID_REQUIRED");
  if (!present(acceptance.knownGoodRecordId)) reasons.push("KNOWN_GOOD_RECORD_ID_REQUIRED");
  if (!present(acceptance.replayId)) reasons.push("REPLAY_ID_REQUIRED");
  if (!present(acceptance.sourceCommitBefore)) reasons.push("SOURCE_COMMIT_BEFORE_REQUIRED");
  if (!present(acceptance.sourceCommitAfter)) reasons.push("SOURCE_COMMIT_AFTER_REQUIRED");
  if (acceptance.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("ACCEPTANCE_IMMUTABLE_MANIFEST_INVALID");
  }

  if (knownGood.valid !== true) reasons.push("KNOWN_GOOD_INVALID");
  if (knownGood.status !== "KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWN_GOOD_STATUS_INVALID");
  if (!present(knownGood.recordId) || knownGood.recordId !== acceptance.knownGoodRecordId) {
    reasons.push("KNOWN_GOOD_RECORD_BINDING_MISMATCH");
  }
  if (!present(knownGood.sourceCommit) ||  knownGood.sourceCommit !== acceptance.sourceCommitBefore) {
    reasons.push("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH");
  }
  if (knownGood.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
  }

  if (observations.length < 1) reasons.push("PROBATION_OBSERVATIONS_REQUIRED");

  for (const key of Object.keys(LOCKS)) {
    if (acceptance[key] === true || knownGood[key] === true || input[key] === true) {
      reasons.push(`FORBIDDEN_PERMISSION_OPEN_${key.toUpperCase()}`);
    }
  }

  const complete = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    complete,
    status: complete ? "SHADOW_PROBATION_EVIDENCE_COMPLETE" : "SHADOW_PROBATION_EVIDENCE_HOLD",
    disposition: complete ? "SHADOW_PROBATION_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
    reasons: Object.freeze([...new Set(reasons)].sort()),
    sampleCount: observations.length,
    candidateId: present(acceptance.candidateId) ? acceptance.candidateId : null,
    knownGoodRecordId: present(acceptance.knownGoodRecordId) ? acceptance.knownGoodRecordId : null,
    acceptanceRecordId: present(acceptance.recordId) ? acceptance.recordId : null,
    replayId: present(acceptance.replayId) ? acceptance.replayId : null,
    sourceCommitBefore: present(acceptance.sourceCommitBefore) ? acceptance.sourceCommitBefore : null,
    sourceCommitAfter: present(acceptance.sourceCommitAfter) ? acceptance.sourceCommitAfter : null,
    immutableManifestStatus: manifest.status,
    observations: Object.freeze(observations.map((row, index) => Object.freeze({
      sampleId: present(row?.sampleId) ? row.sampleId.trim() : `probation-${index + 1}`,
      baseline: row?.baseline ?? null,
      candidate: row?.candidate ?? null,
      changed: row?.changed === true,
    }))),
    ...LOCKS,
  });
}

export default Object.freeze({ VERSION, buildAiLogicShadowProbationEvidence });
