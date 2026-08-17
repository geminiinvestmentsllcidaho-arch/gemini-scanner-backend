export const VERSION='paper_auto_execution_exit_replacement_eligibility_v1'
const clean=v=>String(v??'').trim()
const whole=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null}
const terminal=new Set(['canceled','cancelled','rejected','expired','done_for_day','stopped'])

export function derivePaperExitReplacementEligibility({lifecycle}={}){
  const fail=status=>Object.freeze({ok:true,version:VERSION,eligible:false,status})
  if(!lifecycle||typeof lifecycle!=='object')return fail('LIFECYCLE_REQUIRED')
  if(lifecycle?.scannerEvidence?.paperOnly!==true)return fail('PAPER_ONLY_LIFECYCLE_REQUIRED')
  if(clean(lifecycle.state)!=='UNRESOLVED_NEEDS_RECONCILIATION')return fail('UNRESOLVED_EXIT_LIFECYCLE_REQUIRED')
  const rows=Array.isArray(lifecycle.reconciliation)?lifecycle.reconciliation:[]
  const row=[...rows].reverse().find(x=>Array.isArray(x?.blockers)&&x.blockers.includes('exit_order_terminal_with_residual_position'))
  if(!row)return fail('TERMINAL_RESIDUAL_RECONCILIATION_EVIDENCE_REQUIRED')
  const symbol=clean(lifecycle.selectedSymbol).toUpperCase()
  const lifecycleQty=whole(lifecycle.filledQuantity)
  const exitClientOrderId=clean(row.exitClientOrderId)
  const exitBrokerOrderId=clean(row.exitBrokerOrderId)
  const lifecycleExitClientOrderId=clean(lifecycle.exitClientOrderId)
  const lifecycleExitBrokerOrderId=clean(lifecycle.exitBrokerOrderId)
  const status=clean(row.exitOrderStatus).toLowerCase()
  const orderQty=whole(row.exitOrderQuantity)
  const filledQty=row.exitFilledQuantity==null?0:whole(row.exitFilledQuantity)
  const residualQty=whole(row.residualPositionQuantity)
  if(!symbol||lifecycleQty===null||lifecycleQty<=0)return fail('LIFECYCLE_EXIT_IDENTITY_INVALID')
  if(!exitClientOrderId||!exitBrokerOrderId||!terminal.has(status))return fail('TERMINAL_PREDECESSOR_IDENTITY_REQUIRED')
  if(exitClientOrderId!==lifecycleExitClientOrderId)return fail('EXIT_CLIENT_ORDER_IDENTITY_CHANGED')
  if(lifecycleExitBrokerOrderId&&exitBrokerOrderId!==lifecycleExitBrokerOrderId)return fail('EXIT_BROKER_ORDER_IDENTITY_CHANGED')
  if(orderQty===null||orderQty!==lifecycleQty)return fail('EXIT_ORDER_QUANTITY_MISMATCH')
  if(filledQty===null||residualQty===null||residualQty<=0||filledQty+residualQty!==orderQty)return fail('EXIT_FILL_RESIDUAL_QUANTITY_MISMATCH')
  return Object.freeze({
    ok:true,version:VERSION,eligible:true,status:'PAPER_EXIT_REPLACEMENT_ELIGIBLE',
    lifecycleId:clean(lifecycle.lifecycleId),symbol,residualQuantity:residualQty,
    priorExitClientOrderId:exitClientOrderId,priorExitBrokerOrderId:exitBrokerOrderId,
    terminalReason:status,predecessorOrderQuantity:orderQty,predecessorFilledQuantity:filledQty,
    evidenceAt:row.at??null,paperOnly:true,liveTradingAllowed:false,
  })
}
export default{VERSION,derivePaperExitReplacementEligibility}
