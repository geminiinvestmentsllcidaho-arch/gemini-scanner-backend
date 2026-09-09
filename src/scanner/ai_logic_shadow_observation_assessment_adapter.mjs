import { evaluateAiLogicShadowProbationEvidence } from "./ai_logic_shadow_probation_consumer.mjs";

export const VERSION="ai_logic_shadow_observation_assessment_adapter_v1";
const LOCKS=Object.freeze({productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
const P=v=>typeof v==="string"&&v.trim().length>0;
const ID=["candidateId","candidatePath","candidateTopic","candidateSourceHash","replayId","knownGoodRecordId","sourceCommitBefore","sourceCommitAfter"];
const fail=(reasons,b={})=>Object.freeze({version:VERSION,eligible:false,status:"AI_LOGIC_SHADOW_OBSERVATION_ASSESSMENT_ADAPTER_HOLD",disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),candidateId:P(b.candidateId)?b.candidateId:null,candidatePath:P(b.candidatePath)?b.candidatePath:null,candidateTopic:P(b.candidateTopic)?b.candidateTopic:null,shadowAssessment:null,assessmentCalled:false,...LOCKS});

export function buildAiLogicShadowObservationAssessment(input={}){
  const bridge=input.probationBridge??{},acceptance=input.acceptanceEvidence??{},entry=input.shadowEntryEvidence??{},knownGood=input.knownGood??{},reasons=[];
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(bridge.version!=="ai_logic_shadow_observation_probation_evidence_bridge_v1"||bridge.eligible!==true||bridge.status!=="AI_LOGIC_SHADOW_OBSERVATION_PROBATION_BRIDGE_READY"||bridge.disposition!=="SHADOW_PROBATION_EVIDENCE_ONLY"||bridge.probationBuilderCalled!==true) reasons.push("PROBATION_BRIDGE_INVALID");
  if(bridge.probationEvidence?.complete!==true||bridge.probationEvidence?.status!=="SHADOW_PROBATION_EVIDENCE_COMPLETE") reasons.push("PROBATION_EVIDENCE_INVALID");
  const b=entry.binding??{};
  for(const k of ID){
    if(!P(bridge[k])) reasons.push(`BRIDGE_${k.toUpperCase()}_REQUIRED`);
    if(bridge[k]!==acceptance[k]) reasons.push(`BRIDGE_${k.toUpperCase()}_ACCEPTANCE_MISMATCH`);
    if(b[k]!==acceptance[k]) reasons.push(`SHADOW_ENTRY_${k.toUpperCase()}_ACCEPTANCE_MISMATCH`);
  }
  for(const k of Object.keys(LOCKS)) if(bridge?.[k]===true||bridge.probationEvidence?.[k]===true||acceptance?.[k]===true||entry?.[k]===true||knownGood?.[k]===true||input?.[k]===true) reasons.push(`FORBIDDEN_PERMISSION_OPEN_${k.toUpperCase()}`);
  if(reasons.length) return fail(reasons,bridge);
  const shadowAssessment=evaluateAiLogicShadowProbationEvidence({acceptanceEvidence:acceptance,shadowEntryEvidence:entry,knownGood,shadowProbationEvidence:bridge.probationEvidence});
  if(shadowAssessment?.accepted!==true||shadowAssessment?.status!=="AI_LOGIC_SHADOW_PROBATION_ASSESSMENT_EVIDENCE"||shadowAssessment?.disposition!=="ISOLATED_PROBATION_ASSESSMENT_EVIDENCE_ONLY") return fail(["SHADOW_ASSESSMENT_FAILED",...(Array.isArray(shadowAssessment?.reasons)?shadowAssessment.reasons:[])],bridge);
  return Object.freeze({version:VERSION,eligible:true,status:"AI_LOGIC_SHADOW_OBSERVATION_ASSESSMENT_READY",disposition:"SHADOW_ASSESSMENT_EVIDENCE_ONLY",reasons:Object.freeze([]),candidateId:bridge.candidateId,candidatePath:bridge.candidatePath,candidateTopic:bridge.candidateTopic,candidateSourceHash:bridge.candidateSourceHash,replayId:bridge.replayId,knownGoodRecordId:bridge.knownGoodRecordId,sourceCommitBefore:bridge.sourceCommitBefore,sourceCommitAfter:bridge.sourceCommitAfter,sampleCount:bridge.sampleCount,shadowAssessment,assessmentCalled:true,...LOCKS});
}
export default Object.freeze({VERSION,buildAiLogicShadowObservationAssessment});
