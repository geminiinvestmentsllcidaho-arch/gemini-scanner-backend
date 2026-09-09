import { buildAiLogicExplicitLocalNonruntimeCliContract } from "./ai_logic_explicit_local_nonruntime_cli_contract.mjs";
import { runAiLogicExplicitLocalNonruntimeEntrypoint } from "./ai_logic_explicit_local_nonruntime_entrypoint.mjs";

export const VERSION="ai_logic_explicit_local_nonruntime_cli_runner_v1";
const CLOSED=Object.freeze({runtimeWiringAllowed:false,productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
const out=x=>Object.freeze({version:VERSION,...x,...CLOSED});
const value=(argv,prefix)=>argv.find(x=>x.startsWith(prefix))?.slice(prefix.length)??null;

export function runAiLogicExplicitLocalNonruntimeCli({argv=[],entrypointInput={}}={},deps={}){
  const approvalRecordId=value(argv,"--approval-record-id=");
  const cli=buildAiLogicExplicitLocalNonruntimeCliContract({
    explicitOperatorInvocation:argv.includes("--explicit-operator-invocation"),
    approvalRecordId,
    confirmLocalCandidateSourceApply:argv.includes("--confirm-local-candidate-source-apply"),
  });
  if(cli.eligible!==true||cli.status!=="AI_LOGIC_EXPLICIT_LOCAL_NONRUNTIME_CLI_READY"){
    return out({executed:false,consumed:false,applied:false,status:"AI_LOGIC_EXPLICIT_LOCAL_NONRUNTIME_CLI_RUNNER_BLOCKED",reasons:cli.reasons,approvalRecordId:cli.approvalRecordId,cliContract:cli});
  }
  const run=deps.runAiLogicExplicitLocalNonruntimeEntrypoint??runAiLogicExplicitLocalNonruntimeEntrypoint;
  if(typeof run!=="function") return out({executed:false,consumed:false,applied:false,status:"AI_LOGIC_EXPLICIT_LOCAL_NONRUNTIME_CLI_RUNNER_BLOCKED",reasons:Object.freeze(["ENTRYPOINT_REQUIRED"]),approvalRecordId,cliContract:cli});
  const receipt=run({...entrypointInput,explicitOperatorInvocation:cli.explicitOperatorInvocation,approvalRecordId:cli.approvalRecordId});
  return out({...receipt,approvalRecordId:cli.approvalRecordId,cliContract:cli});
}
export default Object.freeze({VERSION,runAiLogicExplicitLocalNonruntimeCli});
