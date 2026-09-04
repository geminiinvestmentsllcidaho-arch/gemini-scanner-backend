export const VERSION="ai_logic_pre_shadow_acceptance_evidence_binding_v1";
const LOCKS=Object.freeze({productionRuntimeWiringAllowed:false,promotionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
const present=v=>typeof v==="string"&&v.trim().length>0;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function evaluateAiLogicPreShadowAcceptanceEvidenceBinding(input={}){
 const knownGood=input.knownGood??{},orchestrator=input.orchestrator??{},orchestratorSafety=orchestrator.safety??{},safetyGate=input.safetyGate??orchestratorSafety,replay=safetyGate.replay??{},orchestratorReplay=orchestratorSafety.replay??{},acceptance=input.acceptance??{},candidateSourceHash=String(input.candidateSourceHash??"").trim(),sourceCommitAfter=String(input.sourceCommitAfter??"").trim(),reasons=[];
 if(knownGood.valid!==true||knownGood.status!=="KNOWN_GOOD_RECORD_VALID")reasons.push("KNOWN_GOOD_INVALID");
 if(knownGood.rollbackTargetIdentified!==true||knownGood.rollbackExecutable!==false||knownGood.promotionEligible!==false)reasons.push("KNOWN_GOOD_AUTHORITY_INVALID");
 if(knownGood.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED"||!present(knownGood.recordId)||!present(knownGood.sourceCommit)||!present(knownGood.versionId)||!present(knownGood.logicScope))reasons.push("KNOWN_GOOD_IDENTITY_INVALID");
 if(orchestrator.eligible!==true||orchestrator.status!=="AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE"||orchestrator.disposition!=="OFFLINE_EVIDENCE_ONLY")reasons.push("ORCHESTRATOR_INVALID");
 if(safetyGate.eligible!==true||safetyGate.status!=="AI_LOGIC_CANDIDATE_SAFETY_GATE_ELIGIBLE_FOR_OFFLINE_EVIDENCE_ONLY"||safetyGate.disposition!=="OFFLINE_EVIDENCE_ONLY")reasons.push("SAFETY_GATE_INVALID");
 if(replay.status!=="AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE"||replay.disposition!=="OFFLINE_EVIDENCE_ONLY"||replay.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED")reasons.push("REPLAY_INVALID");
 if(!present(replay.replayId)||!present(replay.candidateId)||!present(replay.baselineHash)||!present(replay.candidateHash))reasons.push("REPLAY_IDENTITY_INCOMPLETE");
 if(acceptance.eligible!==true||acceptance.status!=="AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_EVIDENCE"||acceptance.disposition!=="OFFLINE_ACCEPTANCE_EVIDENCE_ONLY")reasons.push("ACCEPTANCE_INVALID");
 if(!candidateSourceHash||orchestrator.sourceHash!==candidateSourceHash)reasons.push("CANDIDATE_SOURCE_HASH_BINDING_MISMATCH");
 if(orchestrator.candidateId!==replay.candidateId||orchestratorReplay.replayId!==replay.replayId||orchestratorReplay.candidateId!==replay.candidateId||safetyGate.candidateId!==replay.candidateId)reasons.push("ORCHESTRATOR_REPLAY_BINDING_MISMATCH");
 if(!sourceCommitAfter)reasons.push("SOURCE_COMMIT_AFTER_REQUIRED");
 if(acceptance.comparison?.sampleCount!==replay.sampleCount||acceptance.comparison?.baselineAccuracy!==replay.baselineMetrics?.accuracy||acceptance.comparison?.candidateAccuracy!==replay.candidateMetrics?.accuracy||acceptance.comparison?.accuracyDelta!==replay.candidateMetrics?.accuracyDelta||acceptance.comparison?.changedCount!==replay.candidateMetrics?.changedCount)reasons.push("ACCEPTANCE_REPLAY_COMPARISON_MISMATCH");
 if(input.shadowResults!==undefined||input.experiment!==undefined)reasons.push("POST_SHADOW_INPUT_FORBIDDEN");
 const eligible=reasons.length===0;
 return Object.freeze({version:VERSION,eligible,status:eligible?"AI_LOGIC_PRE_SHADOW_ACCEPTANCE_EVIDENCE_BINDING_VALID":"AI_LOGIC_PRE_SHADOW_ACCEPTANCE_EVIDENCE_BINDING_HOLD",disposition:eligible?"OFFLINE_PRE_SHADOW_ACCEPTANCE_BINDING_EVIDENCE_ONLY":"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),binding:Object.freeze({knownGoodRecordId:present(knownGood.recordId)?knownGood.recordId:null,candidateId:present(replay.candidateId)?replay.candidateId:null,candidateSourceHash:candidateSourceHash||null,replayId:present(replay.replayId)?replay.replayId:null,sourceCommitBefore:present(knownGood.sourceCommit)?knownGood.sourceCommit:null,sourceCommitAfter:sourceCommitAfter||null}),replayEvidence:Object.freeze({baselineMetrics:replay.baselineMetrics??null,candidateMetrics:replay.candidateMetrics??null,sampleCount:Number.isInteger(replay.sampleCount)?replay.sampleCount:null}),...LOCKS});
}
export default Object.freeze({VERSION,evaluateAiLogicPreShadowAcceptanceEvidenceBinding});
