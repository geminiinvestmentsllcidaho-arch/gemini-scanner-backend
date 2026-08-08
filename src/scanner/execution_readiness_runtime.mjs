import {execFile} from "node:child_process";
import {promisify} from "node:util";
import fs from "node:fs";
import path from "node:path";
import {fetchAlpacaPaperAccountReadonly} from "./alpaca_paper_account_readonly_fetch.mjs";
import {fetchAlpacaMarketClockReadonly} from "./alpaca_market_clock_readonly.mjs";
import {createPaperAutoExecutionAlpacaPaperAdapter} from "./paper_auto_execution_alpaca_paper_adapter.mjs";
import {evaluateExecutionReadiness,writeExecutionReadinessStatus} from "./execution_readiness_watcher.mjs";

const execFileAsync=promisify(execFile);
export const EXECUTION_PROCESS_NAME="gemini-scanner";

function projectPm2Process(x={}){
  return {name:x.name,status:x.pm2_env?.status};
}

export function selectExecutionRuntimeEnv(processes=[]){
  const target=processes.find(x=>x?.name===EXECUTION_PROCESS_NAME);
  return target?.pm2_env&&typeof target.pm2_env==="object"?{...target.pm2_env}:{};
}

export async function readPm2ExecutionRuntime(){
  try{
    const {stdout}=await execFileAsync("pm2",["jlist"],{timeout:10000,maxBuffer:2097152});
    const processes=JSON.parse(stdout);
    return {
      processes,
      summary:processes.map(projectPm2Process),
      executionEnv:selectExecutionRuntimeEnv(processes),
    };
  }catch{
    return {processes:[],summary:[],executionEnv:{}};
  }
}

export function readExecutionLifecycle(options={}){
  const lifecyclePath=options.lifecyclePath
    ?? process.env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH
    ?? path.join(process.cwd(),"runs","paper_auto_execution_active_lifecycle.json");
  try{
    return fs.existsSync(lifecyclePath)
      ? JSON.parse(fs.readFileSync(lifecyclePath,"utf8"))
      : null;
  }catch{
    return {state:"FAILED_NEEDS_REVIEW"};
  }
}

export async function runExecutionReadinessOnce(options={}){
  const pm2Reader=options.pm2Reader??readPm2ExecutionRuntime;
  const runtime=await pm2Reader();
  const executionEnv=runtime.executionEnv||{};
  const [account,clock]=await Promise.all([
    fetchAlpacaPaperAccountReadonly({env:executionEnv}),
    fetchAlpacaMarketClockReadonly({env:executionEnv}),
  ]);
  const adapter=createPaperAutoExecutionAlpacaPaperAdapter({
    env:executionEnv,
    fetchImpl:null,
  }).diagnostics();
  const result=evaluateExecutionReadiness({
    account,
    clock,
    pm2:runtime.summary||[],
    adapter,
    env:executionEnv,
    lifecycle:readExecutionLifecycle(options),
  });
  writeExecutionReadinessStatus(result);
  console.log(JSON.stringify(result));
  return result;
}
