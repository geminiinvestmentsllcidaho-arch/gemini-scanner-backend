import { buildAiLogicShadowProbationEvidence } from "./ai_logic_shadow_probation_evidence.mjs";

export const VERSION = "ai_logic_shadow_observation_probation_evidence_bridge_v1";

const LOCKS = Object.freeze({
  productionRuntimeWiringAllowed:false,
  persistenceAllowed:false,
  promotionAllowed:false,
  rollbackExecutionAllowed:false,
  brokerContactAllowed:false,
  orderPlacementAllowed:false,
  liveTradingAllowed:false,
  accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,
  sizingMutationAllowed:false,
  allocationMutationAllowed:false,
  gitMutationAllowed:false,
});
const P=v=>typeof v==="string"&&v.trim().length>0;
const ID=["candidateId","candidatePath","candidateTopic","candidateSourceHash","replayId","knownGoodRecordId","sourceCommitBefore","sourceCommitAfter"];
const fail=(reasons,o={})=>Object.freeze({version:VERSION,eligible:false,status:"AI_LOGIC_SHADOW_OBSERVATION_PROBATION_BRIDGE_HOLD",disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),candidateId:P(o.candidateId)?o.candidateId:null,candidatePath:P(o.candidatePath)?o.candidatePath:null,candidateTopic:P(o.candidateTopic)?o.candidateTopic:null,probationEvidence:null,probationBuilderCalled:false,...LOCKS});

export function buildAiLogicShadowObservationProbationEvidenceBridge(input={}){
  const obs=input.shadowObservations??{},acceptance=input.acceptanceEvidence??{},entry=input.shadowEntryEvidence??{},knownGood=input.knownGood??{},reasons=[];
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(obs.version!=="ai_logic_shadow_observation_producer_v1"||obs.eligible!==true||obs.status!=="AI_LOGIC_SHADOW_OBSERVATIONS_READY"||obs.disposition!=="ISOLATED_SHADOW_OBSERVATIONS_ONLY") reasons.push("SHADOW_OBSERVATIONS_INVALID");
  if(!Array.isArray(obs.observations)||obs.observations.length<1||obs.sampleCount!==obs.observations.length) reasons.push("SHADOW_OBSERVATIONS_SAMPLE_SET_INVALID");
  if(acceptance.version!=="ai_logic_acceptance_evidence_store_v1") reasons.push("ACCEPTANCE_EVIDENCE_INVALID");
  if(entry.version!=="ai_logic_shadow_entry_binding_v1"||entry.eligible!==true||entry.status!=="AI_LOGIC_SHADOW_ENTRY_BINDING_VALID"||entry.disposition!=="SHADOW_ENTRY_EVIDENCE_ONLY") reasons.push("SHADOW_ENTRY_EVIDENCE_INVALID");
  const b=entry.binding??{};
  for(const k of ID){
    if(!P(obs[k])) reasons.push(`OBSERVATION_${k.toUpperCase()}_REQUIRED`);
    if(obs[k]!==acceptance[k]) reasons.push(`OBSERVATION_${k.toUpperCase()}_ACCEPTANCE_MISMATCH`);
    if(b[k]!==acceptance[k]) reasons.push(`SHADOW_ENTRY_${k.toUpperCase()}_ACCEPTANCE_MISMATCH`);
  }
  for(const k of Object.keys(LOCKS)) if(obs?.[k]===true||acceptance?.[k]===true||entry?.[k]===true||knownGood?.[k]===true||input?.[k]===true) reasons.push(`FORBIDDEN_PERMISSION_OPEN_${k.toUpperCase()}`);
  if(reasons.length) return fail(reasons,obs);
  const probationEvidence=buildAiLogicShadowProbationEvidence({acceptanceEvidence:acceptance,shadowEntryEvidence:entry,knownGood,observations:obs.observations});
  if(probationEvidence?.complete!==true||probationEvidence?.status!=="SHADOW_PROBATION_EVIDENCE_COMPLETE") return fail(["PROBATION_EVIDENCE_BUILD_FAILED",...(Array.isArray(probationEvidence?.reasons)?probationEvidence.reasons:[])],obs);
  return Object.freeze({version:VERSION,eligible:true,status:"AI_LOGIC_SHADOW_OBSERVATION_PROBATION_BRIDGE_READY",disposition:"SHADOW_PROBATION_EVIDENCE_ONLY",reasons:Object.freeze([]),candidateId:obs.candidateId,candidatePath:obs.candidatePath,candidateTopic:obs.candidateTopic,candidateSourceHash:obs.candidateSourceHash,replayId:obs.replayId,knownGoodRecordId:obs.knownGoodRecordId,sourceCommitBefore:obs.sourceCommitBefore,sourceCommitAfter:obs.sourceCommitAfter,sampleCount:obs.sampleCount,probationEvidence,probationBuilderCalled:true,...LOCKS});
}
export default Object.freeze({VERSION,buildAiLogicShadowObservationProbationEvidenceBridge});
