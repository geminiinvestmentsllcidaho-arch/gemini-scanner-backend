import fs from "node:fs";
import path from "node:path";
export const VERSION="execution_readiness_watcher_v1";
export const STATUS_PATH=path.join(process.cwd(),"runs","execution_readiness_watcher_status.json");
const on=(e,k)=>String(e?.[k]??"").trim()==="1";
export function evaluateExecutionReadiness(i={},now=Date.now()){
 const a=i.account??{},c=i.clock??{},d=i.adapter??{},e=i.env??{},p=new Map((i.pm2??[]).map(x=>[x.name,x.status])),l=i.lifecycle??null,b=[];
 const checks={
  accountConnected:a.ok===true&&a.status==="connected_readonly",
  paperHost:a.runtime?.baseUrlHost==="paper-api.alpaca.markets",
  credentials:a.runtime?.hasRuntimeKeys===true,
  accountHealthy:Boolean(a.account)&&a.account.accountBlocked!==true&&a.account.tradingBlocked!==true,
  clockConnected:c.ok===true&&c.status==="connected_readonly",
  marketOpen:c.marketClock?.isOpen===true,
  adapterEnabled:d.enabled===true,
  boundaryEnabled:on(e,"PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED"),
  enterEnabled:on(e,"PAPER_AUTO_ENTER_SUBMISSION_ENABLED"),
  exitEnabled:on(e,"PAPER_AUTO_EXIT_SUBMISSION_ENABLED"),
  liveDisabled:!on(e,"LIVE_TRADING_ENABLED"),
  dryStopped:!p.has("gemini-dry-scanner")||p.get("gemini-dry-scanner")==="stopped",
  lifecycleState:l?.state??"IDLE"
 };
 for(const [k,v] of Object.entries(checks)) if(["marketOpen","lifecycleState"].includes(k)===false&&!v)b.push(k);
 if(["ENTER_UNKNOWN","EXIT_UNKNOWN","FAILED_NEEDS_REVIEW"].includes(checks.lifecycleState))b.push("lifecycleNeedsReview");
 return Object.freeze({version:VERSION,generatedAt:new Date(now).toISOString(),status:b.length?"BLOCKED":"READY_FOR_CONTROLLED_PAPER_EXECUTION",ready:b.length===0,blockers:Object.freeze(b),checks:Object.freeze(checks),safety:Object.freeze({paperOnly:true,readOnly:true,orderPlacementAllowed:false,accountMutationAllowed:false,liveTradingAllowed:false,reconciliationMutationAllowed:false,secretsRedacted:true})});
}
export function readExecutionReadinessStatus(){try{return JSON.parse(fs.readFileSync(STATUS_PATH,"utf8"))}catch{return{version:VERSION,status:"NO_STATUS",ready:false,blockers:["watcher_status_not_available"],checks:{},safety:{paperOnly:true,readOnly:true,orderPlacementAllowed:false,accountMutationAllowed:false,liveTradingAllowed:false}}}}
export function writeExecutionReadinessStatus(x){fs.mkdirSync(path.dirname(STATUS_PATH),{recursive:true});const t=`${STATUS_PATH}.${process.pid}.tmp`;fs.writeFileSync(t,`${JSON.stringify(x,null,2)}\n`,{mode:0o600});fs.renameSync(t,STATUS_PATH)}
