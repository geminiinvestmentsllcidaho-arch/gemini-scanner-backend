import fs from'node:fs';import path from'node:path';
import{PaperAutoExecutionLifecycleStore as L}from'./paper_auto_execution_lifecycle_store.mjs';
import{PaperAutoExecutionExitReplacementActionStore as R,STATES as A}from'./paper_auto_execution_exit_replacement_action_store.mjs';
import{derivePaperExitReplacementEligibility as E}from'./paper_auto_execution_exit_replacement_eligibility.mjs';
import{submitPaperExitReplacementOrder as S}from'./paper_auto_execution_exit_replacement_submission_boundary.mjs';
import{reconcilePaperExitReplacementAction as C}from'./paper_auto_execution_exit_replacement_reconciliation_service.mjs';
import{derivePaperPositionMutationLockFile as D,acquirePaperPositionMutationLock as Q,releasePaperPositionMutationLock as X}from'./paper_auto_execution_position_mutation_lock.mjs';
export const VERSION='paper_auto_execution_exit_replacement_runner_v1';const c=v=>String(v??'').trim(),U=new Set([A.SUBMITTING,A.UNKNOWN,A.OPEN,A.PARTIALLY_FILLED]);
export const derivePaperExitReplacementActionFile=f=>{const r=path.resolve(c(f)),b=path.basename(r);if(!b.endsWith('.json'))throw Error('paper_exit_replacement_lifecycle_json_required');return path.join(path.dirname(r),`${b.slice(0,-5)}.exit_replacement_action.json`)};
export function createPaperAutoExecutionExitReplacementRunner(o={}){
 const env=o.env??process.env,getFile=o.getLifecycleFile??(()=>c(env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH??env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH)),fetchAccount=o.fetchAccount,fetchClock=o.fetchMarketClock,fetchOrder=o.fetchOrderByClientOrderId,submit=o.submitPaperOrder,degradedBrokerMode=o.degradedBrokerMode??null,now=o.now??Date.now;
 let inFlight=null,cycles=0,lastStatus='NOT_RUN',lastError=null,lastLifecycleFile=null,lastLifecycle=null,lastAction=null,lastEligibility=null,lastReconciliation=null,lastSubmission=null;
 const diagnostics=()=>Object.freeze({ok:true,version:VERSION,cycles,lastStatus,lastError,lastLifecycleFile,lastLifecycle,lastAction,lastEligibility,lastReconciliation,lastSubmission,degradedBrokerMode:degradedBrokerMode?.diagnostics?.()??null,safety:{paperOnly:true,exactActiveLifecycleOnly:true,sharedExitMutationLock:true,cancellationAllowed:false,blindRetryAllowed:false,liveTradingAllowed:false}});
 const finish=(s,l=lastLifecycle)=>{lastStatus=s;lastLifecycle=l;return diagnostics()};
 async function cycle(){
  cycles++;lastError=null;lastReconciliation=null;lastSubmission=null;lastEligibility=null;
  if(c(env.PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED)!=='1')return finish('EXIT_REPLACEMENT_RUNNER_DISABLED',null);
  const f=c(await getFile?.());lastLifecycleFile=f||null;if(!f)return finish('ACTIVE_LIFECYCLE_PATH_REQUIRED',null);if(!fs.existsSync(f))return finish('ACTIVE_LIFECYCLE_FILE_MISSING',null);
  const ls=new L({filePath:f}),rs=new R({filePath:derivePaperExitReplacementActionFile(f),clock:now});let l=ls.load();lastLifecycle=l;if(!l)return finish('ACTIVE_LIFECYCLE_REQUIRED',null);if(l?.scannerEvidence?.paperOnly!==true)return finish('PAPER_ONLY_LIFECYCLE_REQUIRED',l);
  let a=rs.load()?.current??null;lastAction=a;
  if(a?.state===A.FAILED_NEEDS_REVIEW)return finish('EXIT_REPLACEMENT_FAILED_NEEDS_REVIEW',l);if(a?.state===A.FILLED_RECONCILED)return finish('EXIT_REPLACEMENT_ROUND_TRIP_COMPLETED',l);
  if(a&&U.has(a.state)){
   if(typeof fetchOrder!=='function'||typeof fetchAccount!=='function')return finish('EXIT_REPLACEMENT_RECONCILIATION_DEPENDENCIES_REQUIRED',l);
   lastReconciliation=await C({lifecycleStore:ls,replacementActionStore:rs,fetchOrderByClientOrderId:fetchOrder,fetchAccount,now});l=ls.load();a=rs.load()?.current??null;lastLifecycle=l;lastAction=a;
   if(a&&U.has(a.state))return finish('EXIT_REPLACEMENT_RECONCILIATION_PENDING',l);if(a?.state===A.FILLED_RECONCILED)return finish('EXIT_REPLACEMENT_ROUND_TRIP_COMPLETED',l);
  }
  if(degradedBrokerMode?.evaluateAction){const d=degradedBrokerMode.evaluateAction({action:'EXIT_REPLACEMENT'});if(d?.allowed!==true)return finish(d?.status??'DEGRADED_BROKER_EXIT_REPLACEMENT_BLOCKED',l)}
  let e=E({lifecycle:l});
  if(a?.state===A.PREPARED){
   if(l?.state!=='UNRESOLVED_NEEDS_RECONCILIATION'||c(a.lifecycleId)!==c(l.lifecycleId)||c(a.symbol).toUpperCase()!==c(l.selectedSymbol).toUpperCase()||l?.scannerEvidence?.paperOnly!==true)return finish('PREPARED_REPLACEMENT_LIFECYCLE_CHANGED',l);
   e=Object.freeze({ok:true,version:VERSION,eligible:true,status:'PAPER_EXIT_REPLACEMENT_PREPARED_RESUME_ELIGIBLE',lifecycleId:c(a.lifecycleId),symbol:c(a.symbol).toUpperCase(),residualQuantity:a.residualQuantity,priorExitClientOrderId:c(a.priorExitClientOrderId),priorExitBrokerOrderId:c(a.priorExitBrokerOrderId),terminalReason:c(a.terminalReason).toLowerCase(),paperOnly:true,liveTradingAllowed:false});
  }
  if(a?.state===A.TERMINAL_RECONCILED){
   if(l?.state!=='UNRESOLVED_NEEDS_RECONCILIATION'||c(a.lifecycleId)!==c(l.lifecycleId)||c(a.symbol).toUpperCase()!==c(l.selectedSymbol).toUpperCase()||l?.scannerEvidence?.paperOnly!==true)return finish('TERMINAL_REPLACEMENT_PREDECESSOR_LIFECYCLE_CHANGED',l);
   const rq=Number(a.observedResidualQuantity),fq=Number(a.observedFilledQuantity??0),bo=c(a.brokerOrderId),st=c(a.brokerOrderStatus).toLowerCase();
   if(!Number.isSafeInteger(rq)||rq<=0||!Number.isSafeInteger(fq)||fq<0||fq+rq!==a.quantity||!bo||!['canceled','cancelled','rejected','expired','done_for_day','stopped'].includes(st))return finish('TERMINAL_REPLACEMENT_PREDECESSOR_EVIDENCE_INVALID',l);
   e=Object.freeze({ok:true,version:VERSION,eligible:true,status:'PAPER_EXIT_REPLACEMENT_NEXT_GENERATION_ELIGIBLE',lifecycleId:c(a.lifecycleId),symbol:c(a.symbol).toUpperCase(),residualQuantity:rq,priorExitClientOrderId:c(a.clientOrderId),priorExitBrokerOrderId:bo,terminalReason:st,predecessorReplacementSequence:a.replacementSequence,paperOnly:true,liveTradingAllowed:false});
  }
  lastEligibility=e;if(e?.eligible!==true)return finish(e?.status??'EXIT_REPLACEMENT_NOT_ELIGIBLE',l);if(typeof fetchAccount!=='function')return finish('FRESH_PAPER_ACCOUNT_READER_REQUIRED',l);if(typeof fetchClock!=='function')return finish('PAPER_MARKET_CLOCK_READER_REQUIRED',l);const mc=await fetchClock();if(mc?.ok!==true||mc?.status!=='connected_readonly')return finish('PAPER_MARKET_CLOCK_REQUIRED',l);if(mc?.marketClock?.isOpen!==true)return finish('PAPER_MARKET_OPEN_REQUIRED',l);const mt=Date.parse(mc?.marketClock?.timestamp??''),ma=Number(now())-mt;if(!Number.isFinite(mt)||ma<0||ma>30000)return finish('PAPER_MARKET_CLOCK_STALE',l);
  const lock=Q({lockFile:D(f),lifecycleId:e.lifecycleId,symbol:e.symbol,action:'exit',now});if(lock?.ok!==true)return finish(lock?.status??'POSITION_MUTATION_LOCK_REQUIRED',l);
  try{
   l=ls.load();lastLifecycle=l;a=rs.load()?.current??null;if(a?.state===A.FAILED_NEEDS_REVIEW)return finish('POST_LOCK_EXIT_REPLACEMENT_FAILED_NEEDS_REVIEW',l);if(a?.state===A.FILLED_RECONCILED)return finish('EXIT_REPLACEMENT_ROUND_TRIP_COMPLETED',l);if(a&&U.has(a.state))return finish('POST_LOCK_UNRESOLVED_REPLACEMENT_ACTION',l);
   let p=E({lifecycle:l});
   if(a?.state===A.PREPARED){
    if(l?.state!=='UNRESOLVED_NEEDS_RECONCILIATION'||c(a.lifecycleId)!==c(l.lifecycleId)||c(a.symbol).toUpperCase()!==c(l.selectedSymbol).toUpperCase()||l?.scannerEvidence?.paperOnly!==true)return finish('POST_LOCK_PREPARED_REPLACEMENT_LIFECYCLE_CHANGED',l);
    p=Object.freeze({ok:true,version:VERSION,eligible:true,status:'PAPER_EXIT_REPLACEMENT_PREPARED_RESUME_ELIGIBLE',lifecycleId:c(a.lifecycleId),symbol:c(a.symbol).toUpperCase(),residualQuantity:a.residualQuantity,priorExitClientOrderId:c(a.priorExitClientOrderId),priorExitBrokerOrderId:c(a.priorExitBrokerOrderId),terminalReason:c(a.terminalReason).toLowerCase(),paperOnly:true,liveTradingAllowed:false});
   }
   if(a?.state===A.TERMINAL_RECONCILED){
    if(l?.state!=='UNRESOLVED_NEEDS_RECONCILIATION'||c(a.lifecycleId)!==c(l.lifecycleId)||c(a.symbol).toUpperCase()!==c(l.selectedSymbol).toUpperCase()||l?.scannerEvidence?.paperOnly!==true)return finish('POST_LOCK_TERMINAL_REPLACEMENT_PREDECESSOR_LIFECYCLE_CHANGED',l);
    const rq=Number(a.observedResidualQuantity),fq=Number(a.observedFilledQuantity??0),bo=c(a.brokerOrderId),st=c(a.brokerOrderStatus).toLowerCase();
    if(!Number.isSafeInteger(rq)||rq<=0||!Number.isSafeInteger(fq)||fq<0||fq+rq!==a.quantity||!bo||!['canceled','cancelled','rejected','expired','done_for_day','stopped'].includes(st))return finish('POST_LOCK_TERMINAL_REPLACEMENT_PREDECESSOR_EVIDENCE_INVALID',l);
    p=Object.freeze({ok:true,version:VERSION,eligible:true,status:'PAPER_EXIT_REPLACEMENT_NEXT_GENERATION_ELIGIBLE',lifecycleId:c(a.lifecycleId),symbol:c(a.symbol).toUpperCase(),residualQuantity:rq,priorExitClientOrderId:c(a.clientOrderId),priorExitBrokerOrderId:bo,terminalReason:st,predecessorReplacementSequence:a.replacementSequence,paperOnly:true,liveTradingAllowed:false});
   }
   lastEligibility=p;if(p?.eligible!==true)return finish(p?.status??'POST_LOCK_EXIT_REPLACEMENT_NOT_ELIGIBLE',l);
   const lmc=await fetchClock();if(lmc?.ok!==true||lmc?.status!=='connected_readonly')return finish('POST_LOCK_PAPER_MARKET_CLOCK_REQUIRED',l);if(lmc?.marketClock?.isOpen!==true)return finish('POST_LOCK_PAPER_MARKET_OPEN_REQUIRED',l);const lmt=Date.parse(lmc?.marketClock?.timestamp??''),lma=Number(now())-lmt;if(!Number.isFinite(lmt)||lma<0||lma>30000)return finish('POST_LOCK_PAPER_MARKET_CLOCK_STALE',l);
   const ac=await fetchAccount(),t=Date.parse(ac?.observedAt??''),age=Number(now())-t;if(ac?.ok!==true||ac?.status!=='connected_readonly'||!Number.isFinite(t)||age<0||age>30000)return finish('FRESH_PAPER_ACCOUNT_REQUIRED',l);
   if(ac?.account?.tradingBlocked===true||ac?.account?.accountBlocked===true)return finish('PAPER_ACCOUNT_BLOCKED',l);
   const ps=(ac?.positions??[]).filter(x=>c(x?.symbol).toUpperCase()===p.symbol);if(ps.length!==1)return finish('EXACT_RESIDUAL_POSITION_REQUIRED',l);const q=Number(ps[0]?.qty??ps[0]?.quantity);if(!Number.isSafeInteger(q)||q!==p.residualQuantity)return finish('RESIDUAL_POSITION_QUANTITY_CHANGED',l);
   if((ac?.openOrders??[]).some(x=>c(x?.symbol).toUpperCase()===p.symbol&&['buy','sell'].includes(c(x?.side).toLowerCase())))return finish('CONFLICTING_OPEN_ORDER_BLOCKS_REPLACEMENT',l);
   if(a?.state===A.PREPARED){
    if(c(a.lifecycleId)!==c(p.lifecycleId)||c(a.symbol).toUpperCase()!==p.symbol||a.residualQuantity!==p.residualQuantity||c(a.priorExitClientOrderId)!==c(p.priorExitClientOrderId)||c(a.priorExitBrokerOrderId)!==c(p.priorExitBrokerOrderId)||c(a.terminalReason).toLowerCase()!==c(p.terminalReason).toLowerCase())return finish('PREPARED_REPLACEMENT_IDENTITY_CHANGED',l);
    lastAction=a;
   }else{
    lastAction=rs.prepare({lifecycleId:p.lifecycleId,symbol:p.symbol,residualQuantity:p.residualQuantity,priorExitClientOrderId:p.priorExitClientOrderId,priorExitBrokerOrderId:p.priorExitBrokerOrderId,terminalReason:p.terminalReason});
   }
   lastSubmission=await S({replacementActionStore:rs,submitPaperOrder:submit,env});a=rs.load()?.current??null;lastAction=a;
   if(a&&U.has(a.state)&&typeof fetchOrder==='function'){lastReconciliation=await C({lifecycleStore:ls,replacementActionStore:rs,fetchOrderByClientOrderId:fetchOrder,fetchAccount,now});lastLifecycle=ls.load();lastAction=rs.load()?.current??null}
   return finish(lastAction?.state===A.FILLED_RECONCILED?'EXIT_REPLACEMENT_ROUND_TRIP_COMPLETED':lastAction?.state===A.FAILED_NEEDS_REVIEW?'EXIT_REPLACEMENT_FAILED_NEEDS_REVIEW':lastAction?.state===A.PREPARED?(lastSubmission?.status??'EXIT_REPLACEMENT_PREPARED'):'EXIT_REPLACEMENT_SUBMITTED_RECONCILIATION_REQUIRED',lastLifecycle);
  }finally{X(lock)}
 }
 return Object.freeze({diagnostics,runOnce(){if(inFlight)return inFlight;inFlight=cycle().catch(e=>{lastError=e?.message??String(e);lastStatus='EXIT_REPLACEMENT_FAILED_CLOSED';return diagnostics()}).finally(()=>{inFlight=null});return inFlight}})
}
export default{VERSION,derivePaperExitReplacementActionFile,createPaperAutoExecutionExitReplacementRunner};
