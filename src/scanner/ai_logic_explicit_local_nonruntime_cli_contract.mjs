export const VERSION="ai_logic_explicit_local_nonruntime_cli_contract_v1";
const present=v=>typeof v==="string"&&v.trim().length>0;
const CLOSED=Object.freeze({operatorInvokedLocalOnly:true,runtimeWiringAllowed:false,productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
export function buildAiLogicExplicitLocalNonruntimeCliContract(input={}){
 const reasons=[];
 if(input.explicitOperatorInvocation!==true)reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
 if(!present(input.approvalRecordId))reasons.push("APPROVAL_RECORD_ID_REQUIRED");
 if(input.confirmLocalCandidateSourceApply!==true)reasons.push("LOCAL_CANDIDATE_SOURCE_APPLY_CONFIRMATION_REQUIRED");
 return Object.freeze({version:VERSION,eligible:reasons.length===0,status:reasons.length===0?"AI_LOGIC_EXPLICIT_LOCAL_NONRUNTIME_CLI_READY":"AI_LOGIC_EXPLICIT_LOCAL_NONRUNTIME_CLI_HOLD",disposition:reasons.length===0?"EXPLICIT_OPERATOR_LOCAL_CANDIDATE_SOURCE_APPLY_ONLY":"CLI_INVOCATION_BLOCKED",reasons:Object.freeze(reasons),approvalRecordId:present(input.approvalRecordId)?input.approvalRecordId:null,explicitOperatorInvocation:input.explicitOperatorInvocation===true,confirmLocalCandidateSourceApply:input.confirmLocalCandidateSourceApply===true,...CLOSED});
}
export default Object.freeze({VERSION,buildAiLogicExplicitLocalNonruntimeCliContract});
