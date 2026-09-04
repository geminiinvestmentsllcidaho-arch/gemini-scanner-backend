export const VERSION = "ai_logic_shadow_entry_binding_v1";

const LOCKS = Object.freeze({
  productionRuntimeWiringAllowed: false,
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
  gitMutationAllowed: false,
});

const present = (v) => typeof v === "string" && v.trim().length > 0;

export function evaluateAiLogicShadowEntryBinding(input = {}) {
  const pre = input.preShadowEvidence ?? {};
  const acceptanceEvidence = input.acceptanceEvidence ?? {};
  const acceptance = acceptanceEvidence.binding ?? acceptanceEvidence;
  const reasons = [];

  if (acceptanceEvidence.binding) {
    if (acceptanceEvidence.eligible !== true) reasons.push("PRE_SHADOW_ACCEPTANCE_BINDING_INVALID");
    if (acceptanceEvidence.status !== "AI_LOGIC_PRE_SHADOW_ACCEPTANCE_EVIDENCE_BINDING_VALID") reasons.push("PRE_SHADOW_ACCEPTANCE_BINDING_STATUS_INVALID");
    if (acceptanceEvidence.disposition !== "OFFLINE_PRE_SHADOW_ACCEPTANCE_BINDING_EVIDENCE_ONLY") reasons.push("PRE_SHADOW_ACCEPTANCE_BINDING_DISPOSITION_INVALID");
  }

  if (pre.valid !== true) reasons.push("PRE_SHADOW_EVIDENCE_INVALID");
  if (pre.stage !== "OFFLINE_PRE_SHADOW") reasons.push("PRE_SHADOW_STAGE_INVALID");
  if (pre.status !== "AI_LOGIC_PRE_SHADOW_EXPERIMENT_EVIDENCE_VALID") reasons.push("PRE_SHADOW_STATUS_INVALID");
  if (pre.disposition !== "OFFLINE_PRE_SHADOW_EVIDENCE_ONLY") reasons.push("PRE_SHADOW_DISPOSITION_INVALID");
  if (pre.shadowResultsAllowed !== false || pre.shadowComplete !== false) reasons.push("PRE_SHADOW_CLAIMS_SHADOW_STATE");
  if (!pre.binding || typeof pre.binding !== "object") reasons.push("PRE_SHADOW_BINDING_REQUIRED");

  const p = pre.binding ?? {};
  const keys = ["knownGoodRecordId","candidateId","candidateSourceHash","replayId","sourceCommitBefore","sourceCommitAfter"];
  for (const key of keys) {
    if (!present(p[key])) reasons.push(`PRE_SHADOW_${key.toUpperCase()}_REQUIRED`);
  }

  for (const key of keys) {
    if (acceptance[key] !== p[key]) reasons.push(`SHADOW_ENTRY_${key.toUpperCase()}_MISMATCH`);
  }

  for (const key of Object.keys(LOCKS)) {
    if (pre[key] !== false) reasons.push(`PRE_SHADOW_${key.toUpperCase()}_MUST_BE_FALSE`);
  }

  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible ? "AI_LOGIC_SHADOW_ENTRY_BINDING_VALID" : "AI_LOGIC_SHADOW_ENTRY_BINDING_HOLD",
    disposition: eligible ? "SHADOW_ENTRY_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
    reasons: Object.freeze([...new Set(reasons)].sort()),
    binding: Object.freeze({
      knownGoodRecordId: present(p.knownGoodRecordId) ? p.knownGoodRecordId : null,
      candidateId: present(p.candidateId) ? p.candidateId : null,
      candidateSourceHash: present(p.candidateSourceHash) ? p.candidateSourceHash : null,
      replayId: present(p.replayId) ? p.replayId : null,
      sourceCommitBefore: present(p.sourceCommitBefore) ? p.sourceCommitBefore : null,
      sourceCommitAfter: present(p.sourceCommitAfter) ? p.sourceCommitAfter : null,
    }),
    ...LOCKS,
  });
}

export default Object.freeze({ VERSION, evaluateAiLogicShadowEntryBinding });
