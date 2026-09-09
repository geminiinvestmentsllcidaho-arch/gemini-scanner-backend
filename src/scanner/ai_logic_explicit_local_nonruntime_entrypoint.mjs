import crypto from "node:crypto";
import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";
import { isAiLogicOperatorApprovalConsumed } from "./ai_logic_operator_approval_consumption_store.mjs";
import { buildAiLogicOperatorApprovalConsumptionRecord } from "./ai_logic_operator_approval_consumption_contract.mjs";
import { buildAiLogicOneShotNonruntimeAssembly } from "./ai_logic_one_shot_nonruntime_assembly_builder.mjs";
import { runAiLogicOneShotNonruntimeInvocation } from "./ai_logic_one_shot_nonruntime_invocation_runner.mjs";
import { resolveAiLogicPersistedApprovalAndDecision } from "./ai_logic_local_persisted_evidence_resolvers.mjs";
import { resolveAndBindAiLogicKnownGoodFromStore } from "./ai_logic_known_good_store_integration.mjs";
import { buildAiLogicExecutionPreviewContract } from "./ai_logic_execution_preview_contract.mjs";
import { buildAiLogicExecutionAuthorityGate } from "./ai_logic_execution_authority_gate.mjs";
import { buildAiLogicExecutionPlan } from "./ai_logic_execution_plan.mjs";
import { buildAiLogicExecutionIntentEvidence } from "./ai_logic_execution_intent_evidence_contract.mjs";
import { buildAiLogicExecutionIntentAcknowledgement } from "./ai_logic_execution_intent_acknowledgement_contract.mjs";
import { buildAiLogicExecutionBoundaryGate } from "./ai_logic_execution_boundary_gate.mjs";
import { resolveAiLogicCandidateArtifact } from "./ai_logic_candidate_artifact_resolver.mjs";
import { buildAiLogicPersistedPromotionAuthorityAdapter } from "./ai_logic_persisted_promotion_authority_adapter.mjs";

export const VERSION = "ai_logic_explicit_local_nonruntime_entrypoint_v1";

const CLOSED = Object.freeze({
  automaticRetryAllowed:false,
  runtimeActivationAllowed:false,
  pm2RestartAllowed:false,
  runtimeWiringAllowed:false,
  productionRuntimeWiringAllowed:false,
  promotionExecutionAllowed:false,
  rollbackExecutionAllowed:false,
  brokerContactAllowed:false,
  orderPlacementAllowed:false,
  liveTradingAllowed:false,
  accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,
  sizingMutationAllowed:false,
  allocationMutationAllowed:false,
  gitMutationAllowed:false,
  gitCheckoutAllowed:false,
  gitResetAllowed:false,
  gitRevertAllowed:false,
  gitMergeAllowed:false,
  gitCherryPickAllowed:false,
});

const out = (x) => Object.freeze({ version:VERSION, ...x, ...CLOSED });

const provenance = (operatorApproval, decisionEvidence) => Object.freeze({
  candidateSourceHash:
    typeof operatorApproval?.candidateSourceHash === "string" && operatorApproval.candidateSourceHash
      ? operatorApproval.candidateSourceHash
      : (typeof decisionEvidence?.candidateSourceHash === "string" && decisionEvidence.candidateSourceHash ? decisionEvidence.candidateSourceHash : null),
  candidatePath:
    typeof operatorApproval?.candidatePath === "string" && operatorApproval.candidatePath
      ? operatorApproval.candidatePath
      : (typeof decisionEvidence?.candidatePath === "string" && decisionEvidence.candidatePath ? decisionEvidence.candidatePath : null),
  candidateTopic:
    typeof operatorApproval?.candidateTopic === "string" && operatorApproval.candidateTopic
      ? operatorApproval.candidateTopic
      : (typeof decisionEvidence?.candidateTopic === "string" && decisionEvidence.candidateTopic ? decisionEvidence.candidateTopic : null),
});

