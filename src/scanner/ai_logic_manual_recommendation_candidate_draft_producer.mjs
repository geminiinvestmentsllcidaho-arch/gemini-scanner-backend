import { evaluateAiLogicCandidateSemanticGuard } from "./ai_logic_candidate_semantic_guard.mjs";

export const VERSION="ai_logic_manual_recommendation_candidate_draft_producer_v1";
const LOCKS=Object.freeze({
  runtimeActivationAllowed:false,productionRuntimeWiringAllowed:false,persistenceAllowed:false,
  promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,
});
const P=v=>typeof v==="string"&&v.trim().length>0;
const fail=(reasons,bridge={},spec={})=>Object.freeze({
  version:VERSION,eligible:false,status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_DRAFT_HOLD",
  disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),
  recommendationId:P(bridge?.recommendationId)?bridge.recommendationId:null,
  candidateTopic:P(bridge?.candidateTopic)?bridge.candidateTopic:null,
  candidateId:P(spec?.candidateId)?spec.candidateId.trim():null,
  sourceText:null,files:Object.freeze([]),inMemoryOnly:true,orchestratorCalled:false,...LOCKS
});
export function buildAiLogicManualRecommendationCandidateDraft(input={}) {
  const bridge=input.bridge??{},spec=input.operatorDraftSpec??{},reasons=[];
  if(bridge?.version!=="ai_logic_manual_recommendation_candidate_bridge_v1"||bridge?.eligible!==true||
     bridge?.status!=="AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_BRIDGE_READY"||
     bridge?.disposition!=="OPERATOR_INVOKED_OFFLINE_CANDIDATE_DRAFT_ONLY") reasons.push("BRIDGE_READY_REQUIRED");
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(!P(spec.candidateId)) reasons.push("CANDIDATE_ID_REQUIRED");
  if(!P(spec.candidateTopic)) reasons.push("OPERATOR_CANDIDATE_TOPIC_REQUIRED");
  if(P(spec.candidateTopic)&&spec.candidateTopic.trim()!==bridge?.candidateTopic) reasons.push("CANDIDATE_TOPIC_BINDING_MISMATCH");
  if(!P(spec.evaluatorBody)) reasons.push("OPERATOR_EVALUATOR_BODY_REQUIRED");
  if(spec.fromRecommendationText===true) reasons.push("FREEFORM_RECOMMENDATION_TRANSLATION_FORBIDDEN");
  if(spec.writeFiles===true||spec.callOrchestrator===true) reasons.push("DRAFT_SIDE_EFFECT_REQUEST_FORBIDDEN");
  const body=P(spec.evaluatorBody)?spec.evaluatorBody.trim():"";
  if(/(^|\n)\s*import\s|\bimport\s*\(|\brequire\s*\(/m.test(body)) reasons.push("DEPENDENCY_IMPORT_FORBIDDEN");
  if(/\bexport\b/.test(body)) reasons.push("NESTED_EXPORT_FORBIDDEN");
  const sourceText=body?`export function evaluateCandidate(input){\n${body}\n}\n`:"";
  const semantic=evaluateAiLogicCandidateSemanticGuard({
    mutationIntents:Array.isArray(spec.mutationIntents)?spec.mutationIntents:[],
    sourceText
  });
  if(semantic.eligible!==true) reasons.push(...semantic.reasons.map(r=>`SEMANTIC:${r}`));
  if(reasons.length)return fail(reasons,bridge,spec);
  return Object.freeze({
    version:VERSION,eligible:true,status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_DRAFT_READY",
    disposition:"IN_MEMORY_OFFLINE_CANDIDATE_DRAFT_ONLY",reasons:Object.freeze([]),
    recommendationId:bridge.recommendationId,candidateTopic:bridge.candidateTopic,
    candidateId:spec.candidateId.trim(),sourceText,files:Object.freeze([]),
    mutationIntents:Object.freeze([...(semantic.mutationIntents??[])]),
    singleExport:"evaluateCandidate",importsAllowed:false,inMemoryOnly:true,
    orchestratorCalled:false,filesWritten:false,...LOCKS
  });
}
export default Object.freeze({VERSION,buildAiLogicManualRecommendationCandidateDraft});
