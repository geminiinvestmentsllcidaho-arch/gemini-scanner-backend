import crypto from "node:crypto";
import { applyAiLogicSandboxMutation } from "./ai_logic_sandbox_mutation_contract.mjs";
import { bindAiLogicCandidateEvaluator } from "./ai_logic_candidate_evaluator_binding.mjs";
import { createAiLogicIsolatedEvaluator } from "./ai_logic_candidate_isolated_runner.mjs";
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
  const sourceHash=hash(sourceText);

  const write=applyAiLogicSandboxMutation({
    topic:input.topic,mutationIntents:input.mutationIntents,files
  },{
    rootDir:options.rootDir,manifestResult:options.manifestResult
  });
  if(write.eligible!==true) return reject("SANDBOX_WRITE",write.reasons,{write});

  const binding=await bindAiLogicCandidateEvaluator({
    candidatePath,expectedSourceHash:sourceHash
  },{
    rootDir:options.rootDir,manifestResult:options.manifestResult
  });
  if(binding.eligible!==true) return reject("EVALUATOR_BINDING",binding.reasons,{write,binding});

  const runner=createAiLogicIsolatedEvaluator({
    sourceText,expectedSourceHash:binding.sourceHash
  },{
    timeoutMs:options.candidateTimeoutMs
  });
  if(runner.eligible!==true) return reject("ISOLATED_RUNNER",runner.reasons,{write,binding,runner});

  const safety=evaluateAiLogicCandidateSafetyGate({
    candidateId:input.candidateId,
    topic:input.topic,
    explicitFixtureOrInMemoryOnly:input.explicitFixtureOrInMemoryOnly===true,
    requestsExistingSourceMutation:input.requestsExistingSourceMutation===true,
    requestsProductionWiring:input.requestsProductionWiring===true,
    requestsLedgerWrite:input.requestsLedgerWrite===true,
    changedPaths:write.changedPaths,
    mutationIntents:input.mutationIntents,
    sourceText,
    samples:input.samples,
    baselineEvaluator:input.baselineEvaluator,
    candidateEvaluator:runner.evaluator
  },{
    manifestResult:options.manifestResult
  });
  if(safety.eligible!==true) return reject("SAFETY_GATE",safety.reasons,{write,binding,runner:Object.freeze({
    status:runner.status,sourceHash:runner.sourceHash,isolation:runner.isolation,
    importsAllowed:runner.importsAllowed,dynamicImportAllowed:runner.dynamicImportAllowed,
    timeoutEnforced:runner.timeoutEnforced,environmentAuthority:runner.environmentAuthority
  }),safety});

  return Object.freeze({
    version:VERSION,eligible:true,status:"AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE",
    disposition:"OFFLINE_EVIDENCE_ONLY",stage:"COMPLETE",reasons:Object.freeze([]),
    candidateId:String(input.candidateId??"").trim(),candidatePath,sourceHash,
    write,
    binding:Object.freeze({
      status:binding.status,candidatePath:binding.candidatePath,sourceHash:binding.sourceHash,
      sourceExecutionAllowed:binding.sourceExecutionAllowed,dynamicImportAllowed:binding.dynamicImportAllowed
    }),
    runner:Object.freeze({
      status:runner.status,sourceHash:runner.sourceHash,isolation:runner.isolation,
      importsAllowed:runner.importsAllowed,dynamicImportAllowed:runner.dynamicImportAllowed,
      timeoutEnforced:runner.timeoutEnforced,environmentAuthority:runner.environmentAuthority
    }),
    safety,
    ...LOCKS
  });
}
export default Object.freeze({VERSION,runAiLogicOfflineCandidateOrchestrator});
