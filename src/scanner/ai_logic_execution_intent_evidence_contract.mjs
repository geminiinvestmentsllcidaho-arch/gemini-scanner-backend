export const VERSION="ai_logic_execution_intent_evidence_contract_v1";
const P=v=>typeof v==="string"&&v.trim().length>0;
const L=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];
export function buildAiLogicExecutionIntentEvidence({executionPlan:p}={}){
 const r=[];
 if(p?.version!=="ai_logic_execution_plan_v1"||p?.eligible!==true||p?.planOnly!==true||p?.readOnly!==true)r.push("EXECUTION_PLAN_INVALID");
 for(const k of L)if(p?.[k]!==false)r.push(k+"_MUST_BE_FALSE");
 const id={approvalRecordId:p?.approvalRecordId,nonce:p?.nonce,action:p?.action,decisionRecordId:p?.decisionRecordId,currentSourceCommit:p?.currentSourceCommit,targetSourceCommit:p?.targetSourceCommit};
 if(!["PROMOTION","ROLLBACK"].includes(id.action)||![id.approvalRecordId,id.nonce,id.decisionRecordId,id.currentSourceCommit,id.targetSourceCommit].every(P))r.push("IDENTITY_INVALID");
 if(p?.executionSideEffects!=="NONE"||p?.gitEffects!=="NONE"||p?.postconditions?.runtimeIntegration!=="NONE")r.push("ZERO_EFFECTS_REQUIRED");
 const eligible=r.length===0;
 return Object.freeze({version:VERSION,eligible,status:eligible?"AI_LOGIC_EXECUTION_INTENT_EVIDENCE_READY":"AI_LOGIC_EXECUTION_INTENT_EVIDENCE_HOLD",disposition:eligible?"READONLY_EXECUTION_INTENT_EVIDENCE_ONLY":"EXECUTION_INTENT_BLOCKED",reasons:Object.freeze(r),...id,readOnly:true,evidenceOnly:true,paperOnly:true,executionIntentOnly:true,executionSideEffects:"NONE",gitEffects:"NONE",runtimeIntegration:"NONE",productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
}
export default Object.freeze({VERSION,buildAiLogicExecutionIntentEvidence});
