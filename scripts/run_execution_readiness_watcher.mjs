import {execFile} from "node:child_process";
import {promisify} from "node:util";
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {fetchAlpacaPaperAccountReadonly} from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";
import {fetchAlpacaMarketClockReadonly} from "../src/scanner/alpaca_market_clock_readonly.mjs";
import {createPaperAutoExecutionAlpacaPaperAdapter} from "../src/scanner/paper_auto_execution_alpaca_paper_adapter.mjs";
import {evaluateExecutionReadiness,writeExecutionReadinessStatus} from "../src/scanner/execution_readiness_watcher.mjs";

const execFileAsync=promisify(execFile);
const waitMs=Math.max(15000,Number(process.env.GS_EXECUTION_READINESS_WATCH_INTERVAL_MS)||30000);
const lifecyclePath=process.env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH||path.join(process.cwd(),"runs","paper_auto_execution_active_lifecycle.json");
const EXECUTION_PROCESS_NAME="gemini-scanner";

function projectPm2Process(x={}){
  return {name:x.name,status:x.pm2_env?.status};
}
export function selectExecutionRuntimeEnv(processes=[]){
  const target=processes.find(x=>x?.name===EXECUTION_PROCESS_NAME);
  return target?.pm2_env&&typeof target.pm2_env==="object"?{...target.pm2_env}:{};
}
async function readPm2(){
  try{
    const {stdout}=await execFileAsync("pm2",["jlist"],{timeout:10000,maxBuffer:2097152});
    const processes=JSON.parse(stdout);
    return {processes,summary:processes.map(projectPm2Process),executionEnv:selectExecutionRuntimeEnv(processes)};
  }catch{
    return {processes:[],summary:[],executionEnv:{}};
  }
}
function lifecycle(){
  try{return fs.existsSync(lifecyclePath)?JSON.parse(fs.readFileSync(lifecyclePath,"utf8")):null}
  catch{return{state:"FAILED_NEEDS_REVIEW"}}
}
export async function runExecutionReadinessOnce({pm2Reader=readPm2}={}){
  const runtime=await pm2Reader();
  const executionEnv=runtime.executionEnv||{};
  const [account,clock]=await Promise.all([
    fetchAlpacaPaperAccountReadonly({env:executionEnv}),
    fetchAlpacaMarketClockReadonly({env:executionEnv}),
  ]);
  const adapter=createPaperAutoExecutionAlpacaPaperAdapter({env:executionEnv,fetchImpl:null}).diagnostics();
  const result=evaluateExecutionReadiness({account,clock,pm2:runtime.summary||[],adapter,env:executionEnv,lifecycle:lifecycle()});
  writeExecutionReadinessStatus(result);
  console.log(JSON.stringify(result));
  return result;
}

export function isDirectExecution(metaUrl=import.meta.url,argv1=process.argv[1]){
  if(!argv1)return false;
  try{return metaUrl===pathToFileURL(path.resolve(argv1)).href}catch{return false}
}

if(isDirectExecution()){
  await runExecutionReadinessOnce();
  setInterval(()=>runExecutionReadinessOnce().catch(error=>console.error(error?.message??error)),waitMs);
}
