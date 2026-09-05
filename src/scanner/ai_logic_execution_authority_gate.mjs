export const VERSION="ai_logic_execution_authority_gate_v1";
const LOCKS=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];
const p=v=>typeof v==="string"&&v.trim().length>0;
export function buildAiLogicExecutionAuthorityGate({executionPreview:x,consumptionStoreRecord:c,operatorApproval:a,decisionEvidence:d,knownGood:k,immutableManifest:m,currentSourceCommit, targetSourceCommit, now=new Date().toISOString()}={}){
 const r=[];
 if(x?.version!=="ai_logic_execution_preview_contract_v1"||x?.eligible!==true||x?.previewOnly!==true)r.push("EXECUTION_PREVIEW_INVALID");
 if(c?.version!=="ai_logic_operator_approval_consumption_store_v1"||c?.exactlyOnce!==true)r.push("CONSUMPTION_STORE_RECORD_INVALID");
 if(a?.version!=="ai_logic_operator_approval_record_v1"||a?.valid!==true||a?.explicitlyApproved!==true||a?.oneShot!==true)r.push("OPERATOR_APPROVAL_INVALID");
 if(m?.ok!==true||m?.status!=="IMMUTABLE_MANIFEST_VERIFIED")r.push("IMMUTABLE_MANIFEST_INVALID");
 for(const q of [x,c,a]) for(const l of LOCKS) if(q?.[l]!==false) r.push(l+"_MUST_BE_FALSE");
 const action=a?.identity?.action??a?.action;
 const approvalRecordId=a?.recordId;
 const nonce=a?.identity?.nonce??a?.nonce;
 const decisionRecordId=a?.identity?.decisionRecordId??a?.decisionRecordId;
 if(!["PROMOTION","ROLLBACK"].includes(action)||!p(approvalRecordId)||!p(nonce)||!p(decisionRecordId))r.push("APPROVAL_IDENTITY_INCOMPLETE");
 for(const [name,v] of [["approvalRecordId",approvalRecordId],["nonce",nonce],["action",action],["decisionRecordId",decisionRecordId],["currentSourceCommit",currentSourceCommit],["targetSourceCommit",targetSourceCommit]]) if(x?.[name]!==v||c?.[name]!==v) r.push("IDENTITY_BINDING_MISMATCH_"+name);
 if(d?.recordId!==decisionRecordId)r.push("DECISION_EVIDENCE_IDENTITY_MISMATCH");
 const ai=a?.identity??a??{};
 for(const f of ["candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"]) if(!p(ai?.[f])||d?.[f]!==ai[f]) r.push("DECISION_EVIDENCE_FULL_IDENTITY_MISMATCH_"+f);
 if(ai.acceptanceRecordId!=null&&d?.acceptanceRecordId!==ai.acceptanceRecordId)r.push("DECISION_EVIDENCE_FULL_IDENTITY_MISMATCH_acceptanceRecordId");
 if(k?.valid!==true||k?.status!=="KNOWN_GOOD_RECORD_VALID"||k?.recordId!==ai.knownGoodRecordId||k?.sourceCommit!==ai.sourceCommitBefore)r.push("KNOWN_GOOD_FULL_IDENTITY_MISMATCH");
 const exp=Date.parse(a?.expiresAt),n=Date.parse(now); if(!Number.isFinite(exp)||!Number.isFinite(n)||n>=exp)r.push("APPROVAL_EXPIRED_OR_TIME_INVALID");
 const ec=action==="PROMOTION"?ai.sourceCommitBefore:ai.sourceCommitAfter, et=action==="PROMOTION"?ai.sourceCommitAfter:ai.sourceCommitBefore;
 if(currentSourceCommit!==ec)r.push("CURRENT_SOURCE_COMMIT_DRIFT"); if(targetSourceCommit!==et)r.push("TARGET_SOURCE_COMMIT_DRIFT");
 const eligible=!r.length;
 return Object.freeze({version:VERSION,eligible,status:eligible?"AI_LOGIC_EXECUTION_AUTHORITY_GATE_READY":"AI_LOGIC_EXECUTION_AUTHORITY_GATE_HOLD",disposition:eligible?"READONLY_AUTHORITY_EVIDENCE_ONLY":"AUTHORITY_GATE_BLOCKED",reasons:Object.freeze(r),approvalRecordId:approvalRecordId??null,nonce:nonce??null,action:action??null,decisionRecordId:decisionRecordId??null,candidateSourceHash:ai?.candidateSourceHash??null,currentSourceCommit:currentSourceCommit??null,targetSourceCommit:targetSourceCommit??null,readOnly:true,evidenceOnly:true,paperOnly:true,executionSideEffects:"NONE",gitEffects:"NONE",productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
}
