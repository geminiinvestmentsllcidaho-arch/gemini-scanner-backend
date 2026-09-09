export const VERSION="ai_logic_manual_recommendation_candidate_orchestrator_adapter_v1";
const LOCKS=Object.freeze({
  runtimeActivationAllowed:false,productionRuntimeWiringAllowed:false,persistenceAllowed:false,
  promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,
});
const P=v=>typeof v==="string"&&v.trim().length>0;
const fail=(reasons,draft={})=>Object.freeze({
  version:VERSION,eligible:false,status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_ORCHESTRATOR_ADAPTER_HOLD",
  disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),
  recommendationId:P(draft?.recommendationId)?draft.recommendationId:null,
  candidateId:P(draft?.candidateId)?draft.candidateId:null,
  candidateTopic:P(draft?.candidateTopic)?draft.candidateTopic:null,
  candidatePath:null,orchestratorInput:null,orchestratorCalled:false,filesWritten:false,...LOCKS
});
export function buildAiLogicManualRecommendationCandidateOrchestratorInput(input={}) {
  const draft=input.draft??{},reasons=[];
  if(draft?.version!=="ai_logic_manual_recommendation_candidate_draft_producer_v1"||
     draft?.eligible!==true||
     draft?.status!=="AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_DRAFT_READY"||
     draft?.disposition!=="IN_MEMORY_OFFLINE_CANDIDATE_DRAFT_ONLY") reasons.push("DRAFT_READY_REQUIRED");
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(!P(draft.recommendationId)) reasons.push("RECOMMENDATION_ID_REQUIRED");
  if(!P(draft.candidateId)) reasons.push("CANDIDATE_ID_REQUIRED");
  if(!P(draft.candidateTopic)) reasons.push("CANDIDATE_TOPIC_REQUIRED");
  if(!P(draft.sourceText)) reasons.push("SOURCE_TEXT_REQUIRED");
  if(draft.singleExport!=="evaluateCandidate"||draft.importsAllowed!==false||draft.inMemoryOnly!==true||
     draft.orchestratorCalled!==false||draft.filesWritten!==false) reasons.push("DRAFT_SAFETY_CONTRACT_INVALID");
  for(const k of Object.keys(LOCKS)) if(draft?.[k]!==false) reasons.push(`DRAFT_${k}_MUST_BE_FALSE`);
  if(!Array.isArray(input.samples)||input.samples.length<1) reasons.push("SAMPLES_REQUIRED");
  if(typeof input.baselineEvaluator!=="function") reasons.push("BASELINE_EVALUATOR_REQUIRED");
  const rawCandidateId=P(draft.candidateId)?draft.candidateId:"";
  const candidateId=rawCandidateId?rawCandidateId.trim():"";
  if(candidateId&&(rawCandidateId!==candidateId||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(candidateId))) reasons.push("CANDIDATE_ID_PATH_UNSAFE");
  const candidatePath=candidateId?`src/scanner/ai_logic_candidates/${candidateId}.mjs`:null;
  if(reasons.length)return fail(reasons,draft);
  const orchestratorInput=Object.freeze({
    candidateId,topic:draft.candidateTopic.trim(),explicitFixtureOrInMemoryOnly:true,
    requestsExistingSourceMutation:false,requestsProductionWiring:false,requestsLedgerWrite:false,
    mutationIntents:Object.freeze([...(Array.isArray(draft.mutationIntents)?draft.mutationIntents:[])]),
    files:Object.freeze([Object.freeze({path:candidatePath,content:draft.sourceText})]),
    samples:input.samples,baselineEvaluator:input.baselineEvaluator
  });
  return Object.freeze({
    version:VERSION,eligible:true,status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_ORCHESTRATOR_INPUT_READY",
    disposition:"EXPLICIT_OFFLINE_ORCHESTRATOR_INPUT_ONLY",reasons:Object.freeze([]),
    recommendationId:draft.recommendationId,candidateId,candidateTopic:draft.candidateTopic.trim(),
    candidatePath,orchestratorInput,orchestratorCalled:false,filesWritten:false,...LOCKS
  });
}
export default Object.freeze({VERSION,buildAiLogicManualRecommendationCandidateOrchestratorInput});
