import { evaluateAiLogicOfflineCandidateAcceptance } from "./ai_logic_offline_candidate_acceptance_gate.mjs";
import { evaluateAiLogicAcceptanceEvidenceBinding } from "./ai_logic_acceptance_evidence_binding.mjs";

export const VERSION = "ai_logic_offline_candidate_acceptance_bridge_v1";
const LOCKS = Object.freeze({
  persistenceAllowed:false,promotionAllowed:false,rollbackExecutionAllowed:false,
  productionRuntimeWiringAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,
  liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,
});
const fail=(stage,reasons,extra={})=>Object.freeze({
  version:VERSION,eligible:false,status:"AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_BRIDGE_HOLD",
  disposition:"REJECT_OR_HOLD",stage,reasons:Object.freeze([...new Set(reasons??[])].sort()),
  ...extra,...LOCKS
});

export function evaluateAiLogicOfflineCandidateAcceptanceBridge(input={}) {
  const orchestrator=input.orchestrator??{};
  const candidateSourceHash=String(input.candidateSourceHash??"").trim();
  const replayId=String(input.replayId??"").trim();
  if(orchestrator.eligible!==true ||
     orchestrator.status!=="AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE" ||
     orchestrator.disposition!=="OFFLINE_EVIDENCE_ONLY") {
    return fail("ORCHESTRATOR",["ORCHESTRATOR_EVIDENCE_INVALID"]);
  }

  if(!candidateSourceHash || orchestrator.sourceHash!==candidateSourceHash) {
    return fail("IDENTITY_BINDING",["CANDIDATE_SOURCE_HASH_BINDING_MISMATCH"]);
  }
  if(!replayId || orchestrator.safety?.replay?.replayId!==replayId) {
    return fail("IDENTITY_BINDING",["REPLAY_ID_BINDING_MISMATCH"]);
  }

  const acceptance=evaluateAiLogicOfflineCandidateAcceptance(orchestrator.safety);
  if(acceptance.eligible!==true) {
    return fail("ACCEPTANCE_GATE",acceptance.reasons,{acceptance});
  }

  const binding=evaluateAiLogicAcceptanceEvidenceBinding({
    knownGood:input.knownGood,
    experiment:input.experiment,
    safetyGate:orchestrator.safety,
    acceptance,
    orchestrator,
    candidateSourceHash,
  });
  if(binding.eligible!==true) {
    return fail("ACCEPTANCE_BINDING",binding.reasons,{acceptance,binding});
  }

  return Object.freeze({
    version:VERSION,eligible:true,status:"AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_BRIDGE_READY",
    disposition:"OFFLINE_ACCEPTANCE_BINDING_EVIDENCE_ONLY",stage:"COMPLETE",
    reasons:Object.freeze([]),candidateSourceHash,replayId,
    acceptance,binding,...LOCKS
  });
}

export default Object.freeze({VERSION,evaluateAiLogicOfflineCandidateAcceptanceBridge});
