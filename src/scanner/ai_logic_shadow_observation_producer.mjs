export const VERSION="ai_logic_shadow_observation_producer_v1";
const LOCKS=Object.freeze({productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
const P=v=>typeof v==="string"&&v.trim().length>0;
const fail=(reasons,entry={})=>Object.freeze({version:VERSION,eligible:false,status:"AI_LOGIC_SHADOW_OBSERVATION_PRODUCER_HOLD",disposition:"REJECT_OR_HOLD",reasons:Object.freeze([...new Set(reasons)].sort()),candidateId:P(entry?.binding?.candidateId)?entry.binding.candidateId:null,candidatePath:P(entry?.binding?.candidatePath)?entry.binding.candidatePath:null,candidateTopic:P(entry?.binding?.candidateTopic)?entry.binding.candidateTopic:null,observations:Object.freeze([]),sampleCount:0,baselineEvaluatorCalled:false,candidateEvaluatorCalled:false,...LOCKS});
export function buildAiLogicShadowObservations(input={}){
  const entry=input.shadowEntryEvidence??{},reasons=[];
  if(entry.version!=="ai_logic_shadow_entry_binding_v1"||entry.eligible!==true||entry.status!=="AI_LOGIC_SHADOW_ENTRY_BINDING_VALID"||entry.disposition!=="SHADOW_ENTRY_EVIDENCE_ONLY") reasons.push("SHADOW_ENTRY_EVIDENCE_INVALID");
  for(const k of Object.keys(LOCKS)) if(entry?.[k]===true||input?.[k]===true) reasons.push(`FORBIDDEN_PERMISSION_OPEN_${k.toUpperCase()}`);
  const b=entry.binding??{};
  for(const k of ["candidateId","candidatePath","candidateTopic","candidateSourceHash","replayId","knownGoodRecordId","sourceCommitBefore","sourceCommitAfter"]) if(!P(b[k])) reasons.push(`SHADOW_ENTRY_${k.toUpperCase()}_REQUIRED`);
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(!Array.isArray(input.samples)||input.samples.length<1) reasons.push("SAMPLES_REQUIRED");
  if(typeof input.baselineEvaluator!=="function") reasons.push("BASELINE_EVALUATOR_REQUIRED");
  if(typeof input.candidateEvaluator!=="function"||input.candidateEvaluator?.isolated!==true||input.candidateEvaluator?.version!=="ai_logic_candidate_isolated_runner_v1") reasons.push("ISOLATED_CANDIDATE_EVALUATOR_REQUIRED");
  if(P(b.candidateSourceHash)&&input.candidateEvaluator?.sourceHash!==b.candidateSourceHash) reasons.push("CANDIDATE_SOURCE_HASH_BINDING_MISMATCH");
  if(reasons.length) return fail(reasons,entry);
  const observations=[];
  for(let i=0;i<input.samples.length;i++){
    const row=input.samples[i]??{};
    const sampleId=P(row.sampleId)?row.sampleId.trim():`probation-${i+1}`;
    let baseline,candidate;
    try{ baseline=input.baselineEvaluator(row.input); }catch{ return fail(["BASELINE_EVALUATION_FAILED"],entry); }
    try{ candidate=input.candidateEvaluator(row.input); }catch{ return fail(["CANDIDATE_EVALUATION_FAILED"],entry); }
    observations.push(Object.freeze({sampleId,baseline,candidate,changed:JSON.stringify(baseline)!==JSON.stringify(candidate)}));
  }
  return Object.freeze({version:VERSION,eligible:true,status:"AI_LOGIC_SHADOW_OBSERVATIONS_READY",disposition:"ISOLATED_SHADOW_OBSERVATIONS_ONLY",reasons:Object.freeze([]),candidateId:b.candidateId,candidatePath:b.candidatePath,candidateTopic:b.candidateTopic,candidateSourceHash:b.candidateSourceHash,replayId:b.replayId,knownGoodRecordId:b.knownGoodRecordId,sourceCommitBefore:b.sourceCommitBefore,sourceCommitAfter:b.sourceCommitAfter,observations:Object.freeze(observations),sampleCount:observations.length,baselineEvaluatorCalled:true,candidateEvaluatorCalled:true,...LOCKS});
}
export default Object.freeze({VERSION,buildAiLogicShadowObservations});
