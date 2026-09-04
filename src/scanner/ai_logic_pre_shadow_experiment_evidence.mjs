import crypto from "node:crypto";
export const VERSION="ai_logic_pre_shadow_experiment_evidence_v1";
const LOCKS=Object.freeze({productionRuntimeWiringAllowed:false,promotionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
const present=v=>typeof v==="string"&&v.trim().length>0;
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
export function buildAiLogicPreShadowExperimentEvidence(input={}){
 const knownGood=input.knownGood??{},orchestrator=input.orchestrator??{},acceptanceBinding=input.acceptanceBinding??{},b=acceptanceBinding.binding??{},reasons=[];
 if(knownGood.valid!==true||knownGood.status!=="KNOWN_GOOD_RECORD_VALID")reasons.push("KNOWN_GOOD_INVALID");
 if(knownGood.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED")reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
 if(!present(knownGood.recordId)||!present(knownGood.sourceCommit))reasons.push("KNOWN_GOOD_IDENTITY_REQUIRED");
 if(orchestrator.eligible!==true||orchestrator.status!=="AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE"||orchestrator.disposition!=="OFFLINE_EVIDENCE_ONLY")reasons.push("ORCHESTRATOR_INVALID");
 if(orchestrator.safety?.replay?.status!=="AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE"||orchestrator.safety?.replay?.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED")reasons.push("REPLAY_INVALID");
 if(acceptanceBinding.eligible!==true||acceptanceBinding.status!=="AI_LOGIC_ACCEPTANCE_EVIDENCE_BINDING_VALID"||acceptanceBinding.disposition!=="OFFLINE_ACCEPTANCE_BINDING_EVIDENCE_ONLY")reasons.push("ACCEPTANCE_BINDING_INVALID");
 if(!present(b.candidateId)||!present(b.candidateSourceHash)||!present(b.replayId)||!present(b.sourceCommitBefore)||!present(b.sourceCommitAfter))reasons.push("ACCEPTANCE_IDENTITY_INCOMPLETE");
 if(b.knownGoodRecordId!==knownGood.recordId||b.sourceCommitBefore!==knownGood.sourceCommit)reasons.push("KNOWN_GOOD_BINDING_MISMATCH");
 if(b.candidateId!==orchestrator.candidateId||b.candidateSourceHash!==orchestrator.sourceHash||b.replayId!==orchestrator.safety?.replay?.replayId)reasons.push("ORCHESTRATOR_BINDING_MISMATCH");
 if(Object.prototype.hasOwnProperty.call(input,"shadowResults"))reasons.push("SHADOW_RESULTS_FORBIDDEN_PRE_SHADOW");
 const valid=reasons.length===0,binding=Object.freeze({knownGoodRecordId:present(knownGood.recordId)?knownGood.recordId:null,candidateId:present(b.candidateId)?b.candidateId:null,candidateSourceHash:present(b.candidateSourceHash)?b.candidateSourceHash:null,replayId:present(b.replayId)?b.replayId:null,sourceCommitBefore:present(b.sourceCommitBefore)?b.sourceCommitBefore:null,sourceCommitAfter:present(b.sourceCommitAfter)?b.sourceCommitAfter:null});
 return Object.freeze({version:VERSION,evidenceId:valid?digest({version:VERSION,stage:"OFFLINE_PRE_SHADOW",binding}).slice(0,32):null,valid,stage:"OFFLINE_PRE_SHADOW",status:valid?"AI_LOGIC_PRE_SHADOW_EXPERIMENT_EVIDENCE_VALID":"AI_LOGIC_PRE_SHADOW_EXPERIMENT_EVIDENCE_HOLD",disposition:valid?"OFFLINE_PRE_SHADOW_EVIDENCE_ONLY":"REJECT_OR_HOLD",shadowResultsAllowed:false,shadowComplete:false,reasons:Object.freeze([...new Set(reasons)].sort()),binding,...LOCKS});
}
export default Object.freeze({VERSION,buildAiLogicPreShadowExperimentEvidence});
