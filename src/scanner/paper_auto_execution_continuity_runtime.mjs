import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { terminalStates } from './paper_auto_execution_state_machine.mjs'
import { buildPaperAutoOrderIdentity } from './paper_auto_execution_order_identity.mjs'
export const VERSION='paper_auto_execution_continuity_runtime_v1'
const clean=v=>String(v??'').trim(), upper=v=>clean(v).toUpperCase(), on=(e,k)=>clean(e?.[k])==='1'
function choose(s={}){const a=Array.isArray(s?.candidates)?s.candidates:[];return a.filter(c=>upper(c.state??c.resultState??c.decision)==='ENTER').filter(c=>c.buyRecommendation===true&&c.blocked!==true).filter(c=>!Array.isArray(c.blockers)||c.blockers.length===0).sort((x,y)=>(Number(y.score??y.readonlyPotentialScore)||-Infinity)-(Number(x.score??x.readonlyPotentialScore)||-Infinity))[0]??null}
export function createPaperAutoExecutionContinuityRuntime(o={}){
 const {env=process.env,getActiveLifecycleFile,setActiveLifecycleFile,getScanSnapshot,runsDir='runs',idFactory=()=>crypto.randomUUID(),storeFactory=f=>new PaperAutoExecutionLifecycleStore({filePath:f})}=o
 let inFlight=null,cycles=0,lastStatus='NOT_RUN',lastLifecycleFile=null,lastLifecycle=null,pendingLifecycleFile=null
 const diagnostics=()=>Object.freeze({ok:true,version:VERSION,enabled:on(env,'PAPER_AUTO_CONTINUITY_ENABLED'),cycles,lastStatus,lastLifecycleFile,lastLifecycle,safety:Object.freeze({paperOnly:true,disabledByDefault:true,brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,liveTradingAllowed:false})})
 const cycle=async()=>{cycles++;if(!on(env,'PAPER_AUTO_CONTINUITY_ENABLED')){lastStatus='CONTINUITY_DISABLED_BY_ENV';return diagnostics()}
  const externallyActiveFile=clean(typeof getActiveLifecycleFile==='function'?await getActiveLifecycleFile():env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH)
  const activeFile=clean(pendingLifecycleFile)||externallyActiveFile;let active=null
  if(activeFile&&fs.existsSync(activeFile))active=storeFactory(activeFile).load()
  if(active&&!terminalStates.has(active.state)&&active.state!=='IDLE'){lastStatus='ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT';lastLifecycleFile=activeFile;lastLifecycle=active;return diagnostics()}
  if(typeof getScanSnapshot!=='function'){lastStatus='SCAN_SNAPSHOT_REQUIRED';return diagnostics()}
  const snapshot=await getScanSnapshot(), candidate=choose(snapshot)
  if(!candidate?.symbol){lastStatus='NO_ELIGIBLE_CANDIDATE';lastLifecycleFile=activeFile||null;lastLifecycle=active;return diagnostics()}
  const id=idFactory(), file=path.join(runsDir,`paper_auto_execution_${id}.json`);if(fs.existsSync(file)){lastStatus='LIFECYCLE_FILE_COLLISION';return diagnostics()}
  const life=storeFactory(file).create({selectedSymbol:upper(candidate.symbol),scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',observedAt:snapshot?.observedAt??null,symbol:upper(candidate.symbol),state:upper(candidate.state??candidate.resultState??candidate.decision),score:Number.isFinite(Number(candidate.score??candidate.readonlyPotentialScore))?Number(candidate.score??candidate.readonlyPotentialScore):null,previousLifecycleFile:activeFile||null,previousLifecycleId:active?.lifecycleId??null,previousLifecycleState:active?.state??null,paperOnly:true}})
  const enterIdentity=buildPaperAutoOrderIdentity({lifecycleId:life.lifecycleId,phase:'enter',symbol:life.selectedSymbol,quantity:1,side:'buy'})
  pendingLifecycleFile=file;lastLifecycleFile=file;lastLifecycle=Object.freeze({...life,enterIdentity})
  if(typeof setActiveLifecycleFile==='function')await setActiveLifecycleFile(file,life)
  pendingLifecycleFile=null
  lastStatus='FRESH_CANDIDATE_LIFECYCLE_CREATED';return diagnostics()}
 const runOnce=()=>inFlight??(inFlight=Promise.resolve().then(cycle).finally(()=>{inFlight=null}))
 return Object.freeze({runOnce,diagnostics})
}
export default {VERSION,createPaperAutoExecutionContinuityRuntime}
