export const VERSION="ai_logic_one_shot_nonruntime_invocation_contract_v1";
const B=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed"];
const G=[...B,"gitMutationAllowed"];
const X=[...G,"runtimeActivationAllowed","pm2RestartAllowed","gitCheckoutAllowed","gitResetAllowed","gitRevertAllowed","gitMergeAllowed","gitCherryPickAllowed"];
const D=[...B,"persistenceAllowed","promotionAllowed"];
const P=v=>typeof v==="string"&&v.trim().length>0;
const T=v=>{const s=String(v??"").trim().replaceAll("\\","/");return !!s&&!s.startsWith("/")&&!s.split("/").includes("..")&&s.replace(/^\.\//,"").replace(/\/+/g,"/").startsWith("src/scanner/ai_logic_candidates/")&&s.endsWith(".mjs")};
export function buildAiLogicOneShotNonruntimeInvocationContract({operatorApproval:a,consumptionStoreRecord:c,decisionEvidence:d,orchestratorContract:o,boundaryEvidence:b,targetPath,expectedPreimageHash,operationId}={}){
 const r=[];
 if(a?.version!=="ai_logic_operator_approval_record_v1"||a?.valid!==true||a?.explicitlyApproved!==true||a?.oneShot!==true||a?.paperOnly!==true)r.push("OPERATOR_APPROVAL_INVALID");
 if(c?.version!=="ai_logic_operator_approval_consumption_store_v1"||c?.exactlyOnce!==true||c?.paperOnly!==true||c?.localJsonlOnly!==true)r.push("CONSUMPTION_INVALID");
 const dv=idAction=>idAction==="PROMOTION"?"ai_logic_promotion_decision_evidence_store_v1":"ai_logic_rollback_decision_evidence_store_v1";
 if(!d||d?.version!==dv(a?.action)||d?.recordId!==a?.decisionRecordId||d?.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED"||d?.localJsonlOnly!==true)r.push("DECISION_EVIDENCE_INVALID");
 if(o?.version!=="ai_logic_local_integration_orchestrator_contract_v1"||o?.eligible!==true||o?.localCandidateSourceApplySeamReady!==true)r.push("ORCHESTRATOR_INVALID");
 if(b?.version!=="ai_logic_execution_boundary_gate_v1"||b?.eligible!==true||b?.applyEligibilityOnly!==true||b?.readOnly!==true||b?.evidenceOnly!==true||b?.paperOnly!==true)r.push("BOUNDARY_INVALID");
 const id={approvalRecordId:a?.recordId,nonce:a?.nonce,action:a?.action,decisionRecordId:a?.decisionRecordId,candidateSourceHash:a?.candidateSourceHash,currentSourceCommit:o?.currentSourceCommit,targetSourceCommit:o?.targetSourceCommit};
 if(!["PROMOTION","ROLLBACK"].includes(id.action)||!Object.values(id).every(P))r.push("IDENTITY_INVALID");
 const expectedCurrent=id.action==="PROMOTION"?a?.sourceCommitBefore:a?.sourceCommitAfter;
 const expectedTarget=id.action==="PROMOTION"?a?.sourceCommitAfter:a?.sourceCommitBefore;
 if(id.currentSourceCommit!==expectedCurrent)r.push("CURRENT_SOURCE_COMMIT_DRIFT");
 if(id.targetSourceCommit!==expectedTarget)r.push("TARGET_SOURCE_COMMIT_DRIFT");
 const decisionFields=["candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"];
 for(const k of decisionFields)if(d?.[k]!==a?.[k])r.push(`DECISION_BINDING_MISMATCH_${k}`);
 if(id.action==="PROMOTION"&&d?.acceptanceRecordId!==a?.acceptanceRecordId)r.push("DECISION_BINDING_MISMATCH_acceptanceRecordId");
 if(id.action==="ROLLBACK"&&(!P(d?.promotionDecisionRecordId)||!P(d?.acceptanceRecordId)))r.push("ROLLBACK_DECISION_BINDING_INVALID");
 for(const [k,v] of Object.entries(id)){if(c?.[k]!==v)r.push(`CONSUMPTION_BINDING_MISMATCH_${k}`);if(o?.[k]!==v)r.push(`ORCHESTRATOR_BINDING_MISMATCH_${k}`);if(b?.[k]!==v)r.push(`BOUNDARY_BINDING_MISMATCH_${k}`)}
 for(const [q,ks] of [[a,G],[c,G],[d,D],[o,X],[b,G]])for(const k of ks)if(q?.[k]!==false)r.push(`${k}_MUST_BE_FALSE`);
 if(!T(targetPath))r.push("TARGET_PATH_INVALID");
 if(!/^[a-f0-9]{64}$/i.test(String(expectedPreimageHash??"")))r.push("EXPECTED_PREIMAGE_HASH_INVALID");
 if(!/^[A-Za-z0-9._-]{8,128}$/.test(String(operationId??"")))r.push("OPERATION_ID_INVALID");
 const eligible=!r.length;
 return Object.freeze({version:VERSION,eligible,status:eligible?"AI_LOGIC_ONE_SHOT_NONRUNTIME_INVOCATION_READY":"AI_LOGIC_ONE_SHOT_NONRUNTIME_INVOCATION_HOLD",disposition:eligible?"ONE_SHOT_LOCAL_EXISTING_CANDIDATE_REPLACE_ONLY":"INVOCATION_BLOCKED",reasons:Object.freeze(r),...id,targetPath:T(targetPath)?String(targetPath).trim():null,expectedPreimageHash:P(expectedPreimageHash)?expectedPreimageHash:null,operationId:P(operationId)?operationId:null,oneShot:true,operatorInvokedLocalOnly:true,replaceExistingCandidateFileOnly:true,candidateRootBootstrapAllowed:false,runtimeWiringAllowed:false,...Object.fromEntries(X.map(k=>[k,false]))});
}
export default Object.freeze({VERSION,buildAiLogicOneShotNonruntimeInvocationContract});
