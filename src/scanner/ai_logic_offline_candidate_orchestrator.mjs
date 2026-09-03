import crypto from "node:crypto";
import { applyAiLogicSandboxMutation } from "./ai_logic_sandbox_mutation_contract.mjs";
import { bindAiLogicCandidateEvaluator } from "./ai_logic_candidate_evaluator_binding.mjs";
import { evaluateAiLogicCandidateSafetyGate } from "./ai_logic_candidate_safety_gate.mjs";

export const VERSION="ai_logic_offline_candidate_orchestrator_v1";
const LOCKS=Object.freeze({
  productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,
});
const hash=(s)=>crypto.createHash("sha256").update(String(s??"")).digest("hex");
const reject=(stage,reasons,extra={})=>Object.freeze({
  version:VERSION,eligible:false,status:"AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATOR_REJECT",
  disposition:"REJECT_OR_HOLD",stage,reasons:Object.freeze([...new Set(reasons??[])].sort()),...extra,...LOCKS
});

export async function runAiLogicOfflineCandidateOrchestrator(input={},options={}) {
  const files=Array.isArray(input.files)?input.files:[];
  const sourceFiles=files.filter((f)=>String(f?.path??"").startsWith("src/scanner/ai_logic_candidates/"));
  if(sourceFiles.length!==1) return reject("PRECHECK",["EXACTLY_ONE_SOURCE_CANDIDATE_REQUIRED"]);

  const candidatePath=String(sourceFiles[0].path??"").trim();
  const sourceText=String(sourceFiles[0].content??"");
  const write=applyAiLogicSandboxMutation({
    topic:input.topic,mutationIntents:input.mutationIntents,files
  },{
    rootDir:options.rootDir,manifestResult:options.manifestResult
  });
  if(write.eligible!==true) return reject("SANDBOX_WRITE",write.reasons,{write});

  const binding=await bindAiLogicCandidateEvaluator({
    candidatePath,expectedSourceHash:hash(sourceText)
  },{
    rootDir:options.rootDir,manifestResult:options.manifestResult
  });
  if(binding.eligible!==true) return reject("EVALUATOR_BINDING",binding.reasons,{write,binding});

  const safety=evaluateAiLogicCandidateSafetyGate({
    candidateId:input.candidateId,
    topic:input.topic,
    explicitFixtureOrInMemoryOnly:input.explicitFixtureOrInMemoryOnly===true,
    requestsExistingSourceMutation:false,
    requestsProductionWiring:false,
    requestsLedgerWrite:false,
    changedPaths:write.changedPaths,
    mutationIntents:input.mutationIntents,
    sourceText,
    samples:input.samples,
    baselineEvaluator:input.baselineEvaluator,
    candidateEvaluator:binding.evaluator,
  },{manifestResult:options.manifestResult});

  if(safety.eligible!==true) return reject("OFFLINE_SAFETY_GATE",safety.reasons,{write,binding:Object.freeze({
    status:binding.status,candidatePath:binding.candidatePath,sourceHash:binding.sourceHash
  }),safety});

  return Object.freeze({
    version:VERSION,eligible:true,status:"AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE",
    disposition:"OFFLINE_EVIDENCE_ONLY",stage:"COMPLETE",reasons:Object.freeze([]),
    candidateId:safety.candidateId,candidatePath,sourceHash:binding.sourceHash,
    write:Object.freeze({status:write.status,filesWritten:write.filesWritten}),
    binding:Object.freeze({status:binding.status,candidatePath:binding.candidatePath,sourceHash:binding.sourceHash}),
    safety,...LOCKS
  });
}
export default Object.freeze({VERSION,runAiLogicOfflineCandidateOrchestrator});
