import { STATES as S } from './paper_auto_execution_scale_action_store.mjs'
import { reconcilePaperScaleActionFill } from './paper_auto_execution_scale_action_model.mjs'
import { fetchAlpacaPaperOrderByClientOrderIdReadonly } from './paper_auto_execution_scale_order_lookup.mjs'

export const VERSION='paper_auto_execution_scale_reconciliation_service_v1'
const clean=v=>String(v??'').trim()
const upper=v=>clean(v).toUpperCase()
const whole=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null}
const openStatuses=new Set(['new','accepted','pending_new','accepted_for_bidding','calculated','held'])
const failedStatuses=new Set(['rejected','canceled','expired'])
const unresolvedStates=new Set([S.SUBMITTING,S.UNKNOWN,S.OPEN,S.PARTIALLY_FILLED])

function move(store,current,nextState,patch={}){
  return store.transition({
    expectedActionSequence:current.actionSequence,
    expectedClientOrderId:current.clientOrderId,
    expectedState:current.state,
    nextState,
    patch,
  })
}

export async function reconcilePaperScaleAction({
  lifecycleStore,
  scaleActionStore,
  fetchOrderByClientOrderId=fetchAlpacaPaperOrderByClientOrderIdReadonly,
  fetchAccount,
  now=Date.now,
}={}){
  if(!lifecycleStore||typeof lifecycleStore.load!=='function'||typeof lifecycleStore.patchMonitoring!=='function')throw new Error('paper_scale_reconcile_lifecycle_store_required')
  if(!scaleActionStore||typeof scaleActionStore.load!=='function'||typeof scaleActionStore.transition!=='function')throw new Error('paper_scale_reconcile_action_store_required')
  let action=scaleActionStore.load()?.current??null
  if(!action)return Object.freeze({ok:true,version:VERSION,status:'NO_SCALE_ACTION',reconciled:false})
  if(action.state===S.FILLED_RECONCILED)return Object.freeze({ok:true,version:VERSION,status:'SCALE_ACTION_ALREADY_RECONCILED',reconciled:true,action})
  if(action.state===S.FAILED_NEEDS_REVIEW)return Object.freeze({ok:true,version:VERSION,status:'SCALE_ACTION_FAILED_NEEDS_REVIEW',reconciled:false,action})
  if(action.state===S.PREPARED)return Object.freeze({ok:true,version:VERSION,status:'SCALE_ACTION_PREPARED_NOT_SUBMITTED',reconciled:false,action})
  if(!unresolvedStates.has(action.state))throw new Error('paper_scale_reconcile_state_invalid')
  if(typeof fetchOrderByClientOrderId!=='function')throw new Error('paper_scale_reconcile_exact_order_reader_required')

  const lookup=await fetchOrderByClientOrderId({clientOrderId:action.clientOrderId})
  if(lookup?.ok!==true)return Object.freeze({ok:false,version:VERSION,status:'EXACT_SCALE_ORDER_LOOKUP_FAILED',reconciled:false,action})
  if(lookup.status==='order_not_found')return Object.freeze({ok:true,version:VERSION,status:'EXACT_SCALE_ORDER_NOT_YET_PROVEN',reconciled:false,action})
  if(lookup.status!=='order_found'||!lookup.order)return Object.freeze({ok:false,version:VERSION,status:'EXACT_SCALE_ORDER_LOOKUP_UNRESOLVED',reconciled:false,action})

  const order=lookup.order
  const orderStatus=clean(order.status).toLowerCase()
  const brokerOrderId=clean(order.id)||null
  const common={brokerOrderId,brokerOrderStatus:orderStatus||null}
  if(openStatuses.has(orderStatus)){
    if(action.state===S.OPEN)return Object.freeze({ok:true,version:VERSION,status:'SCALE_ORDER_STILL_OPEN',reconciled:false,action})
    if(action.state===S.PARTIALLY_FILLED)return Object.freeze({ok:true,version:VERSION,status:'SCALE_ORDER_PARTIAL_REMAINS_OPEN',reconciled:false,action})
    action=move(scaleActionStore,action,S.OPEN,common)
    return Object.freeze({ok:true,version:VERSION,status:'SCALE_ORDER_OPEN',reconciled:false,action})
  }

  const filledQty=whole(order.filled_qty ?? order.filledQty)
  if(orderStatus==='partially_filled'){
    if(filledQty===null||filledQty>=action.quantity){
      action=move(scaleActionStore,action,S.FAILED_NEEDS_REVIEW,{...common,failureReason:'partial_fill_quantity_invalid'})
      return Object.freeze({ok:false,version:VERSION,status:'SCALE_PARTIAL_FILL_INVALID_REVIEW_REQUIRED',reconciled:false,action})
    }
    if(action.state!==S.PARTIALLY_FILLED){
      action=move(scaleActionStore,action,S.PARTIALLY_FILLED,{...common,observedFilledQuantity:filledQty})
    }
    return Object.freeze({ok:true,version:VERSION,status:'SCALE_ORDER_PARTIALLY_FILLED',reconciled:false,action})
  }

  if(failedStatuses.has(orderStatus)){
    action=move(scaleActionStore,action,S.FAILED_NEEDS_REVIEW,{...common,failureReason:`broker_order_${orderStatus}`})
    return Object.freeze({ok:true,version:VERSION,status:'SCALE_ORDER_FAILED_NEEDS_REVIEW',reconciled:false,action})
  }

  if(orderStatus!=='filled'){
    return Object.freeze({ok:false,version:VERSION,status:'SCALE_ORDER_STATUS_UNRESOLVED',reconciled:false,action})
  }
  if(filledQty!==action.quantity){
    action=move(scaleActionStore,action,S.FAILED_NEEDS_REVIEW,{...common,observedFilledQuantity:filledQty,failureReason:'filled_quantity_mismatch'})
    return Object.freeze({ok:false,version:VERSION,status:'SCALE_FILLED_QUANTITY_MISMATCH_REVIEW_REQUIRED',reconciled:false,action})
  }
  if(typeof fetchAccount!=='function')throw new Error('paper_scale_reconcile_fresh_account_reader_required')
  const account=await fetchAccount()
  if(account?.ok!==true||account?.status!=='connected_readonly')return Object.freeze({ok:false,version:VERSION,status:'FRESH_PAPER_ACCOUNT_REQUIRED_FOR_SCALE_RECONCILIATION',reconciled:false,action})
  const observed=Date.parse(account.observedAt??'')
  const age=Number(now())-observed
  if(!Number.isFinite(observed)||!Number.isFinite(age)||age<0||age>30000)return Object.freeze({ok:false,version:VERSION,status:'FRESH_PAPER_ACCOUNT_STALE_FOR_SCALE_RECONCILIATION',reconciled:false,action})
  if(account?.account?.tradingBlocked===true||account?.account?.accountBlocked===true)return Object.freeze({ok:false,version:VERSION,status:'PAPER_ACCOUNT_BLOCKED_FOR_SCALE_RECONCILIATION',reconciled:false,action})

  let lifecycle=lifecycleStore.load()
  if(!lifecycle||lifecycle.state!=='MONITORING')return Object.freeze({ok:false,version:VERSION,status:'MONITORING_LIFECYCLE_REQUIRED_FOR_SCALE_RECONCILIATION',reconciled:false,action})
  if(clean(lifecycle.lifecycleId)!==clean(action.lifecycleId)||upper(lifecycle.selectedSymbol)!==upper(action.symbol)||whole(lifecycle.filledQuantity)!==action.fromQuantity){
    return Object.freeze({ok:false,version:VERSION,status:'SCALE_RECONCILIATION_LIFECYCLE_CHANGED',reconciled:false,action})
  }

  const position=(Array.isArray(account.positions)?account.positions:[]).find(p=>upper(p?.symbol)===upper(action.symbol))??null
  const reconciliation=reconcilePaperScaleActionFill({lifecycle,identity:action,order,brokerPositionAfter:position})
  if(reconciliation?.ok!==true)return Object.freeze({ok:false,version:VERSION,status:reconciliation?.status??'SCALE_FILL_RECONCILIATION_FAILED',reconciled:false,action,reconciliation})

  lifecycle=lifecycleStore.patchMonitoring({
    expectedLifecycleId:action.lifecycleId,
    expectedSymbol:action.symbol,
    expectedFromQuantity:action.fromQuantity,
    ...reconciliation.lifecyclePatch,
  })
  action=move(scaleActionStore,action,S.FILLED_RECONCILED,{
    ...common,
    observedFilledQuantity:filledQty,
    reconciledAt:new Date(Number(now())).toISOString(),
  })
  return Object.freeze({ok:true,version:VERSION,status:'PAPER_SCALE_ACTION_RECONCILED_MONITORING',reconciled:true,action,lifecycle,reconciliation,paperOnly:true,liveTradingAllowed:false})
}

export default {VERSION,reconcilePaperScaleAction}
