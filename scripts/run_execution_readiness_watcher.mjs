import {execFile} from"node:child_process";
import {promisify} from"node:util";
import fs from"node:fs";
import path from"node:path";
import {fetchAlpacaPaperAccountReadonly} from"../src/scanner/alpaca_paper_account_readonly_fetch.mjs";
import {fetchAlpacaMarketClockReadonly} from"../src/scanner/alpaca_market_clock_readonly.mjs";
import {createPaperAutoExecutionAlpacaPaperAdapter} from"../src/scanner/paper_auto_execution_alpaca_paper_adapter.mjs";
import {evaluateExecutionReadiness,writeExecutionReadinessStatus} from"../src/scanner/execution_readiness_watcher.mjs";
const ex=promisify(execFile),wait=Math.max(15000,+process.env.GS_EXECUTION_READINESS_WATCH_INTERVAL_MS||30000),lp=process.env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH||path.join(process.cwd(),"runs","paper_auto_execution_active_lifecycle.json");
async function pm2(){try{let{stdout}=await ex("pm2",["jlist"],{timeout:10000,maxBuffer:2097152}),r=JSON.parse(stdout);return r.map(x=>({name:x.name,status:x.pm2_env?.status}))}catch{return[]}}
function lifecycle(){try{return fs.existsSync(lp)?JSON.parse(fs.readFileSync(lp,"utf8")):null}catch{return{state:"FAILED_NEEDS_REVIEW"}}}
async function once(){let[account,clock,procs]=await Promise.all([fetchAlpacaPaperAccountReadonly(),fetchAlpacaMarketClockReadonly(),pm2()]);let adapter=createPaperAutoExecutionAlpacaPaperAdapter({env:process.env,fetchImpl:null}).diagnostics();let r=evaluateExecutionReadiness({account,clock,pm2:procs,adapter,env:process.env,lifecycle:lifecycle()});writeExecutionReadinessStatus(r);console.log(JSON.stringify(r))}
await once();setInterval(()=>once().catch(e=>console.error(e?.message??e)),wait);
