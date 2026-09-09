import { evaluateAiLogicPromotionDecisionEvidence } from "./ai_logic_promotion_decision_evidence_gate.mjs";

export const VERSION="ai_logic_shadow_assessment_promotion_decision_adapter_v1";
const LOCKS=Object.freeze({productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
const P=v=>typeof v==="string"&&v.trim().length>0;
const ID=["candidateId","candidatePath","candidateTopic","candidateSourceHash","replayId","knownGoodRecordId","sourceCommitBefore","sourceCommitAfter"];
const fail=(reasons,a={})=>Object.freeze({version:VERSION,eligible:false,status:"AI_LOGIC_SHADOW_ASSESSMENT_PROMOTION_DECISION_ADAPTER_HOLD",disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),candidateId:P(a.candidateId)?a.candidateId:null,candidatePath:P(a.candidatePath)?a.candidatePath:null,candidateTopic:P(a.candidateTopic)?a.candidateTopic:null,promotionDecision:null,promotionDecisionCalled:false,...LOCKS});

export function buildAiLogicShadowAssessmentPromotionDecision(input={}){
  const adapter=input.shadowAssessmentAdapter??{},acceptance=input.acceptanceEvidence??{},knownGood=input.knownGood??{},reasons=[];
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(adapter.version!=="ai_logic_shadow_observation_assessment_adapter_v1"||adapter.eligible!==true||adapter.status!=="AI_LOGIC_SHADOW_OBSERVATION_ASSESSMENT_READY"||adapter.disposition!=="SHADOW_ASSESSMENT_EVIDENCE_ONLY"||adapter.assessmentCalled!==true) reasons.push("SHADOW_ASSESSMENT_ADAPTER_INVALID");
  const assessment=adapter.shadowAssessment??{},b=assessment.binding??{};
  if(assessment.version!=="ai_logic_shadow_probation_consumer_v1"||assessment.accepted!==true||assessment.status!=="AI_LOGIC_SHADOW_PROBATION_ASSESSMENT_EVIDENCE"||assessment.disposition!=="ISOLATED_PROBATION_ASSESSMENT_EVIDENCE_ONLY") reasons.push("SHADOW_ASSESSMENT_INVALID");
  for(const k of ID){
    if(!P(adapter[k])) reasons.push(`ADAPTER_${k.toUpperCase()}_REQUIRED`);
    if(adapter[k]!==acceptance[k]) reasons.push(`ADAPTER_${k.toUpperCase()}_ACCEPTANCE_MISMATCH`);
    if(b[k]!==acceptance[k]) reasons.push(`ASSESSMENT_${k.toUpperCase()}_ACCEPTANCE_MISMATCH`);
  }
  if(b.acceptanceRecordId!==acceptance.recordId) reasons.push("ASSESSMENT_ACCEPTANCE_RECORD_ID_MISMATCH");
  for(const k of Object.keys(LOCKS)) if(adapter?.[k]===true||assessment?.[k]===true||acceptance?.[k]===true||knownGood?.[k]===true||input?.[k]===true) reasons.push(`FORBIDDEN_PERMISSION_OPEN_${k.toUpperCase()}`);
  if(reasons.length) return fail(reasons,adapter);
  const promotionDecision=evaluateAiLogicPromotionDecisionEvidence({acceptanceEvidence:acceptance,knownGood,shadowAssessment:assessment});
  if(promotionDecision?.eligible!==true||promotionDecision?.status!=="AI_LOGIC_PROMOTION_DECISION_EVIDENCE_READY"||promotionDecision?.disposition!=="PROMOTION_DECISION_EVIDENCE_ONLY") return fail(["PROMOTION_DECISION_EVIDENCE_FAILED",...(Array.isArray(promotionDecision?.reasons)?promotionDecision.reasons:[])],adapter);
  return Object.freeze({version:VERSION,eligible:true,status:"AI_LOGIC_SHADOW_ASSESSMENT_PROMOTION_DECISION_READY",disposition:"PROMOTION_DECISION_EVIDENCE_ONLY",reasons:Object.freeze([]),candidateId:adapter.candidateId,candidatePath:adapter.candidatePath,candidateTopic:adapter.candidateTopic,candidateSourceHash:adapter.candidateSourceHash,replayId:adapter.replayId,knownGoodRecordId:adapter.knownGoodRecordId,sourceCommitBefore:adapter.sourceCommitBefore,sourceCommitAfter:adapter.sourceCommitAfter,sampleCount:adapter.sampleCount,promotionDecision,promotionDecisionCalled:true,...LOCKS});
}
export default Object.freeze({VERSION,buildAiLogicShadowAssessmentPromotionDecision});
