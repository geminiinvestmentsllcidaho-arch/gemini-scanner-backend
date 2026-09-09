import { appendAiLogicPromotionDecisionEvidenceRecord } from "./ai_logic_promotion_decision_evidence_store.mjs";
export const VERSION="ai_logic_shadow_promotion_decision_persistence_bridge_v1";
const L=Object.freeze({productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
const P=v=>typeof v==="string"&&v.trim().length>0;
const ID=["candidateId","candidatePath","candidateTopic","candidateSourceHash","replayId","knownGoodRecordId","sourceCommitBefore","sourceCommitAfter"];
const fail=(r,a={})=>Object.freeze({version:VERSION,eligible:false,status:"AI_LOGIC_SHADOW_PROMOTION_DECISION_PERSISTENCE_BRIDGE_HOLD",disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(r)].sort()),candidateId:P(a.candidateId)?a.candidateId:null,candidatePath:P(a.candidatePath)?a.candidatePath:null,candidateTopic:P(a.candidateTopic)?a.candidateTopic:null,promotionDecisionRecord:null,persistCalled:false,...L});
export function persistAiLogicShadowPromotionDecision(input={}){
 const a=input.promotionDecisionAdapter??{},d=a.promotionDecision??{},b=d.binding??{},r=[];
 if(input.explicitOperatorInvocation!==true)r.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
 if(a.version!=="ai_logic_shadow_assessment_promotion_decision_adapter_v1"||a.eligible!==true||a.status!=="AI_LOGIC_SHADOW_ASSESSMENT_PROMOTION_DECISION_READY"||a.disposition!=="PROMOTION_DECISION_EVIDENCE_ONLY"||a.promotionDecisionCalled!==true)r.push("PROMOTION_DECISION_ADAPTER_INVALID");
 if(d.version!=="ai_logic_promotion_decision_evidence_gate_v1"||d.eligible!==true||d.status!=="AI_LOGIC_PROMOTION_DECISION_EVIDENCE_READY"||d.disposition!=="PROMOTION_DECISION_EVIDENCE_ONLY"||d.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED")r.push("PROMOTION_DECISION_INVALID");
 for(const k of ID){if(!P(a[k]))r.push(`ADAPTER_${k.toUpperCase()}_REQUIRED`);if(b[k]!==a[k])r.push(`PROMOTION_DECISION_${k.toUpperCase()}_MISMATCH`)}
 for(const k of Object.keys(L))if(a?.[k]===true||d?.[k]===true||input?.[k]===true)r.push(`FORBIDDEN_PERMISSION_OPEN_${k.toUpperCase()}`);
 if(r.length)return fail(r,a);
 let out;try{out=appendAiLogicPromotionDecisionEvidenceRecord(d,{ledgerPath:input.ledgerPath,now:input.now})}catch(e){return fail([`PROMOTION_DECISION_PERSIST_FAILED:${e?.message??"UNKNOWN"}`],a)}
 return Object.freeze({version:VERSION,eligible:true,status:"AI_LOGIC_SHADOW_PROMOTION_DECISION_PERSISTED",disposition:"LOCAL_JSONL_PROMOTION_DECISION_EVIDENCE_ONLY",reasons:Object.freeze([]),candidateId:a.candidateId,candidatePath:a.candidatePath,candidateTopic:a.candidateTopic,candidateSourceHash:a.candidateSourceHash,replayId:a.replayId,knownGoodRecordId:a.knownGoodRecordId,sourceCommitBefore:a.sourceCommitBefore,sourceCommitAfter:a.sourceCommitAfter,sampleCount:a.sampleCount,promotionDecisionRecord:out.record,appended:out.appended,localJsonlOnly:true,persistCalled:true,...L});
}
export default Object.freeze({VERSION,persistAiLogicShadowPromotionDecision});
