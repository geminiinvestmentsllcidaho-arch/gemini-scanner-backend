export const VERSION="ai_logic_execution_intent_acknowledgement_contract_v1";
const P=v=>typeof v==="string"&&v.trim().length>0;
const L=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];
export function buildAiLogicExecutionIntentAcknowledgement({executionIntent:i}={}){
 const r=[];
 if(i?.version!=="ai_logic_execution_intent_evidence_contract_v1"||i?.eligible!==true||i?.readOnly!==true||i?.evidenceOnly!==true||i?.paperOnly!==true||i?.executionIntentOnly!==true)r.push("EXECUTION_INTENT_INVALID");
 for(const k of L)if(i?.[k]!==false)r.push(k+"_MUST_BE_FALSE");
 const id={approvalRecordId:i?.approvalRecordId,nonce:i?.nonce,action:i?.action,decisionRecordId:i?.decisionRecordId,currentSourceCommit:i?.currentSourceCommit,targetSourceCommit:i?.targetSourceCommit};
 if(!["PROMOTION","ROLLBACK"].includes(id.action)||![id.approvalRecordId,id.nonce,id.decisionRecordId,id.currentSourceCommit,id.targetSourceCommit].every(P)||id.currentSourceCommit===id.targetSourceCommit)r.push("IDENTITY_INVALID");
 if(i?.executionSideEffects!=="NONE"||i?.gitEffects!=="NONE"||i?.runtimeIntegration!=="NONE")r.push("ZERO_EFFECTS_REQUIRED");
 const eligible=r.length===0;
 return Object.freeze({version:VERSION,eligible,status:eligible?"AI_LOGIC_EXECUTION_INTENT_ACKNOWLEDGED":"AI_LOGIC_EXECUTION_INTENT_ACKNOWLEDGEMENT_HOLD",disposition:eligible?"READONLY_ACKNOWLEDGEMENT_EVIDENCE_ONLY":"ACKNOWLEDGEMENT_BLOCKED",reasons:Object.freeze(r),...id,exactSourceTransition:Object.freeze({from:id.currentSourceCommit??null,to:id.targetSourceCommit??null}),readOnly:true,evidenceOnly:true,paperOnly:true,acknowledgementOnly:true,executionSideEffects:"NONE",gitEffects:"NONE",runtimeIntegration:"NONE",productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
}
export default Object.freeze({VERSION,buildAiLogicExecutionIntentAcknowledgement});
