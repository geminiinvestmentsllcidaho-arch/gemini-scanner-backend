import {STATES as S} from './paper_auto_execution_exit_replacement_action_store.mjs'
import {fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly as lookupDefault} from './paper_auto_execution_exit_replacement_order_lookup.mjs'
import {STATES as L} from './paper_auto_execution_state_machine.mjs'
export const VERSION='paper_auto_execution_exit_replacement_reconciliation_service_v1'
const c=v=>String(v??'').trim(),u=v=>c(v).toUpperCase(),q=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null}
const open=new Set(['new','accepted','pending_new','accepted_for_bidding','calculated','held','open'])
const terminal=new Set(['canceled','cancelled','rejected','expired','done_for_day','stopped'])
const unresolved=new Set([S.SUBMITTING,S.UNKNOWN,S.OPEN,S.PARTIALLY_FILLED])
const mv=(st,a,n,p={})=>st.transition({expectedReplacementSequence:a.replacementSequence,expectedClientOrderId:a.clientOrderId,expectedState:a.state,nextState:n,patch:p})
export async function reconcilePaperExitReplacementAction({lifecycleStore,replacementActionStore,fetchOrderByClientOrderId=lookupDefault,fetchAccount,now=Date.now}={}){
 if(!lifecycleStore?.load||!lifecycleStore?.transition)throw Error('paper_exit_replacement_reconcile_lifecycle_store_required')
 if(!replacementActionStore?.load||!replacementActionStore?.transition)throw Error('paper_exit_replacement_reconcile_action_store_required')
 let a=replacementActionStore.load()?.current??null
 if(!a)return {ok:true,version:VERSION,status:'NO_EXIT_REPLACEMENT_ACTION',reconciled:false}
 if(a.state===S.FILLED_RECONCILED||a.state===S.TERMINAL_RECONCILED)return {ok:true,version:VERSION,status:'EXIT_REPLACEMENT_ALREADY_RECONCILED',reconciled:true,action:a}
 if(a.state===S.FAILED_NEEDS_REVIEW||a.state===S.PREPARED)return {ok:true,version:VERSION,status:a.state===S.PREPARED?'EXIT_REPLACEMENT_PREPARED_NOT_SUBMITTED':'EXIT_REPLACEMENT_FAILED_NEEDS_REVIEW',reconciled:false,action:a}
 if(!unresolved.has(a.state))throw Error('paper_exit_replacement_reconcile_state_invalid')
 const x=await fetchOrderByClientOrderId({clientOrderId:a.clientOrderId})
 if(x?.ok!==true||x?.brokerContactType!=='readonly_get')return {ok:false,version:VERSION,status:'EXACT_EXIT_REPLACEMENT_ORDER_LOOKUP_FAILED',reconciled:false,action:a}
 if(x.status==='order_not_found')return {ok:true,version:VERSION,status:'EXACT_EXIT_REPLACEMENT_ORDER_NOT_YET_PROVEN',reconciled:false,action:a}
 if(x.status!=='order_found'||!x.order)return {ok:false,version:VERSION,status:'EXACT_EXIT_REPLACEMENT_ORDER_LOOKUP_UNRESOLVED',reconciled:false,action:a}
 const o=x.order,s=c(o.status).toLowerCase(),b=c(o.id)||null,f=q(o.filled_qty??o.filledQty),oq=q(o.qty??o.quantity),common={brokerOrderId:b,brokerOrderStatus:s||null}
 if(c(o.client_order_id??o.clientOrderId)!==a.clientOrderId||u(o.symbol)!==u(a.symbol)||c(o.side).toLowerCase()!=='sell'||oq!==a.quantity){
  a=mv(replacementActionStore,a,S.FAILED_NEEDS_REVIEW,{...common,failureReason:'replacement_order_identity_mismatch'});return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_ORDER_IDENTITY_MISMATCH_REVIEW_REQUIRED',reconciled:false,action:a}
 }
 if(open.has(s)){if(a.state!==S.OPEN&&a.state!==S.PARTIALLY_FILLED)a=mv(replacementActionStore,a,S.OPEN,common);return {ok:true,version:VERSION,status:'EXIT_REPLACEMENT_ORDER_OPEN',reconciled:false,action:a}}
 if(s==='partially_filled'&&(f===null||f<=0||f>=a.quantity)){a=mv(replacementActionStore,a,S.FAILED_NEEDS_REVIEW,{...common,observedFilledQuantity:f,failureReason:'replacement_partial_fill_quantity_invalid'});return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_PARTIAL_FILL_INVALID_REVIEW_REQUIRED',reconciled:false,action:a}}
 if(s!=='partially_filled'&&s!=='filled'&&!terminal.has(s))return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_ORDER_STATUS_UNRESOLVED',reconciled:false,action:a}
 if(typeof fetchAccount!=='function')throw Error('paper_exit_replacement_fresh_account_reader_required')
 const ac=await fetchAccount(),obs=Date.parse(ac?.observedAt??''),age=Number(now())-obs
 if(ac?.ok!==true||ac?.status!=='connected_readonly')return {ok:false,version:VERSION,status:'FRESH_PAPER_ACCOUNT_REQUIRED_FOR_EXIT_REPLACEMENT_RECONCILIATION',reconciled:false,action:a}
 if(!Number.isFinite(obs)||age<0||age>30000)return {ok:false,version:VERSION,status:'FRESH_PAPER_ACCOUNT_STALE_FOR_EXIT_REPLACEMENT_RECONCILIATION',reconciled:false,action:a}
 let l=lifecycleStore.load()
 if(!l||![L.EXIT_SUBMITTING,L.EXIT_UNKNOWN,L.EXIT_PARTIALLY_FILLED,L.UNRESOLVED_NEEDS_RECONCILIATION].includes(l.state)||c(l.lifecycleId)!==c(a.lifecycleId)||u(l.selectedSymbol)!==u(a.symbol)||l?.scannerEvidence?.paperOnly!==true)return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_RECONCILIATION_LIFECYCLE_CHANGED',reconciled:false,action:a}
 const ps=(Array.isArray(ac.positions)?ac.positions:[]).filter(p=>u(p?.symbol)===u(a.symbol))
 if(ps.length>1){a=mv(replacementActionStore,a,S.FAILED_NEEDS_REVIEW,{...common,failureReason:'multiple_matching_positions'});return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_POSITION_IDENTITY_INVALID_REVIEW_REQUIRED',reconciled:false,action:a}}
 const r=ps.length?q(ps[0]?.qty):0
 if(r===null||(f??0)+r!==a.quantity){a=mv(replacementActionStore,a,S.FAILED_NEEDS_REVIEW,{...common,observedFilledQuantity:f,observedResidualQuantity:r,failureReason:'replacement_fill_residual_quantity_mismatch'});return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_FILL_RESIDUAL_MISMATCH_REVIEW_REQUIRED',reconciled:false,action:a}}
 if(s==='partially_filled'){if(a.state!==S.PARTIALLY_FILLED)a=mv(replacementActionStore,a,S.PARTIALLY_FILLED,{...common,observedFilledQuantity:f,observedResidualQuantity:r});return {ok:true,version:VERSION,status:'EXIT_REPLACEMENT_ORDER_PARTIALLY_FILLED',reconciled:false,action:a}}
 if(s==='filled'){
  if(f!==a.quantity||r!==0){a=mv(replacementActionStore,a,S.FAILED_NEEDS_REVIEW,{...common,failureReason:'replacement_filled_position_not_flat'});return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_FILLED_POSITION_NOT_FLAT_REVIEW_REQUIRED',reconciled:false,action:a}}
  const e={at:new Date(Number(now())).toISOString(),kind:'exit_replacement_reconciliation',replacementSequence:a.replacementSequence,replacementClientOrderId:a.clientOrderId,replacementBrokerOrderId:b,replacementOrderStatus:s,replacementFilledQuantity:f,observedResidualQuantity:0,paperOnly:true}
  l=lifecycleStore.transition(L.ROUND_TRIP_COMPLETED,{reconciliation:[...(Array.isArray(l.reconciliation)?l.reconciliation:[]),e]})
  a=mv(replacementActionStore,a,S.FILLED_RECONCILED,{...common,observedFilledQuantity:f,observedResidualQuantity:0,reconciledAt:new Date(Number(now())).toISOString()})
  return {ok:true,version:VERSION,status:'PAPER_EXIT_REPLACEMENT_FILLED_ROUND_TRIP_COMPLETED',reconciled:true,action:a,lifecycle:l,paperOnly:true,liveTradingAllowed:false}
 }
 if(!terminal.has(s)||r<=0)return {ok:false,version:VERSION,status:'EXIT_REPLACEMENT_TERMINAL_RESIDUAL_REQUIRED',reconciled:false,action:a}
 a=mv(replacementActionStore,a,S.TERMINAL_RECONCILED,{...common,observedFilledQuantity:f??0,observedResidualQuantity:r,reconciledAt:new Date(Number(now())).toISOString()})
 return {ok:true,version:VERSION,status:'PAPER_EXIT_REPLACEMENT_TERMINAL_RESIDUAL_RECONCILED',reconciled:true,action:a,lifecycle:l,nextReplacementEligible:true,paperOnly:true,liveTradingAllowed:false}
}
export default {VERSION,reconcilePaperExitReplacementAction}
