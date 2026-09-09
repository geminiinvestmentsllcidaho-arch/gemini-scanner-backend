import { ALLOWED_CANDIDATE_TOPICS } from "./ai_logic_candidate_diff_allowlist.mjs";

export const VERSION = "ai_logic_manual_recommendation_candidate_bridge_v1";

const LOCKS = Object.freeze({
  runtimeActivationAllowed:false,
  productionRuntimeWiringAllowed:false,
  persistenceAllowed:false,
  promotionAllowed:false,
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

const clean=(v,max=256)=>String(v??"").trim().slice(0,max);
const mapTopic=(targetArea)=>{
  const area=clean(targetArea,128).toLowerCase();
  if(area==="classification_coverage") return "classification_coverage";
  if(["entry_confirmation","false_positive","false_positive_classification","ranking_confidence"].includes(area))
    return "false_positive_classification_logic";
  if(["rejection_sensitivity","missed_opportunity","missed_opportunity_classification"].includes(area))
    return "missed_opportunity_classification_logic";
  if(["wait_timing","entry_timing","decision_timing"].includes(area))
    return "decision_timing_logic_without_threshold_mutation";
  if(["decision_boundaries","evidence_interpretation","manual_scanner_calibration"].includes(area))
    return "evidence_interpretation";
  return null;
};

const fail=(reasons,recommendationId=null)=>Object.freeze({
  version:VERSION,eligible:false,status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_BRIDGE_HOLD",
  disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),
  recommendationId,candidateTopic:null,candidateDraftRequired:true,sourcePatchIncluded:false,
  explicitOperatorInvocationRequired:true,backtestRequired:true,operatorApprovalRequired:true,
  ...LOCKS
});

export function evaluateAiLogicManualRecommendationCandidateBridge(input={}) {
  const recommendation=input.recommendation??{};
  const recommendationId=clean(recommendation.recommendationId,128)||null;
  const reasons=[];
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(!recommendationId) reasons.push("RECOMMENDATION_ID_REQUIRED");
  if(recommendation.proposalOnly!==true) reasons.push("PROPOSAL_ONLY_REQUIRED");
  if(recommendation.requiresBacktest!==true) reasons.push("BACKTEST_REQUIRED");
  if(recommendation.requiresOperatorApproval!==true) reasons.push("OPERATOR_APPROVAL_REQUIRED");
  if(recommendation.implementationIncluded!==false) reasons.push("IMPLEMENTATION_MUST_NOT_BE_INCLUDED");
  if(recommendation.patchIncluded!==false) reasons.push("PATCH_MUST_NOT_BE_INCLUDED");
  if(recommendation.automaticLearningAllowed!==false) reasons.push("AUTOMATIC_LEARNING_MUST_BE_FALSE");
  if(recommendation.automaticPatchAllowed!==false) reasons.push("AUTOMATIC_PATCH_MUST_BE_FALSE");
  if(recommendation.scannerLogicMutationAllowed!==false) reasons.push("SCANNER_LOGIC_MUTATION_MUST_BE_FALSE");
  if(recommendation.thresholdMutationAllowed!==false) reasons.push("THRESHOLD_MUTATION_MUST_BE_FALSE");
  if(recommendation.brokerContactAllowed!==false) reasons.push("BROKER_CONTACT_MUST_BE_FALSE");
  if(recommendation.orderPlacementAllowed!==false) reasons.push("ORDER_PLACEMENT_MUST_BE_FALSE");
  if(recommendation.accountMutationAllowed!==false) reasons.push("ACCOUNT_MUTATION_MUST_BE_FALSE");
  const candidateTopic=mapTopic(recommendation.targetArea);
  if(!candidateTopic || !ALLOWED_CANDIDATE_TOPICS.includes(candidateTopic)) reasons.push("TARGET_AREA_NOT_MAPPABLE_TO_ALLOWLISTED_CANDIDATE_TOPIC");
  if(reasons.length) return fail(reasons,recommendationId);
  return Object.freeze({
    version:VERSION,eligible:true,status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_BRIDGE_READY",
    disposition:"OPERATOR_INVOKED_OFFLINE_CANDIDATE_DRAFT_ONLY",reasons:Object.freeze([]),
    recommendationId,candidateTopic,candidateDraftRequired:true,sourcePatchIncluded:false,
    suggestedDirection:clean(recommendation.suggestedDirection,1200)||null,
    evidenceSummary:clean(recommendation.evidenceSummary,1600)||null,
    candidateSourceText:null,candidateFiles:Object.freeze([]),
    explicitOperatorInvocationRequired:true,backtestRequired:true,operatorApprovalRequired:true,
    ...LOCKS
  });
}

export default Object.freeze({VERSION,evaluateAiLogicManualRecommendationCandidateBridge});
