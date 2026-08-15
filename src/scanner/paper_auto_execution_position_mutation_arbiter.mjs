export const VERSION='paper_auto_execution_position_mutation_arbiter_v1'
const c=v=>String(v??'').trim()
const exits=new Set(['EXIT_TRIGGERED','EXIT_SUBMITTING','EXIT_UNKNOWN','EXIT_PARTIALLY_FILLED','ROUND_TRIP_COMPLETED','FAILED_NEEDS_REVIEW','UNRESOLVED_NEEDS_RECONCILIATION'])
export function arbitratePaperPositionMutation({lifecycle,scaleActionStore,requestedAction,exitRequired=false}={}){
  const action=c(requestedAction).toLowerCase()
  if(!lifecycle||!c(lifecycle.lifecycleId)||!c(lifecycle.selectedSymbol))return Object.freeze({ok:false,status:'POSITION_MUTATION_LIFECYCLE_REQUIRED',allow:false})
  if(exits.has(c(lifecycle.state)))return Object.freeze({ok:true,status:'FULL_EXIT_LIFECYCLE_HAS_PRECEDENCE',allow:false,exitPrecedence:true,paperOnly:true,liveTradingAllowed:false})
  let locked=false
  try{locked=typeof scaleActionStore?.mutationLocked==='function'&&scaleActionStore.mutationLocked()===true}catch{return Object.freeze({ok:false,status:'SCALE_MUTATION_LOCK_STATE_UNREADABLE',allow:false,paperOnly:true,liveTradingAllowed:false})}
  if(locked)return Object.freeze({ok:true,status:'UNRESOLVED_SCALE_MUTATION_BLOCKS_POSITION_MUTATION',allow:false,exitPrecedence:true,paperOnly:true,liveTradingAllowed:false})
  if(exitRequired===true)return Object.freeze({ok:true,status:'FULL_EXIT_REQUIRED_HAS_PRECEDENCE',allow:action==='exit',exitPrecedence:true,paperOnly:true,liveTradingAllowed:false})
  if(action==='exit')return Object.freeze({ok:true,status:'FULL_EXIT_NOT_REQUIRED',allow:false,exitPrecedence:true,paperOnly:true,liveTradingAllowed:false})
  if(!['scale_in','scale_out'].includes(action))return Object.freeze({ok:false,status:'POSITION_MUTATION_ACTION_REQUIRED',allow:false,paperOnly:true,liveTradingAllowed:false})
  if(c(lifecycle.state)!=='MONITORING')return Object.freeze({ok:true,status:'MONITORING_REQUIRED_FOR_SCALE_MUTATION',allow:false,paperOnly:true,liveTradingAllowed:false})
  return Object.freeze({ok:true,status:'SCALE_MUTATION_ALLOWED',allow:true,exitPrecedence:true,paperOnly:true,liveTradingAllowed:false})
}
export default{VERSION,arbitratePaperPositionMutation}
