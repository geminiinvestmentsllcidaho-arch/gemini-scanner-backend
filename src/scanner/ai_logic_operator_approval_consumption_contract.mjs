export const VERSION = "ai_logic_operator_approval_consumption_record_v1";
const present = (v) => typeof v === "string" && v.trim().length > 0;
export function buildAiLogicOperatorApprovalConsumptionRecord({
  approvalRecord,
  currentSourceCommit,
  targetSourceCommit,
  now,
  alreadyConsumed = false,
  immutableManifest,
} = {}) {
  const reasons = [];
  if (approvalRecord?.version !== "ai_logic_operator_approval_record_v1" || approvalRecord?.valid !== true) reasons.push("APPROVAL_RECORD_INVALID");
  if (approvalRecord?.explicitlyApproved !== true || approvalRecord?.oneShot !== true) reasons.push("APPROVAL_NOT_ONE_SHOT_EXPLICIT");
  if (!present(approvalRecord?.recordId) || !present(approvalRecord?.nonce) || !present(approvalRecord?.decisionRecordId) || !present(approvalRecord?.candidateSourceHash)) reasons.push("APPROVAL_IDENTITY_INCOMPLETE");
  if (alreadyConsumed === true) reasons.push("APPROVAL_ALREADY_CONSUMED");
  const nowMs = Date.parse(now ?? "");
  const expMs = Date.parse(approvalRecord?.expiresAt ?? "");
  if (!Number.isFinite(nowMs) || !Number.isFinite(expMs) || nowMs >= expMs) reasons.push("APPROVAL_EXPIRED_OR_TIME_INVALID");
  if (immutableManifest?.ok !== true || immutableManifest?.status !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("IMMUTABLE_MANIFEST_REVALIDATION_FAILED");
  const expectedCurrent = approvalRecord?.action === "PROMOTION" ? approvalRecord?.sourceCommitBefore : approvalRecord?.sourceCommitAfter;
  const expectedTarget = approvalRecord?.action === "PROMOTION" ? approvalRecord?.sourceCommitAfter : approvalRecord?.sourceCommitBefore;
  if (!present(currentSourceCommit) || currentSourceCommit !== expectedCurrent) reasons.push("CURRENT_SOURCE_COMMIT_DRIFT");
  if (!present(targetSourceCommit) || targetSourceCommit !== expectedTarget) reasons.push("TARGET_SOURCE_COMMIT_DRIFT");
  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible ? "AI_LOGIC_OPERATOR_APPROVAL_CONSUMPTION_READY" : "AI_LOGIC_OPERATOR_APPROVAL_CONSUMPTION_HOLD",
    disposition: eligible ? "ONE_SHOT_CONSUMPTION_EVIDENCE_ONLY" : "CONSUMPTION_BLOCKED",
    reasons: Object.freeze(reasons),
    approvalRecordId: approvalRecord?.recordId ?? null,
    nonce: approvalRecord?.nonce ?? null,
    action: approvalRecord?.action ?? null,
    decisionRecordId: approvalRecord?.decisionRecordId ?? null,
    candidateSourceHash: approvalRecord?.candidateSourceHash ?? null,
    currentSourceCommit: present(currentSourceCommit) ? currentSourceCommit : null,
    targetSourceCommit: present(targetSourceCommit) ? targetSourceCommit : null,
    oneShot: true,
    atomicConsumptionRequired: true,
    exactlyOnceRequired: true,
    auditEvidenceRequired: true,
    paperOnly: true,
    productionRuntimeWiringAllowed: false,
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
    gitMutationAllowed: false,
  });
}