export function runAiLogicExplicitLocalNonruntimeEntrypoint(input = {}, deps = {}) {
  const verifyManifest = deps.verifyImmutablePolicyManifest ?? verifyImmutablePolicyManifest;
  const resolvePersisted = deps.resolveAiLogicPersistedApprovalAndDecision ?? resolveAiLogicPersistedApprovalAndDecision;
  const isConsumed = deps.isAiLogicOperatorApprovalConsumed ?? isAiLogicOperatorApprovalConsumed;
  const buildConsumption = deps.buildAiLogicOperatorApprovalConsumptionRecord ?? buildAiLogicOperatorApprovalConsumptionRecord;
  const resolveKnownGood = deps.resolveAndBindAiLogicKnownGoodFromStore ?? resolveAndBindAiLogicKnownGoodFromStore;
  const buildPreview = deps.buildAiLogicExecutionPreviewContract ?? buildAiLogicExecutionPreviewContract;
  const buildAuthority = deps.buildAiLogicExecutionAuthorityGate ?? buildAiLogicExecutionAuthorityGate;
  const buildPlan = deps.buildAiLogicExecutionPlan ?? buildAiLogicExecutionPlan;
  const buildIntent = deps.buildAiLogicExecutionIntentEvidence ?? buildAiLogicExecutionIntentEvidence;
  const buildAcknowledgement = deps.buildAiLogicExecutionIntentAcknowledgement ?? buildAiLogicExecutionIntentAcknowledgement;
  const buildBoundary = deps.buildAiLogicExecutionBoundaryGate ?? buildAiLogicExecutionBoundaryGate;
  const resolveCandidateArtifact = deps.resolveAiLogicCandidateArtifact ?? resolveAiLogicCandidateArtifact;
  const buildPersistedPromotionAuthority = deps.buildAiLogicPersistedPromotionAuthorityAdapter ?? buildAiLogicPersistedPromotionAuthorityAdapter;
  const buildAssembly = deps.buildAiLogicOneShotNonruntimeAssembly ?? buildAiLogicOneShotNonruntimeAssembly;
  const runInvocation = deps.runAiLogicOneShotNonruntimeInvocation ?? runAiLogicOneShotNonruntimeInvocation;

  const {
    approvalRecordId,
    expectedPreimageHash,
    operationId,
    repositoryRoot,
    knownGoodStorePath,
    consumptionPath,
    approvalStorePath,
    promotionDecisionStorePath,
    rollbackDecisionStorePath,
    now,
    currentHeadProvider,
    verifyImmutableManifestAfter,
    validators = {},
  } = input;

  const persisted = resolvePersisted(
    { approvalRecordId },
    {
      approvalPath:approvalStorePath,
      promotionPath:promotionDecisionStorePath,
      rollbackPath:rollbackDecisionStorePath,
    }
  );
  if (persisted?.eligible !== true || persisted?.operatorApproval == null || persisted?.decisionEvidence == null) {
    return out({
      executed:false,
      consumed:false,
      applied:false,
      status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED",
      reasons:Object.freeze(["PERSISTED_APPROVAL_DECISION_RESOLUTION_FAILED"]),
      persistedEvidenceStatus:persisted?.status ?? null,
      persistedEvidenceReasons:Array.isArray(persisted?.reasons) ? Object.freeze([...persisted.reasons]) : Object.freeze([]),
    });
  }
  const operatorApproval = persisted.operatorApproval;
  const decisionEvidence = persisted.decisionEvidence;
  const receiptProvenance = provenance(operatorApproval, decisionEvidence);
  const persistedCandidatePath = operatorApproval?.candidatePath;
  const persistedCandidateTopic = operatorApproval?.candidateTopic;
  if (
    typeof persistedCandidatePath !== "string" || !persistedCandidatePath.trim()
    || typeof persistedCandidateTopic !== "string" || !persistedCandidateTopic.trim()
    || decisionEvidence?.candidatePath !== persistedCandidatePath
    || decisionEvidence?.candidateTopic !== persistedCandidateTopic
  ) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["PERSISTED_CANDIDATE_PATH_TOPIC_BINDING_INVALID"]) });
  }

  if (operatorApproval?.version !== "ai_logic_operator_approval_record_v1" || operatorApproval?.valid !== true || operatorApproval?.explicitlyApproved !== true || operatorApproval?.oneShot !== true) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["PERSISTED_OPERATOR_APPROVAL_INVALID"]) });
  }
  if (!["PROMOTION","ROLLBACK"].includes(operatorApproval.action)) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["PERSISTED_OPERATOR_APPROVAL_ACTION_INVALID"]) });
  }

  const immutableManifest = verifyManifest();
  if (immutableManifest?.ok !== true || immutableManifest?.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["IMMUTABLE_MANIFEST_REVALIDATION_FAILED"]) });
  }

  if (isConsumed({ approvalRecordId:operatorApproval.recordId, nonce:operatorApproval.nonce, filePath:consumptionPath }) === true) {
    return out({ executed:false, consumed:true, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_ALREADY_CONSUMED", ...receiptProvenance, reasons:Object.freeze(["APPROVAL_ALREADY_CONSUMED"]) });
  }

  const currentSourceCommit = operatorApproval.action === "PROMOTION" ? operatorApproval.sourceCommitBefore : operatorApproval.sourceCommitAfter;
  const targetSourceCommit = operatorApproval.action === "PROMOTION" ? operatorApproval.sourceCommitAfter : operatorApproval.sourceCommitBefore;

  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["REPOSITORY_ROOT_REQUIRED"]) });
  }

  if (operatorApproval.action === "PROMOTION") {
    const promotionAuthorityReview = buildPersistedPromotionAuthority(
      { explicitOperatorInvocation:true, approvalRecordId:operatorApproval.recordId, currentSourceCommit },
      {
        approvalPath:approvalStorePath,
        promotionPath:promotionDecisionStorePath,
        rollbackPath:rollbackDecisionStorePath,
        knownGoodPath:knownGoodStorePath,
        rootDir:repositoryRoot,
      }
    );
    if (
      promotionAuthorityReview?.version !== "ai_logic_persisted_promotion_authority_adapter_v1"
      || promotionAuthorityReview?.eligible !== true
      || promotionAuthorityReview?.status !== "AI_LOGIC_PERSISTED_PROMOTION_AUTHORITY_ADAPTER_READY"
      || promotionAuthorityReview?.approvalRecordId !== operatorApproval.recordId
      || promotionAuthorityReview?.promotionDecisionRecordId !== decisionEvidence.recordId
      || promotionAuthorityReview?.candidateSourceHash !== operatorApproval.candidateSourceHash
      || promotionAuthorityReview?.candidatePath !== persistedCandidatePath
      || promotionAuthorityReview?.candidateTopic !== persistedCandidateTopic
      || promotionAuthorityReview?.authorityReview?.eligible !== true
      || promotionAuthorityReview?.approvalConsumptionAllowed !== false
      || promotionAuthorityReview?.promotionExecutionAllowed !== false
      || promotionAuthorityReview?.productionRuntimeWiringAllowed !== false
      || promotionAuthorityReview?.brokerContactAllowed !== false
      || promotionAuthorityReview?.orderPlacementAllowed !== false
      || promotionAuthorityReview?.liveTradingAllowed !== false
      || promotionAuthorityReview?.accountMutationAllowed !== false
      || promotionAuthorityReview?.immutablePolicyMutationAllowed !== false
      || promotionAuthorityReview?.thresholdMutationAllowed !== false
      || promotionAuthorityReview?.sizingMutationAllowed !== false
      || promotionAuthorityReview?.allocationMutationAllowed !== false
      || promotionAuthorityReview?.gitMutationAllowed !== false
    ) {
      return out({
        executed:false,
        consumed:false,
        applied:false,
        status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED",
        ...receiptProvenance,
        reasons:Object.freeze(["PERSISTED_PROMOTION_AUTHORITY_REVIEW_NOT_READY", ...(promotionAuthorityReview?.reasons ?? [])]),
      });
    }
  }

  const candidateArtifact = resolveCandidateArtifact({
    candidatePath:persistedCandidatePath,
    expectedSourceHash:operatorApproval.candidateSourceHash,
  }, {
    rootDir:repositoryRoot,
    manifestResult:immutableManifest,
  });
  const resolvedBytesHash = Buffer.isBuffer(candidateArtifact?.candidateBytes)
    ? crypto.createHash("sha256").update(candidateArtifact.candidateBytes).digest("hex")
    : null;
  const resolvedTextBytes = typeof candidateArtifact?.sourceText === "string"
    ? Buffer.from(candidateArtifact.sourceText, "utf8")
    : null;
  if (
    candidateArtifact?.eligible !== true
    || candidateArtifact?.status !== "AI_LOGIC_CANDIDATE_ARTIFACT_RESOLVED"
    || candidateArtifact?.readOnly !== true
    || candidateArtifact?.evidenceOnly !== true
    || candidateArtifact?.sourceExecutionAllowed !== false
    || candidateArtifact?.dynamicImportAllowed !== false
    || candidateArtifact?.localSandboxMutationAllowed !== false
    || candidateArtifact?.filesystemMutationAllowed !== false
    || candidateArtifact?.runtimeActivationAllowed !== false
    || !Buffer.isBuffer(candidateArtifact?.candidateBytes)
    || typeof candidateArtifact?.sourceText !== "string"
    || candidateArtifact?.sourceHash !== operatorApproval.candidateSourceHash
    || candidateArtifact?.candidatePath !== persistedCandidatePath
    || resolvedBytesHash !== operatorApproval.candidateSourceHash
    || !resolvedTextBytes?.equals(candidateArtifact.candidateBytes)
  ) {
    return out({
      executed:false,
      consumed:false,
      applied:false,
      status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED",
      ...receiptProvenance,
      reasons:Object.freeze(["CANDIDATE_ARTIFACT_RESOLUTION_FAILED", ...(candidateArtifact?.reasons ?? [])]),
    });
  }
  const resolvedCandidateBytes = candidateArtifact.candidateBytes;
  const resolvedTargetPath = candidateArtifact.candidatePath;

  const consumptionRecord = buildConsumption({
    approvalRecord:operatorApproval,
    currentSourceCommit,
    targetSourceCommit,
    now,
    alreadyConsumed:false,
    immutableManifest,
  });
  if (consumptionRecord?.eligible !== true) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["CONSUMPTION_RECORD_NOT_ELIGIBLE", ...(consumptionRecord?.reasons ?? [])]) });
  }

  const consumptionStoreRecord = Object.freeze({
    version:"ai_logic_operator_approval_consumption_store_v1",
    exactlyOnce:true,
    paperOnly:true,
    localJsonlOnly:true,
    approvalRecordId:consumptionRecord.approvalRecordId,
    nonce:consumptionRecord.nonce,
    action:consumptionRecord.action,
    decisionRecordId:consumptionRecord.decisionRecordId,
    candidateSourceHash:consumptionRecord.candidateSourceHash,
    candidatePath:consumptionRecord.candidatePath,
    candidateTopic:consumptionRecord.candidateTopic,
    currentSourceCommit:consumptionRecord.currentSourceCommit,
    targetSourceCommit:consumptionRecord.targetSourceCommit,
    productionRuntimeWiringAllowed:false,
    promotionExecutionAllowed:false,
    rollbackExecutionAllowed:false,
    brokerContactAllowed:false,
    orderPlacementAllowed:false,
    liveTradingAllowed:false,
    accountMutationAllowed:false,
    immutablePolicyMutationAllowed:false,
    thresholdMutationAllowed:false,
    sizingMutationAllowed:false,
    allocationMutationAllowed:false,
    gitMutationAllowed:false,
  });

  const knownGoodStoreBinding = resolveKnownGood({
    knownGoodRecordId:operatorApproval.knownGoodRecordId,
    sourceCommitBefore:operatorApproval.sourceCommitBefore,
  }, { filePath:knownGoodStorePath });
  if (knownGoodStoreBinding?.eligible !== true || knownGoodStoreBinding?.knownGood == null) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["KNOWN_GOOD_STORE_BINDING_NOT_ELIGIBLE"]) });
  }

  const executionPreview = buildPreview({
    consumptionRecord,
    immutableManifest,
    decisionIdentity:{ decisionRecordId:decisionEvidence.recordId, candidateSourceHash:decisionEvidence.candidateSourceHash, candidatePath:decisionEvidence.candidatePath, candidateTopic:decisionEvidence.candidateTopic },
    knownGood:knownGoodStoreBinding.knownGood,
    candidateTarget:{ sourceCommit:operatorApproval.sourceCommitAfter },
  });
  const authorityGate = buildAuthority({
    executionPreview,
    consumptionStoreRecord,
    operatorApproval,
    decisionEvidence,
    knownGood:knownGoodStoreBinding.knownGood,
    immutableManifest,
    currentSourceCommit,
    targetSourceCommit,
    now,
  });
  const executionPlan = buildPlan({ authorityGate, immutableManifest, operatorApproval, consumptionStoreRecord, now });
  const executionIntent = buildIntent({ executionPlan });
  const executionIntentAcknowledgement = buildAcknowledgement({ executionIntent });
  const currentHead = typeof currentHeadProvider === "function" ? currentHeadProvider() : null;
  const boundaryEvidence = buildBoundary({
    executionIntentAcknowledgement,
    consumptionRecord:consumptionStoreRecord,
    immutableManifest,
    candidateArtifact:candidateArtifact.sourceText,
    currentHead,
    changedPaths:[resolvedTargetPath],
    candidateTopic:persistedCandidateTopic,
    now,
  });
  if (
    executionPreview?.eligible !== true
    || authorityGate?.eligible !== true
    || executionPlan?.eligible !== true
    || executionIntent?.eligible !== true
    || executionIntentAcknowledgement?.eligible !== true
    || boundaryEvidence?.eligible !== true
  ) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["INTERNAL_AUTHORITY_BOUNDARY_DERIVATION_FAILED"]) });
  }

  const assembly = buildAssembly({
    operatorApproval,
    consumptionStoreRecord,
    decisionEvidence,
    authorityGate,
    boundaryEvidence,
    immutableManifest,
    currentSourceCommit,
    targetSourceCommit,
    targetPath:resolvedTargetPath,
    expectedPreimageHash,
    operationId,
    knownGoodStorePath,
  });
  if (assembly?.eligible !== true) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["ASSEMBLY_NOT_ELIGIBLE"]) });
  }

  if (typeof currentHeadProvider !== "function" || typeof verifyImmutableManifestAfter !== "function") {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze(["EXECUTOR_CALLBACK_REQUIRED"]) });
  }
  for (const name of ["syntax","focusedTests","fullRegression"]) {
    if (typeof validators[name] !== "function") {
      return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", ...receiptProvenance, reasons:Object.freeze([`VALIDATOR_REQUIRED_${name}`]) });
    }
  }

  const executionInput = Object.freeze({
    orchestratorContract:assembly.orchestratorContract,
    atomicExecutorInput:Object.freeze({
      repositoryRoot,
      boundaryEvidence,
      candidateBytes:resolvedCandidateBytes,
      targetPath:resolvedTargetPath,
      expectedPreimageHash,
      immutableManifestBefore:immutableManifest,
      verifyImmutableManifestAfter,
      validators,
      operationId,
      currentHeadProvider,
    }),
  });

  return out({
    ...runInvocation({
      invocationContract:assembly.invocationContract,
      consumptionRecord,
      consumptionPath,
      executionInput,
    }),
    ...receiptProvenance,
  });
}

export default Object.freeze({ VERSION, runAiLogicExplicitLocalNonruntimeEntrypoint });
