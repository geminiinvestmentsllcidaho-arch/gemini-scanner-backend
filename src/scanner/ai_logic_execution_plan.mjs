export const VERSION="ai_logic_execution_plan_v1";
const LOCKS=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];
const present=v=>typeof v==="string"&&v.trim().length>0;
export function buildAiLogicExecutionPlan({authorityGate:g,immutableManifest:m,operatorApproval:a,consumptionStoreRecord:c,now=new Date().toISOString()}={}){
 const reasons=[];
 if(g?.version!=="ai_logic_execution_authority_gate_v1"||g?.eligible!==true||g?.evidenceOnly!==true) reasons.push("AUTHORITY_GATE_INVALID");
 for(const k of LOCKS)if(g?.[k]!==false) reasons.push(k+"_MUST_BE_FALSE");
 if(m?.ok!==true||m?.status!=="IMMUTABLE_MANIFEST_VERIFIED") reasons.push("IMMUTABLE_MANIFEST_INVALID");
 if(a?.version!=="ai_logic_operator_approval_record_v1"||a?.valid!==true||a?.explicitlyApproved!==true||a?.oneShot!==true) reasons.push("APPROVAL_INVALID");
 if(c?.version!=="ai_logic_operator_approval_consumption_store_v1"||c?.exactlyOnce!==true) reasons.push("CONSUMPTION_INVALID");
 const id={approvalRecordId:g?.approvalRecordId,nonce:g?.nonce,action:g?.action,decisionRecordId:g?.decisionRecordId,candidateSourceHash:g?.candidateSourceHash,currentSourceCommit:g?.currentSourceCommit,targetSourceCommit:g?.targetSourceCommit};
 if(!["PROMOTION","ROLLBACK"].includes(id.action)||![id.approvalRecordId,id.nonce,id.decisionRecordId,id.candidateSourceHash,id.currentSourceCommit,id.targetSourceCommit].every(present)) reasons.push("IDENTITY_INVALID");
 const ai=a??{};
 if(a?.recordId!==id.approvalRecordId||ai.nonce!==id.nonce||ai.action!==id.action||ai.decisionRecordId!==id.decisionRecordId||ai.candidateSourceHash!==id.candidateSourceHash) reasons.push("APPROVAL_BINDING_MISMATCH");
 for(const k of Object.keys(id))if(c?.[k]!==id[k]) reasons.push("CONSUMPTION_BINDING_MISMATCH_"+k);
 const exp=Date.parse(a?.expiresAt),n=Date.parse(now); if(!Number.isFinite(exp)||!Number.isFinite(n)||n>=exp) reasons.push("APPROVAL_EXPIRED");
 const before=ai.sourceCommitBefore,after=ai.sourceCommitAfter;
 const expectedCurrent=id.action==="PROMOTION"?before:after,expectedTarget=id.action==="PROMOTION"?after:before;
 if(!present(before)||!present(after)) reasons.push("SOURCE_IDENTITY_INVALID");
 if(id.currentSourceCommit!==expectedCurrent) reasons.push("CURRENT_SOURCE_DRIFT");
 if(id.targetSourceCommit!==expectedTarget) reasons.push("TARGET_SOURCE_DRIFT");
 const eligible=reasons.length===0;
 return Object.freeze({version:VERSION,eligible,status:eligible?"AI_LOGIC_EXECUTION_PLAN_READY":"AI_LOGIC_EXECUTION_PLAN_HOLD",disposition:eligible?"READONLY_PLAN_ONLY":"EXECUTION_PLAN_BLOCKED",reasons:Object.freeze(reasons),...id,preconditions:Object.freeze({authorityGateEligible:g?.eligible===true,immutableManifestVerified:m?.ok===true&&m?.status==="IMMUTABLE_MANIFEST_VERIFIED",operatorApprovalValid:a?.valid===true&&a?.explicitlyApproved===true&&a?.oneShot===true,operatorApprovalBindingValid:a?.recordId===id.approvalRecordId&&ai.nonce===id.nonce&&ai.action===id.action&&ai.decisionRecordId===id.decisionRecordId&&ai.candidateSourceHash===id.candidateSourceHash,operatorApprovalUnexpired:Number.isFinite(exp)&&Number.isFinite(n)&&n<exp,consumptionExactlyOnce:c?.exactlyOnce===true}),postconditions:Object.freeze({executionSideEffects:"NONE",gitEffects:"NONE",runtimeIntegration:"NONE"}),auditIdentity:Object.freeze({...id}),exactSourceTransition:Object.freeze({from:id.currentSourceCommit??null,to:id.targetSourceCommit??null}),rollbackTarget:id.action==="PROMOTION"?(id.currentSourceCommit??null):(id.targetSourceCommit??null),readOnly:true,planOnly:true,paperOnly:true,executionSideEffects:"NONE",gitEffects:"NONE",productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
}
