import { resolveAndBindAiLogicKnownGoodFromStore } from "./ai_logic_known_good_store_integration.mjs";
import { buildAiLogicLocalIntegrationOrchestratorContract } from "./ai_logic_local_integration_orchestrator_contract.mjs";
import { buildAiLogicOneShotNonruntimeInvocationContract } from "./ai_logic_one_shot_nonruntime_invocation_contract.mjs";

export const VERSION="ai_logic_one_shot_nonruntime_assembly_builder_v1";

export function buildAiLogicOneShotNonruntimeAssembly({
  operatorApproval,
  consumptionStoreRecord,
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
}={}){
  const knownGoodStoreBinding=resolveAndBindAiLogicKnownGoodFromStore({
    knownGoodRecordId:operatorApproval?.knownGoodRecordId,
    sourceCommitBefore:operatorApproval?.sourceCommitBefore,
  },{filePath:knownGoodStorePath});

  const orchestratorContract=buildAiLogicLocalIntegrationOrchestratorContract({
    operatorApproval,
    decisionEvidence,
    consumptionStoreRecord,
    authorityGate,
    boundaryGate:boundaryEvidence,
    immutableManifest,
    knownGoodStoreBinding,
    currentSourceCommit,
    targetSourceCommit,
  });

  const invocationContract=buildAiLogicOneShotNonruntimeInvocationContract({
    operatorApproval,
    consumptionStoreRecord,
    decisionEvidence,
    orchestratorContract,
    boundaryEvidence,
    targetPath,
    expectedPreimageHash,
    operationId,
  });

  const eligible=knownGoodStoreBinding.eligible===true&&orchestratorContract.eligible===true&&invocationContract.eligible===true;
  return Object.freeze({
    version:VERSION,
    eligible,
    status:eligible?"AI_LOGIC_ONE_SHOT_NONRUNTIME_ASSEMBLY_READY":"AI_LOGIC_ONE_SHOT_NONRUNTIME_ASSEMBLY_HOLD",
    knownGoodStoreBinding,
    orchestratorContract,
    invocationContract,
    runtimeWiringAllowed:false,
    productionRuntimeWiringAllowed:false,
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
}
export default Object.freeze({VERSION,buildAiLogicOneShotNonruntimeAssembly});
