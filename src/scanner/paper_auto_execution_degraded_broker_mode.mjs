import fs from 'node:fs'
import path from 'node:path'

export const VERSION='paper_auto_execution_degraded_broker_mode_v1'
export const DEFAULT_STATUS_PATH=path.resolve('runs/paper_auto_execution_degraded_broker_mode.json')
export const DEFAULT_TRANSIENT_FAILURE_THRESHOLD=3
export const DEFAULT_RECOVERY_SUCCESS_THRESHOLD=2

const clean=v=>String(v??'').trim()
const upper=v=>clean(v).toUpperCase()
const positive=(v,d)=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):d
const RISK_INCREASING=new Set(['ENTER','SCALE_IN'])
const RISK_REDUCING=new Set(['SCALE_OUT','EXIT','EXIT_RECOVERY','EXIT_REPLACEMENT','RECONCILE'])
const IMMEDIATE=new Set(['AMBIGUOUS_SUBMISSION','SUBMISSION_EXCEPTION','UNKNOWN_ORDER_STATE','BROKER_ACCOUNT_BLOCKED'])
const TRANSIENT=new Set(['ACCOUNT_READ_FAILED','MARKET_CLOCK_READ_FAILED','ORDER_READ_FAILED','HISTORY_READ_FAILED','NETWORK_FAILURE','BROKER_UNAVAILABLE'])
const ts=now=>new Date(Number(now())).toISOString()

const base=now=>Object.freeze({
  version:VERSION,state:'normal',degraded:false,reason:null,
  consecutiveTransientFailures:0,consecutiveRecoverySuccesses:0,
  enteredDegradedAt:null,lastFailureAt:null,lastFailureKind:null,lastSuccessAt:null,lastRecoveryProbeId:null,
  updatedAt:ts(now),paperOnly:true,liveTradingAllowed:false,
})

function normalize(x,now){
  const b=base(now)
  if(!x||typeof x!=='object')return b
  const degraded=x.degraded===true||clean(x.state).toLowerCase()==='degraded'
  return Object.freeze({...b,
    state:degraded?'degraded':'normal',degraded,
    reason:degraded?(clean(x.reason)||null):null,
    consecutiveTransientFailures:Math.max(0,Number(x.consecutiveTransientFailures)||0),
    consecutiveRecoverySuccesses:Math.max(0,Number(x.consecutiveRecoverySuccesses)||0),
    enteredDegradedAt:degraded?(clean(x.enteredDegradedAt)||null):null,
    lastFailureAt:clean(x.lastFailureAt)||null,lastFailureKind:clean(x.lastFailureKind)||null,
    lastSuccessAt:clean(x.lastSuccessAt)||null,lastRecoveryProbeId:clean(x.lastRecoveryProbeId)||null,updatedAt:clean(x.updatedAt)||ts(now),
  })
}

