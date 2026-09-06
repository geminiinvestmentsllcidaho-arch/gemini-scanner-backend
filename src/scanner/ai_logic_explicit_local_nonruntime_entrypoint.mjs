import crypto from "node:crypto";
import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";
import { isAiLogicOperatorApprovalConsumed } from "./ai_logic_operator_approval_consumption_store.mjs";
import { buildAiLogicOperatorApprovalConsumptionRecord } from "./ai_logic_operator_approval_consumption_contract.mjs";
import { buildAiLogicOneShotNonruntimeAssembly } from "./ai_logic_one_shot_nonruntime_assembly_builder.mjs";
import { runAiLogicOneShotNonruntimeInvocation } from "./ai_logic_one_shot_nonruntime_invocation_runner.mjs";
import { resolveAiLogicPersistedApprovalAndDecision } from "./ai_logic_local_persisted_evidence_resolvers.mjs";

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

const sha256 = (value) =>
  crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8")).digest("hex");

const out = (x) => Object.freeze({ version:VERSION, ...x, ...CLOSED });

export function runAiLogicExplicitLocalNonruntimeEntrypoint(input = {}, deps = {}) {
  const verifyManifest = deps.verifyImmutablePolicyManifest ?? verifyImmutablePolicyManifest;
  const resolvePersisted = deps.resolveAiLogicPersistedApprovalAndDecision ?? resolveAiLogicPersistedApprovalAndDecision;
  const isConsumed = deps.isAiLogicOperatorApprovalConsumed ?? isAiLogicOperatorApprovalConsumed;
  const buildConsumption = deps.buildAiLogicOperatorApprovalConsumptionRecord ?? buildAiLogicOperatorApprovalConsumptionRecord;
  const buildAssembly = deps.buildAiLogicOneShotNonruntimeAssembly ?? buildAiLogicOneShotNonruntimeAssembly;
  const runInvocation = deps.runAiLogicOneShotNonruntimeInvocation ?? runAiLogicOneShotNonruntimeInvocation;

  const {
    approvalRecordId,
    authorityGate,
    boundaryEvidence,
    targetPath,
    candidateBytes,
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

  if (operatorApproval?.version !== "ai_logic_operator_approval_record_v1" || operatorApproval?.valid !== true || operatorApproval?.explicitlyApproved !== true || operatorApproval?.oneShot !== true) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["PERSISTED_OPERATOR_APPROVAL_INVALID"]) });
  }
  if (!["PROMOTION","ROLLBACK"].includes(operatorApproval.action)) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["PERSISTED_OPERATOR_APPROVAL_ACTION_INVALID"]) });
  }

  const immutableManifest = verifyManifest();
  if (immutableManifest?.ok !== true || immutableManifest?.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["IMMUTABLE_MANIFEST_REVALIDATION_FAILED"]) });
  }

  if (isConsumed({ approvalRecordId:operatorApproval.recordId, nonce:operatorApproval.nonce, filePath:consumptionPath }) === true) {
    return out({ executed:false, consumed:true, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_ALREADY_CONSUMED", reasons:Object.freeze(["APPROVAL_ALREADY_CONSUMED"]) });
  }

  const currentSourceCommit = operatorApproval.action === "PROMOTION" ? operatorApproval.sourceCommitBefore : operatorApproval.sourceCommitAfter;
  const targetSourceCommit = operatorApproval.action === "PROMOTION" ? operatorApproval.sourceCommitAfter : operatorApproval.sourceCommitBefore;

  const consumptionRecord = buildConsumption({
    approvalRecord:operatorApproval,
    currentSourceCommit,
    targetSourceCommit,
    now,
    alreadyConsumed:false,
    immutableManifest,
  });
  if (consumptionRecord?.eligible !== true) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["CONSUMPTION_RECORD_NOT_ELIGIBLE", ...(consumptionRecord?.reasons ?? [])]) });
  }

  const assembly = buildAssembly({
    operatorApproval,
    consumptionStoreRecord:Object.freeze({
      version:"ai_logic_operator_approval_consumption_store_v1",
      exactlyOnce:true,
      paperOnly:true,
      localJsonlOnly:true,
      approvalRecordId:consumptionRecord.approvalRecordId,
      nonce:consumptionRecord.nonce,
      action:consumptionRecord.action,
      decisionRecordId:consumptionRecord.decisionRecordId,
      candidateSourceHash:consumptionRecord.candidateSourceHash,
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
    }),
    decisionEvidence,
    authorityGate,
    boundaryEvidence,
    immutableManifest,
    currentSourceCommit,
    targetSourceCommit,
    targetPath,
    expectedPreimageHash,
    operationId,
    knownGoodStorePath,
  });
  if (assembly?.eligible !== true) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["ASSEMBLY_NOT_ELIGIBLE"]) });
  }

  if (!Buffer.isBuffer(candidateBytes) || sha256(candidateBytes) !== operatorApproval.candidateSourceHash) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["CANDIDATE_BYTES_HASH_MISMATCH"]) });
  }
  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["REPOSITORY_ROOT_REQUIRED"]) });
  }
  if (typeof currentHeadProvider !== "function" || typeof verifyImmutableManifestAfter !== "function") {
    return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze(["EXECUTOR_CALLBACK_REQUIRED"]) });
  }
  for (const name of ["syntax","focusedTests","fullRegression"]) {
    if (typeof validators[name] !== "function") {
      return out({ executed:false, consumed:false, applied:false, status:"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED", reasons:Object.freeze([`VALIDATOR_REQUIRED_${name}`]) });
    }
  }

  const executionInput = Object.freeze({
    orchestratorContract:assembly.orchestratorContract,
    atomicExecutorInput:Object.freeze({
      repositoryRoot,
      boundaryEvidence,
      candidateBytes,
      targetPath,
      expectedPreimageHash,
      immutableManifestBefore:immutableManifest,
      verifyImmutableManifestAfter,
      validators,
      operationId,
      currentHeadProvider,
    }),
  });

  return out(runInvocation({
    invocationContract:assembly.invocationContract,
    consumptionRecord,
    consumptionPath,
    executionInput,
  }));
}

export default Object.freeze({ VERSION, runAiLogicExplicitLocalNonruntimeEntrypoint });
