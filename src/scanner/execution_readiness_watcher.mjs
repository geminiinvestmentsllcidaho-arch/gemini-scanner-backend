import fs from "node:fs";
import path from "node:path";

export const VERSION="execution_readiness_watcher_v2";
export const STATUS_PATH=path.join(process.cwd(),"runs","execution_readiness_watcher_status.json");

const on=(env,key)=>String(env?.[key]??"").trim()==="1";
const AMBIGUOUS_LIFECYCLE_STATES=new Set(["ENTER_UNKNOWN","EXIT_UNKNOWN","FAILED_NEEDS_REVIEW"]);

export function evaluateExecutionReadiness(input={},now=Date.now()){
  const account=input.account??{};
  const clock=input.clock??{};
  const adapter=input.adapter??{};
  const env=input.env??{};
  const pm2=new Map((input.pm2??[]).map(x=>[x.name,x.status]));
  const lifecycle=input.lifecycle??null;

  const checks={
    accountConnected:account.ok===true&&account.status==="connected_readonly",
    paperHost:account.runtime?.baseUrlHost==="paper-api.alpaca.markets",
    credentials:account.runtime?.hasRuntimeKeys===true,
    accountHealthy:Boolean(account.account)&&account.account.accountBlocked!==true&&account.account.tradingBlocked!==true,
    clockConnected:clock.ok===true&&clock.status==="connected_readonly",
    marketOpen:clock.marketClock?.isOpen===true,
    liveDisabled:!on(env,"LIVE_TRADING_ENABLED"),
    dryStopped:!pm2.has("gemini-dry-scanner")||pm2.get("gemini-dry-scanner")==="stopped",
    lifecycleState:lifecycle?.state??"IDLE",
  };

  const activation={
    adapterEnabled:adapter.enabled===true,
    boundaryEnabled:on(env,"PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED"),
    enterEnabled:on(env,"PAPER_AUTO_ENTER_SUBMISSION_ENABLED"),
    exitEnabled:on(env,"PAPER_AUTO_EXIT_SUBMISSION_ENABLED"),
  };
  activation.configured=activation.adapterEnabled&&activation.boundaryEnabled&&activation.enterEnabled&&activation.exitEnabled;

  const blockers=[];
  for(const key of [
    "accountConnected",
    "paperHost",
    "credentials",
    "accountHealthy",
    "clockConnected",
    "liveDisabled",
    "dryStopped",
  ]){
    if(!checks[key])blockers.push(key);
  }
  if(AMBIGUOUS_LIFECYCLE_STATES.has(checks.lifecycleState))blockers.push("lifecycleNeedsReview");

  const infrastructureReady=blockers.length===0;
  const executionReady=infrastructureReady&&activation.configured;

  return Object.freeze({
    version:VERSION,
    generatedAt:new Date(now).toISOString(),
    status:infrastructureReady?"READY":"BLOCKED",
    ready:infrastructureReady,
    infrastructureReady,
    executionActivationConfigured:activation.configured,
    executionReady,
    blockers:Object.freeze(blockers),
    checks:Object.freeze(checks),
    activation:Object.freeze(activation),
    safety:Object.freeze({
      paperOnly:true,
      readOnly:true,
      orderPlacementAllowed:false,
      accountMutationAllowed:false,
      liveTradingAllowed:false,
      reconciliationMutationAllowed:false,
      secretsRedacted:true,
    }),
  });
}

export function readExecutionReadinessStatus(){
  try{
    return JSON.parse(fs.readFileSync(STATUS_PATH,"utf8"));
  }catch{
    return {
      version:VERSION,
      status:"NO_STATUS",
      ready:false,
      infrastructureReady:false,
      executionActivationConfigured:false,
      executionReady:false,
      blockers:["watcher_status_not_available"],
      checks:{},
      activation:{},
      safety:{
        paperOnly:true,
        readOnly:true,
        orderPlacementAllowed:false,
        accountMutationAllowed:false,
        liveTradingAllowed:false,
      },
    };
  }
}

export function writeExecutionReadinessStatus(value){
  fs.mkdirSync(path.dirname(STATUS_PATH),{recursive:true});
  const tmp=`${STATUS_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});
  fs.renameSync(tmp,STATUS_PATH);
}
