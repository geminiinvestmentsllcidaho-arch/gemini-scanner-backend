import crypto from "node:crypto";
import { evaluateAiLogicCandidateDiff } from "./ai_logic_candidate_diff_allowlist.mjs";
export const VERSION="ai_logic_execution_boundary_gate_v1";
const LOCKS=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];
const P=v=>typeof v==="string"&&v.trim().length>0;
const sha=v=>crypto.createHash("sha256").update(String(v??"")).digest("hex");
export function buildAiLogicExecutionBoundaryGate({executionIntentAcknowledgement:a,consumptionRecord:c,immutableManifest:m,candidateArtifact,currentHead,changedPaths=[],candidateTopic,now}={}){
 const r=[];
 if(a?.version!=="ai_logic_execution_intent_acknowledgement_contract_v1"||a?.eligible!==true||a?.readOnly!==true||a?.evidenceOnly!==true||a?.acknowledgementOnly!==true||a?.paperOnly!==true)r.push("ACKNOWLEDGEMENT_INVALID");
 if(c?.version!=="ai_logic_operator_approval_consumption_store_v1"||c?.exactlyOnce!==true||c?.paperOnly!==true)r.push("CONSUMPTION_INVALID");
 for(const k of LOCKS){if(a?.[k]!==false)r.push("ACK_"+k+"_MUST_BE_FALSE");if(c?.[k]!==false)r.push("CONSUMPTION_"+k+"_MUST_BE_FALSE")}
 const id={approvalRecordId:a?.approvalRecordId,nonce:a?.nonce,action:a?.action,decisionRecordId:a?.decisionRecordId,candidateSourceHash:a?.candidateSourceHash,currentSourceCommit:a?.currentSourceCommit,targetSourceCommit:a?.targetSourceCommit};
 if(!["PROMOTION","ROLLBACK"].includes(id.action)||![id.approvalRecordId,id.nonce,id.decisionRecordId,id.candidateSourceHash,id.currentSourceCommit,id.targetSourceCommit].every(P))r.push("IDENTITY_INVALID");
 for(const k of Object.keys(id))if(c?.[k]!==id[k])r.push("CONSUMPTION_BINDING_MISMATCH_"+k);
 if(currentHead!==id.currentSourceCommit)r.push("CURRENT_HEAD_MISMATCH");
 if(!P(candidateArtifact)||sha(candidateArtifact)!==id.candidateSourceHash)r.push("CANDIDATE_SOURCE_HASH_MISMATCH");
 if(m?.ok!==true||m?.status!=="IMMUTABLE_MANIFEST_VERIFIED")r.push("IMMUTABLE_MANIFEST_INVALID");
 if(!Array.isArray(changedPaths)||changedPaths.length===0)r.push("CHANGED_PATHS_REQUIRED");
 else {
  const allow=evaluateAiLogicCandidateDiff({topic:candidateTopic,changedPaths});
  if(allow?.eligible!==true)r.push("CHANGED_PATH_ALLOWLIST_REJECTED");
 }
 const n=Date.parse(now??"");
 if(!Number.isFinite(n))r.push("NOW_INVALID");
 const eligible=r.length===0;
 return Object.freeze({version:VERSION,eligible,status:eligible?"AI_LOGIC_EXECUTION_BOUNDARY_ELIGIBLE":"AI_LOGIC_EXECUTION_BOUNDARY_BLOCKED",disposition:eligible?"APPLY_ELIGIBILITY_EVIDENCE_ONLY":"EXECUTION_BLOCKED_FAIL_CLOSED",reasons:Object.freeze(r),...id,currentHead:currentHead??null,candidateArtifactHash:P(candidateArtifact)?sha(candidateArtifact):null,changedPaths:Object.freeze(Array.isArray(changedPaths)?[...changedPaths]:[]),readOnly:true,evidenceOnly:true,paperOnly:true,applyEligibilityOnly:true,executionSideEffects:"NONE",gitEffects:"NONE",runtimeIntegration:"NONE",productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
}