function atomicWrite(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true})
  const tmp=`${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600})
  fs.renameSync(tmp,file)
  try{fs.chmodSync(file,0o600)}catch{}
}

export function createPaperAutoExecutionDegradedBrokerMode(options={}){
  const env=options.env??process.env
  const now=options.now??Date.now
  const filePath=path.resolve(clean(options.filePath??env.PAPER_AUTO_DEGRADED_BROKER_STATUS_PATH)||DEFAULT_STATUS_PATH)
  const failureThreshold=positive(options.transientFailureThreshold??env.PAPER_AUTO_DEGRADED_BROKER_TRANSIENT_FAILURE_THRESHOLD,DEFAULT_TRANSIENT_FAILURE_THRESHOLD)
  const recoveryThreshold=positive(options.recoverySuccessThreshold??env.PAPER_AUTO_DEGRADED_BROKER_RECOVERY_SUCCESS_THRESHOLD,DEFAULT_RECOVERY_SUCCESS_THRESHOLD)
  const enabled=()=>clean(env.PAPER_AUTO_DEGRADED_BROKER_MODE_ENABLED)==='1'
  const read=()=>{
    if(!fs.existsSync(filePath))return base(now)
    try{return normalize(JSON.parse(fs.readFileSync(filePath,'utf8')),now)}
    catch{return Object.freeze({...base(now),state:'degraded',degraded:true,reason:'DEGRADED_BROKER_STATE_CORRUPT',enteredDegradedAt:ts(now),updatedAt:ts(now)})}
  }
  const write=s=>{const v=normalize(s,now);atomicWrite(filePath,v);return v}
  const diagnostics=()=>Object.freeze({
    ok:true,version:VERSION,enabled:enabled(),filePath,
    transientFailureThreshold:failureThreshold,recoverySuccessThreshold:recoveryThreshold,
    status:read(),
    policy:Object.freeze({
      riskIncreasingActionsBlockedWhenDegraded:Object.freeze([...RISK_INCREASING]),
      riskReducingActionsAllowedWhenDegraded:Object.freeze([...RISK_REDUCING]),
      immediateDegradeKinds:Object.freeze([...IMMEDIATE]),
      transientFailureKinds:Object.freeze([...TRANSIENT]),
    }),
    safety:Object.freeze({paperOnly:true,disabledByDefault:true,liveTradingAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false}),
  })
  const recordFailure=({kind,reason}={})=>{
    if(!enabled())return diagnostics()
    const k=upper(kind)
    if(!k)throw new Error('degraded_broker_failure_kind_required')
    const cur=read(), transient=TRANSIENT.has(k), immediate=IMMEDIATE.has(k)
    const count=transient?cur.consecutiveTransientFailures+1:cur.consecutiveTransientFailures
    const degrade=cur.degraded||immediate||(transient&&count>=failureThreshold)
    const at=ts(now)
    write({...cur,state:degrade?'degraded':'normal',degraded:degrade,
      reason:degrade?(clean(reason)||k):null,
      consecutiveTransientFailures:count,consecutiveRecoverySuccesses:0,
      enteredDegradedAt:degrade?(cur.enteredDegradedAt||at):null,
      lastFailureAt:at,lastFailureKind:k,updatedAt:at})
    return diagnostics()
  }
  const recordSuccess=({probeId}={})=>{
    if(!enabled())return diagnostics()
    const cur=read(),at=ts(now),probe=clean(probeId)
    if(!cur.degraded){
      write({...cur,consecutiveTransientFailures:0,consecutiveRecoverySuccesses:0,lastSuccessAt:at,lastRecoveryProbeId:probe||cur.lastRecoveryProbeId,updatedAt:at})
      return diagnostics()
    }
    if(!probe||probe===cur.lastRecoveryProbeId)return diagnostics()
    const successes=cur.consecutiveRecoverySuccesses+1
    const recovered=successes>=recoveryThreshold
    write({...cur,state:recovered?'normal':'degraded',degraded:!recovered,
      reason:recovered?null:cur.reason,
      consecutiveTransientFailures:recovered?0:cur.consecutiveTransientFailures,
      consecutiveRecoverySuccesses:recovered?0:successes,
      enteredDegradedAt:recovered?null:cur.enteredDegradedAt,lastSuccessAt:at,lastRecoveryProbeId:probe,updatedAt:at})
    return diagnostics()
  }
  const evaluateAction=({action}={})=>{
    const a=upper(action)
    if(!a)return Object.freeze({allowed:false,status:'DEGRADED_BROKER_ACTION_REQUIRED',action:null,degraded:false})
    if(!enabled())return Object.freeze({allowed:true,status:'DEGRADED_BROKER_MODE_DISABLED_BY_ENV',action:a,degraded:false})
    const s=read()
    if(!s.degraded)return Object.freeze({allowed:true,status:'BROKER_MODE_NORMAL',action:a,degraded:false})
    if(RISK_REDUCING.has(a))return Object.freeze({allowed:true,status:'DEGRADED_BROKER_RISK_REDUCING_ACTION_ALLOWED',action:a,degraded:true,reason:s.reason})
    if(RISK_INCREASING.has(a))return Object.freeze({allowed:false,status:'DEGRADED_BROKER_RISK_INCREASING_ACTION_BLOCKED',action:a,degraded:true,reason:s.reason})
    return Object.freeze({allowed:false,status:'DEGRADED_BROKER_UNKNOWN_ACTION_BLOCKED',action:a,degraded:true,reason:s.reason})
  }
  return Object.freeze({diagnostics,recordFailure,recordSuccess,evaluateAction})
}
export default Object.freeze({VERSION,createPaperAutoExecutionDegradedBrokerMode})
