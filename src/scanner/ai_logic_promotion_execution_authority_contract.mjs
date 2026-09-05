export const VERSION = "ai_logic_promotion_execution_authority_contract_v1";

const present = (v) => typeof v === "string" && v.trim().length > 0;
const REQUIRED_FALSE = Object.freeze([
  "productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
  "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed",
  "orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
  "immutablePolicyMutationAllowed","thresholdMutationAllowed",
  "sizingMutationAllowed","allocationMutationAllowed",
]);

export function buildAiLogicPromotionExecutionAuthorityContract({
  promotionEvidence,
  operatorApproval,
  currentSourceCommit,
  immutableManifest,
  knownGood,
} = {}) {
  const reasons = [];
  if (promotionEvidence?.version !== "ai_logic_promotion_decision_evidence_store_v1") reasons.push("PROMOTION_EVIDENCE_VERSION_INVALID");
  if (promotionEvidence?.localJsonlOnly !== true) reasons.push("PROMOTION_EVIDENCE_LOCAL_JSONL_ONLY_REQUIRED");
  if (promotionEvidence?.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("PROMOTION_EVIDENCE_IMMUTABLE_MANIFEST_INVALID");
  for (const k of REQUIRED_FALSE) if (promotionEvidence?.[k] !== false) reasons.push(`PROMOTION_EVIDENCE_${k.toUpperCase()}_LOCK_INVALID`);

  const fields = ["recordId","acceptanceRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"];
  for (const k of fields) if (!present(promotionEvidence?.[k])) reasons.push(`PROMOTION_EVIDENCE_${k.toUpperCase()}_REQUIRED`);

  if (operatorApproval?.explicitlyApproved !== true) reasons.push("OPERATOR_APPROVAL_REQUIRED");
  if (operatorApproval?.oneShot !== true) reasons.push("OPERATOR_APPROVAL_ONE_SHOT_REQUIRED");
  if (operatorApproval?.paperOnly !== true) reasons.push("OPERATOR_APPROVAL_PAPER_ONLY_REQUIRED");
  if (operatorApproval?.noLiveTradingAcknowledged !== true) reasons.push("OPERATOR_APPROVAL_NO_LIVE_TRADING_ACK_REQUIRED");
  if (operatorApproval?.noImmutablePolicyMutationAcknowledged !== true) reasons.push("OPERATOR_APPROVAL_NO_IMMUTABLE_MUTATION_ACK_REQUIRED");

  const bindings = [
    ["promotionDecisionRecordId","recordId"],
    ["acceptanceRecordId","acceptanceRecordId"],
    ["candidateId","candidateId"],
    ["knownGoodRecordId","knownGoodRecordId"],
    ["replayId","replayId"],
    ["sourceCommitBefore","sourceCommitBefore"],
    ["sourceCommitAfter","sourceCommitAfter"],
    ["candidateSourceHash","candidateSourceHash"],
  ];
  for (const [a,e] of bindings) {
    if (!present(operatorApproval?.[a])) reasons.push(`OPERATOR_APPROVAL_${a.toUpperCase()}_REQUIRED`);
    else if (operatorApproval[a] !== promotionEvidence?.[e]) reasons.push(`OPERATOR_APPROVAL_${a.toUpperCase()}_MISMATCH`);
  }

  if (immutableManifest?.ok !== true || immutableManifest?.status !== "IMMUTABLE_MANIFEST_VERIFIED") reasons.push("IMMUTABLE_MANIFEST_REVALIDATION_FAILED");
  if (knownGood?.valid !== true || knownGood?.status !== "KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWNGOOD_REVALIDATION_FAILED");
  if (knownGood?.recordId !== promotionEvidence?.knownGoodRecordId) reasons.push("KNOWN_GOOD_RECORD_ID_MISMATCH");
  if (knownGood?.sourceCommit !== promotionEvidence?.sourceCommitBefore) reasons.push("KNOWN_GOOD_SOURCE_COMMIT_MISMATCH");
  if (!present(currentSourceCommit) || currentSourceCommit !== promotionEvidence?.sourceCommitBefore) reasons.push("CURRENT_SOURCE_COMMIT_DRIFT");

  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible ? "AI_LOGIC_PROMOTION_EXECUTION_AUTHORITY_REVIEW_READY" : "AI_LOGIC_PROMOTION_EXECUTION_AUTHORITY_HOLD",
    disposition: eligible ? "OPERATOR_APPROVED_PROMOTION_AUTHORITY_EVIDENCE_ONLY" : "PROMOTION_AUTHORITY_BLOCKED",
    reasons: Object.freeze(reasons),
    promotionDecisionRecordId: promotionEvidence?.recordId ?? null,
    acceptanceRecordId: promotionEvidence?.acceptanceRecordId ?? null,
    candidateId: promotionEvidence?.candidateId ?? null,
    knownGoodRecordId: promotionEvidence?.knownGoodRecordId ?? null,
    replayId: promotionEvidence?.replayId ?? null,
    candidateSourceHash: promotionEvidence?.candidateSourceHash ?? null,
    currentSourceCommit: present(currentSourceCommit) ? currentSourceCommit : null,
    baselineSourceCommit: promotionEvidence?.sourceCommitBefore ?? null,
    targetSourceCommit: promotionEvidence?.sourceCommitAfter ?? null,
    exactCandidateTargetRequired: true,
    exactKnownGoodBaselineRequired: true,
    preExecutionRevalidationComplete: eligible,
    operatorApprovalRequired: true,
    operatorApprovalIdentityBound: true,
    oneShotIdempotencyRequired: true,
    auditEvidenceRequired: true,
    paperOnly: true,
    autonomousPromotionAllowed: false,
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
    gitMergeAllowed: false,
    gitCherryPickAllowed: false,
  });
}

export default Object.freeze({ VERSION, buildAiLogicPromotionExecutionAuthorityContract });
