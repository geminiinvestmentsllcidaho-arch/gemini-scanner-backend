export const VERSION = "ai_logic_rollback_execution_authority_contract_v1";

const present = (v) => typeof v === "string" && v.trim().length > 0;
const REQUIRED_FALSE = Object.freeze([
  "productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
  "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed",
  "orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
  "immutablePolicyMutationAllowed","thresholdMutationAllowed",
  "sizingMutationAllowed","allocationMutationAllowed",
]);

export function buildAiLogicRollbackExecutionAuthorityContract({
  rollbackEvidence,
  operatorApproval,
  currentSourceCommit,
  immutableManifest,
  knownGood,
} = {}) {
  const reasons = [];
  if (rollbackEvidence?.version !== "ai_logic_rollback_decision_evidence_store_v1") reasons.push("ROLLBACK_EVIDENCE_VERSION_INVALID");
  if (rollbackEvidence?.localJsonlOnly !== true) reasons.push("ROLLBACK_EVIDENCE_LOCAL_JSONL_ONLY_REQUIRED");
  if (rollbackEvidence?.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("ROLLBACK_EVIDENCE_IMMUTABLE_MANIFEST_INVALID");
  if (rollbackEvidence?.rollbackTargetIdentified !== true || rollbackEvidence?.rollbackDecisionEvidenceOnly !== true) reasons.push("ROLLBACK_EVIDENCE_TARGET_INVALID");
  for (const k of REQUIRED_FALSE) if (rollbackEvidence?.[k] !== false) reasons.push(`ROLLBACK_EVIDENCE_${k.toUpperCase()}_LOCK_INVALID`);

  const fields = ["recordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter"];
  for (const k of fields) if (!present(rollbackEvidence?.[k])) reasons.push(`ROLLBACK_EVIDENCE_${k.toUpperCase()}_REQUIRED`);

  if (operatorApproval?.explicitlyApproved !== true) reasons.push("OPERATOR_APPROVAL_REQUIRED");
  if (operatorApproval?.oneShot !== true) reasons.push("OPERATOR_APPROVAL_ONE_SHOT_REQUIRED");
  if (operatorApproval?.paperOnly !== true) reasons.push("OPERATOR_APPROVAL_PAPER_ONLY_REQUIRED");
  if (operatorApproval?.noLiveTradingAcknowledged !== true) reasons.push("OPERATOR_APPROVAL_NO_LIVE_TRADING_ACK_REQUIRED");
  if (operatorApproval?.noImmutablePolicyMutationAcknowledged !== true) reasons.push("OPERATOR_APPROVAL_NO_IMMUTABLE_MUTATION_ACK_REQUIRED");

  const bindings = [
    ["rollbackDecisionRecordId","recordId"],
    ["candidateId","candidateId"],
    ["knownGoodRecordId","knownGoodRecordId"],
    ["replayId","replayId"],
    ["sourceCommitBefore","sourceCommitBefore"],
    ["sourceCommitAfter","sourceCommitAfter"],
  ];
  for (const [a,e] of bindings) {
    if (!present(operatorApproval?.[a])) reasons.push(`OPERATOR_APPROVAL_${a.toUpperCase()}_REQUIRED`);
    else if (operatorApproval[a] !== rollbackEvidence?.[e]) reasons.push(`OPERATOR_APPROVAL_${a.toUpperCase()}_MISMATCH`);
  }

  if (immutableManifest?.ok !== true || immutableManifest?.status !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("IMMUTABLE_MANIFEST_REVALIDATION_FAILED");
  if (knownGood?.valid !== true || knownGood?.status !== "KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWN_GOOD_REVALIDATION_FAILED");
  if (knownGood?.recordId !== rollbackEvidence?.knownGoodRecordId) reasons.push("KNOWN_GOOD_RECORD_ID_MISMATCH");
  if (knownGood?.sourceCommit !== rollbackEvidence?.sourceCommitBefore) reasons.push("KNOWN_GOOD_SOURCE_COMMIT_MISMATCH");
  if (!present(currentSourceCommit) || currentSourceCommit !== rollbackEvidence?.sourceCommitAfter) reasons.push("CURRENT_SOURCE_COMMIT_DRIFT");

  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible ? "AI_LOGIC_ROLLBACK_EXECUTION_AUTHORITY_REVIEW_READY" : "AI_LOGIC_ROLLBACK_EXECUTION_AUTHORITY_HOLD",
    disposition: eligible ? "OPERATOR_APPROVED_ROLLBACK_AUTHORITY_EVIDENCE_ONLY" : "ROLLBACK_AUTHORITY_BLOCKED",
    reasons: Object.freeze(reasons),
    rollbackDecisionRecordId: rollbackEvidence?.recordId ?? null,
    candidateId: rollbackEvidence?.candidateId ?? null,
    knownGoodRecordId: rollbackEvidence?.knownGoodRecordId ?? null,
    replayId: rollbackEvidence?.replayId ?? null,
    currentSourceCommit: present(currentSourceCommit) ? currentSourceCommit : null,
    targetSourceCommit: rollbackEvidence?.sourceCommitBefore ?? null,
    sourceCommitAfter: rollbackEvidence?.sourceCommitAfter ?? null,
    exactKnownGoodTargetRequired: true,
    preExecutionRevalidationComplete: eligible,
    operatorApprovalRequired: true,
    operatorApprovalIdentityBound: true,
    oneShotIdempotencyRequired: true,
    auditEvidenceRequired: true,
    paperOnly: true,
    autonomousRollbackAllowed: false,
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
    gitCheckoutAllowed: false,
    gitResetAllowed: false,
    gitRevertAllowed: false,
  });
}

export default Object.freeze({ VERSION, buildAiLogicRollbackExecutionAuthorityContract });
