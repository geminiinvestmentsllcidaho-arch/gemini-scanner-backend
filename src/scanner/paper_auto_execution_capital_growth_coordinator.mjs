export const VERSION='paper_auto_execution_capital_growth_coordinator_v1'

const clean=v=>String(v??'').trim()
const upper=v=>clean(v).toUpperCase()
const ENTER_UNRESOLVED=new Set(['ENTER_SUBMITTING','ENTER_UNKNOWN','ENTER_OPEN','ENTER_PARTIALLY_FILLED'])
const SCALE_UNRESOLVED=new Set(['PREPARED','SUBMITTING','UNKNOWN','OPEN','PARTIALLY_FILLED','FAILED_NEEDS_REVIEW'])

export function detectPaperCapitalGrowthConflicts({portfolio,readScaleAction,currentLifecycleId=null}={}){
  const current=clean(currentLifecycleId)
  const conflicts=[]
  for(const row of Array.isArray(portfolio?.rows)?portfolio.rows:[]){
    const lifecycle=row?.lifecycle??{}
    const lifecycleId=clean(row?.lifecycleId??lifecycle.lifecycleId)
    const state=upper(row?.state??lifecycle.state)
    if(lifecycleId!==current){
      if(ENTER_UNRESOLVED.has(state)) conflicts.push(Object.freeze({kind:'ENTER',lifecycleId,symbol:upper(row?.symbol??lifecycle.selectedSymbol),state}))
      else if(state==='UNRESOLVED_NEEDS_RECONCILIATION'&&clean(lifecycle.enterClientOrderId)&&!clean(lifecycle.exitClientOrderId)&&!clean(lifecycle.exitBrokerOrderId)){
        conflicts.push(Object.freeze({kind:'ENTER',lifecycleId,symbol:upper(row?.symbol??lifecycle.selectedSymbol),state}))
      }
    }
    if(typeof readScaleAction==='function'&&lifecycleId!==current){
      const action=readScaleAction(row)?.current??null
      if(clean(action?.action).toLowerCase()==='scale_in'&&SCALE_UNRESOLVED.has(upper(action?.state))){
        conflicts.push(Object.freeze({kind:'SCALE_IN',lifecycleId:clean(action.lifecycleId)||lifecycleId,symbol:upper(action.symbol??row?.symbol),state:upper(action.state)}))
      }
    }
  }
  return Object.freeze({allowed:conflicts.length===0,status:conflicts.length?'CAPITAL_GROWTH_CONFLICT_UNRESOLVED':'CAPITAL_GROWTH_CLEAR',conflicts:Object.freeze(conflicts)})
}

export function createPaperCapitalGrowthCoordinator({inspectConflicts}={}){
  if(typeof inspectConflicts!=='function')throw new Error('paper_capital_growth_conflict_inspector_required')
  let tail=Promise.resolve()
  const run=({currentLifecycleId=null}={},task)=>{
    if(typeof task!=='function')throw new Error('paper_capital_growth_task_required')
    const prior=tail
    let release
    tail=new Promise(r=>{release=r})
    return prior.then(async()=>{
      const gate=await inspectConflicts({currentLifecycleId})
      if(gate?.allowed!==true)return Object.freeze({allowed:false,status:gate?.status??'CAPITAL_GROWTH_CONFLICT_INSPECTION_FAILED',gate})
      return task(gate)
    }).finally(()=>release())
  }
  return Object.freeze({run})
}

export default {VERSION,detectPaperCapitalGrowthConflicts,createPaperCapitalGrowthCoordinator}
