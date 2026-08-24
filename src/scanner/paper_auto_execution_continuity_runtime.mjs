import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { STATES as S, terminalStates } from './paper_auto_execution_state_machine.mjs'
import { buildPaperAutoOrderIdentity } from './paper_auto_execution_order_identity.mjs'
import { buildPaperAutoExecutionStrategyEvidence } from './paper_auto_execution_strategy_evidence.mjs'
import { appendPaperAutoExecutionEntryValidationRecord, buildEntryValidationCorrelationId } from './paper_auto_execution_entry_validation_store.mjs'
export const VERSION='paper_auto_execution_continuity_runtime_v1'
const clean=v=>String(v??'').trim(), upper=v=>clean(v).toUpperCase(), on=(e,k)=>clean(e?.[k])==='1'
const CANDIDATE_FRESHNESS_MS=30000, CONTINUITY_SOURCE='paper_auto_continuity_scanner_candidate'
function ageMs(v,n){const t=Date.parse(v??''),a=Number(n)-t;return Number.isFinite(t)&&Number.isFinite(a)&&a>=0?a:null}
function hasNoExecutionEvidence(l){return l?.enterClientOrderId===null&&l?.enterBrokerOrderId===null&&l?.exitClientOrderId===null&&l?.exitBrokerOrderId===null&&l?.filledQuantity===null&&l?.averageFillPrice===null&&l?.brokerPositionIdentity===null}
function expirable(l,n){const a=ageMs(l?.scannerEvidence?.observedAt,n);return l?.state===S.CANDIDATE_SELECTED&&l?.scannerEvidence?.source===CONTINUITY_SOURCE&&l?.scannerEvidence?.paperOnly===true&&hasNoExecutionEvidence(l)&&a!==null&&a>CANDIDATE_FRESHNESS_MS}
function snapshotFresh(s,n){const a=ageMs(s?.observedAt,n);return a!==null&&a<=CANDIDATE_FRESHNESS_MS}
function eligible(c){return upper(c?.state??c?.resultState??c?.decision)==='ENTER'&&c?.buyRecommendation===true&&c?.blocked!==true&&(!Array.isArray(c?.blockers)||c.blockers.length===0)}
function choose(s={}){const a=Array.isArray(s?.candidates)?s.candidates:[];return a.filter(eligible).sort((x,y)=>{const d=(Number(y.score??y.readonlyPotentialScore)||-Infinity)-(Number(x.score??x.readonlyPotentialScore)||-Infinity);return d!==0?d:upper(x?.symbol).localeCompare(upper(y?.symbol))})[0]??null}
export function createPaperAutoExecutionContinuityRuntime(o={}){
 const {env=process.env,getActiveLifecycleFile,setActiveLifecycleFile,getLifecyclePortfolio,filterSnapshotForPortfolio,maxConcurrentLifecycles=env.PAPER_AUTO_MAX_CONCURRENT_LIFECYCLES,getScanSnapshot,runsDir='runs',idFactory=()=>crypto.randomUUID(),storeFactory=f=>new PaperAutoExecutionLifecycleStore({filePath:f}),now=Date.now,appendEntryValidation=appendPaperAutoExecutionEntryValidationRecord,entryValidationEvidencePath=path.join(runsDir,'paper_auto_execution_entry_validation.jsonl')}=o
 let inFlight=null,cycles=0,lastStatus='NOT_RUN',lastLifecycleFile=null,lastLifecycle=null,pendingLifecycleFile=null,lastCycleStartedAt=null,lastCycleCompletedAt=null,lastSnapshotObservedAt=null,lastSnapshotFresh=null,lastSnapshotCandidateCount=null,lastEligibleCandidateCount=null,lastEligibleCandidateSymbol=null
 let entryValidationWrites=0,entryValidationWriteFailures=0,lastEntryValidationError=null,lastEntryValidationRecord=null
 const persistEntryValidation=(input)=>{try{const out=appendEntryValidation?.(input,{evidencePath:entryValidationEvidencePath,now:new Date(Number(now()))});if(out?.record){entryValidationWrites++;lastEntryValidationRecord=out.record;lastEntryValidationError=null}}catch(error){entryValidationWriteFailures++;lastEntryValidationError=clean(error?.message??error)}}
 const recordSnapshot=s=>{const a=Array.isArray(s?.candidates)?s.candidates:[],e=a.filter(eligible);lastSnapshotObservedAt=s?.observedAt??null;lastSnapshotFresh=snapshotFresh(s,now());lastSnapshotCandidateCount=a.length;lastEligibleCandidateCount=e.length;lastEligibleCandidateSymbol=upper(choose(s)?.symbol)||null;for(const c of a){persistEntryValidation({eventType:'candidate_evaluation',correlationId:buildEntryValidationCorrelationId({scanId:c?.originScanId??c?.scanId??s?.scanId,symbol:c?.symbol,observedAt:s?.observedAt}),scanId:c?.originScanId??c?.scanId??s?.scanId,symbol:c?.symbol,candidateObservedAt:s?.observedAt,candidateFresh:snapshotFresh(s,now()),decision:c?.state??c?.resultState??c?.decision,validationStatus:eligible(c)?'WAITING_FOR_ELIGIBLE_ENTRY':'NO_ELIGIBLE_ENTRY',blocker:Array.isArray(c?.blockers)&&c.blockers.length?c.blockers[0]:null,blockers:c?.blockers,candidate:{...c,strategyEvidence:buildPaperAutoExecutionStrategyEvidence({phase:'candidate_validation',candidate:c,snapshotObservedAt:s?.observedAt??null,recordedAt:new Date(Number(now())).toISOString()})}})};return s}
 const diagnostics=()=>Object.freeze({ok:true,version:VERSION,enabled:on(env,'PAPER_AUTO_CONTINUITY_ENABLED'),cycles,lastStatus,lastLifecycleFile,lastLifecycle,lastCycleStartedAt,lastCycleCompletedAt,lastSnapshotObservedAt,lastSnapshotFresh,lastSnapshotCandidateCount,lastEligibleCandidateCount,lastEligibleCandidateSymbol,entryValidationWrites,entryValidationWriteFailures,lastEntryValidationError,lastEntryValidationRecord,safety:Object.freeze({paperOnly:true,disabledByDefault:true,brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,liveTradingAllowed:false,entryValidationObservationalOnly:true,entryValidationFailureBlocksExecution:false})})
 const cycle=async()=>{cycles++;lastCycleStartedAt=new Date(now()).toISOString();if(!on(env,'PAPER_AUTO_CONTINUITY_ENABLED')){lastStatus='CONTINUITY_DISABLED_BY_ENV';return diagnostics()}
  const portfolioMode=typeof getLifecyclePortfolio==='function'
  const portfolio=portfolioMode?await getLifecyclePortfolio():null
  if(portfolioMode){
   const rows=portfolio?.rows,cap=Number(maxConcurrentLifecycles)
   if(!Array.isArray(rows)){lastStatus='LIFECYCLE_PORTFOLIO_REQUIRED';return diagnostics()}
   if(!Number.isInteger(cap)||cap<1){lastStatus='LIFECYCLE_PORTFOLIO_CONCURRENCY_CAP_REQUIRED';return diagnostics()}
   if(rows.length>=cap){lastStatus='LIFECYCLE_PORTFOLIO_CONCURRENCY_CAP_REACHED';return diagnostics()}
  }
  const externallyActiveFile=clean(typeof getActiveLifecycleFile==='function'?await getActiveLifecycleFile():env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH)
  const activeFile=clean(pendingLifecycleFile)||externallyActiveFile;let active=null
  if(activeFile&&fs.existsSync(activeFile))active=storeFactory(activeFile).load()
  let snapshot=null
  if(!portfolioMode&&active&&!terminalStates.has(active.state)&&active.state!=='IDLE'){
   const expirationEnabled=on(env,'PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED')
   if(!clean(pendingLifecycleFile)&&expirationEnabled&&expirable(active,now())){
    if(typeof getScanSnapshot!=='function'){lastStatus='SCAN_SNAPSHOT_REQUIRED';lastLifecycleFile=activeFile;lastLifecycle=active;return diagnostics()}
    snapshot=recordSnapshot(await getScanSnapshot())
    if(!snapshotFresh(snapshot,now())){lastStatus='FRESH_SCAN_REQUIRED_FOR_EXPIRATION';lastLifecycleFile=activeFile;lastLifecycle=active;return diagnostics()}
    const stillEligible=(Array.isArray(snapshot?.candidates)?snapshot.candidates:[]).some(c=>upper(c?.symbol)===upper(active.selectedSymbol)&&eligible(c))
    if(stillEligible){lastStatus='ACTIVE_CANDIDATE_REVALIDATED';lastLifecycleFile=activeFile;lastLifecycle=active;return diagnostics()}
    active=storeFactory(activeFile).transition(S.CANDIDATE_EXPIRED,{reconciliation:[...(active.reconciliation??[]),{kind:'candidate_expired',source:'continuity_runtime',observedAt:active?.scannerEvidence?.observedAt??null,revalidatedAt:snapshot?.observedAt??null,expiredAt:new Date(now()).toISOString(),reason:'FRESH_SCAN_NO_LONGER_ELIGIBLE',candidateFreshnessMs:CANDIDATE_FRESHNESS_MS}]})
    lastStatus='STALE_CANDIDATE_EXPIRED';lastLifecycleFile=activeFile;lastLifecycle=active;return diagnostics()
   }else{lastStatus='ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT';lastLifecycleFile=activeFile;lastLifecycle=active;return diagnostics()}
  }
  if(typeof getScanSnapshot!=='function'&&!snapshot){lastStatus='SCAN_SNAPSHOT_REQUIRED';return diagnostics()}
  snapshot=snapshot??recordSnapshot(await getScanSnapshot())
  const authoritativeSnapshot=snapshot
  if(portfolioMode&&typeof filterSnapshotForPortfolio==='function')snapshot=filterSnapshotForPortfolio(authoritativeSnapshot,portfolio)
  let candidate=choose(snapshot)
  if(!candidate?.symbol){const a=Array.isArray(snapshot?.candidates)?snapshot.candidates:[],best=[...a].sort((x,y)=>(Number(y?.score??y?.readonlyPotentialScore)||-Infinity)-(Number(x?.score??x?.readonlyPotentialScore)||-Infinity))[0]??null,h=snapshot?.sessionHealth??{};persistEntryValidation({eventType:'no_trade_closeout',correlationId:buildEntryValidationCorrelationId({scanId:snapshot?.scanId,symbol:best?.symbol,observedAt:snapshot?.observedAt}),scanId:snapshot?.scanId,symbol:best?.symbol,candidateObservedAt:snapshot?.observedAt,validationStatus:'NO_ELIGIBLE_ENTRY',blocker:'NO_ELIGIBLE_CANDIDATE',blockers:best?.blockers,session:{candidatesReviewed:a.length,eligibleCandidates:0,bestCandidateSymbol:best?.symbol,bestCandidateScore:best?.score??best?.readonlyPotentialScore,marketHealthy:h?.marketHealthy===true,accountHealthy:h?.accountHealthy===true,brokerHealthy:h?.brokerHealthy===true,orderSubmitted:false}});lastStatus='NO_ELIGIBLE_CANDIDATE';lastLifecycleFile=activeFile||null;lastLifecycle=active;return diagnostics()}
  if(!snapshotFresh(snapshot,now())){lastStatus='FRESH_SCAN_REQUIRED_FOR_LIFECYCLE_CREATION';lastLifecycleFile=activeFile||null;lastLifecycle=active;return diagnostics()}
  let creationPortfolio=portfolio
  if(portfolioMode){
   creationPortfolio=await getLifecyclePortfolio()
   const rows=creationPortfolio?.rows,cap=Number(maxConcurrentLifecycles)
   if(!Array.isArray(rows)){lastStatus='LIFECYCLE_PORTFOLIO_REQUIRED';return diagnostics()}
   if(!Number.isInteger(cap)||cap<1){lastStatus='LIFECYCLE_PORTFOLIO_CONCURRENCY_CAP_REQUIRED';return diagnostics()}
   if(rows.length>=cap){lastStatus='LIFECYCLE_PORTFOLIO_CONCURRENCY_CAP_REACHED';return diagnostics()}
   if(typeof filterSnapshotForPortfolio==='function'){
    snapshot=filterSnapshotForPortfolio(authoritativeSnapshot,creationPortfolio)
    candidate=choose(snapshot)
    if(!candidate?.symbol){lastStatus='NO_ELIGIBLE_CANDIDATE';lastLifecycleFile=activeFile||null;lastLifecycle=active;return diagnostics()}
   }
  }
  const id=idFactory(), file=path.join(runsDir,`paper_auto_execution_${id}.json`);if(fs.existsSync(file)){lastStatus='LIFECYCLE_FILE_COLLISION';return diagnostics()}
  const previousRow=portfolioMode?(creationPortfolio?.rows??[]).at(-1)??null:null
  const life=storeFactory(file).create({selectedSymbol:upper(candidate.symbol),scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',observedAt:snapshot?.observedAt??null,originScanId:String(candidate?.originScanId??candidate?.scanId??snapshot?.scanId??'').trim().slice(0,128)||null,originEventAt:String(candidate?.originEventAt??candidate?.eventAt??snapshot?.observedAt??'').trim().slice(0,64)||null,symbol:upper(candidate.symbol),state:upper(candidate.state??candidate.resultState??candidate.decision),score:Number.isFinite(Number(candidate.score??candidate.readonlyPotentialScore))?Number(candidate.score??candidate.readonlyPotentialScore):null,previousLifecycleFile:portfolioMode?(previousRow?.file??null):(activeFile||null),previousLifecycleId:portfolioMode?(previousRow?.lifecycleId??null):(active?.lifecycleId??null),previousLifecycleState:portfolioMode?(previousRow?.state??null):(active?.state??null),paperOnly:true,strategyEvidence:{candidateSelection:buildPaperAutoExecutionStrategyEvidence({phase:'candidate_selection',candidate,snapshotObservedAt:snapshot?.observedAt??null,recordedAt:new Date(now()).toISOString()})}}})
  persistEntryValidation({eventType:'candidate_evaluation',correlationId:buildEntryValidationCorrelationId({lifecycleId:life.lifecycleId,scanId:life?.scannerEvidence?.originScanId,symbol:life.selectedSymbol,observedAt:life?.scannerEvidence?.observedAt}),lifecycleId:life.lifecycleId,lifecycleState:life.state,scanId:life?.scannerEvidence?.originScanId,symbol:life.selectedSymbol,candidateObservedAt:life?.scannerEvidence?.observedAt,candidateFresh:true,decision:life?.scannerEvidence?.state,validationStatus:'WAITING_FOR_ELIGIBLE_ENTRY',candidate:{...candidate,strategyEvidence:life?.scannerEvidence?.strategyEvidence?.candidateSelection}})
  pendingLifecycleFile=file;lastLifecycleFile=file;lastLifecycle=Object.freeze({...life,enterIdentity:null,enterIdentityDeferredForAccountSizing:true})
  if(typeof setActiveLifecycleFile==='function')await setActiveLifecycleFile(file,life)
  pendingLifecycleFile=null
  lastStatus='FRESH_CANDIDATE_LIFECYCLE_CREATED';return diagnostics()}
 const runOnce=()=>inFlight??(inFlight=Promise.resolve().then(cycle).finally(()=>{lastCycleCompletedAt=new Date(now()).toISOString();inFlight=null}))
 return Object.freeze({runOnce,diagnostics})
}
export default {VERSION,createPaperAutoExecutionContinuityRuntime}
