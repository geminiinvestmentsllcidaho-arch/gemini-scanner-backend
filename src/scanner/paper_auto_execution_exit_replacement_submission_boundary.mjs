import { STATES as S } from './paper_auto_execution_exit_replacement_action_store.mjs'

export const VERSION='paper_auto_execution_exit_replacement_submission_boundary_v1'
const clean=v=>String(v??'').trim()
const enabled=(env,key)=>clean(env?.[key])==='1'
const safety=extra=>Object.freeze({
  paperOnly:true,
  disabledByDefault:true,
  injectedAdapterOnly:true,
  directBrokerImplementation:false,
  liveTradingAllowed:false,
  automaticStartAllowed:false,
  ...extra,
})
const move=(store,current,nextState,patch={})=>store.transition({
  expectedReplacementSequence:current.replacementSequence,
  expectedClientOrderId:current.clientOrderId,
  expectedState:current.state,
  nextState,
  patch,
})
const classify=result=>{
  const brokerOrderId=clean(result?.brokerOrderId??result?.orderId??result?.id)||null
  const submitted=result?.orderSubmitted===true||result?.submitted===true
  const rejected=result?.rejected===true||clean(result?.status).toLowerCase()==='rejected'
  const ambiguous=result?.ambiguous===true||result?.unknown===true||(result?.orderSubmitAttempted===true&&!submitted&&!rejected)
  if(submitted&&brokerOrderId)return {kind:'confirmed',brokerOrderId}
  if(rejected)return {kind:'rejected',brokerOrderId:null}
  if(ambiguous||submitted)return {kind:'ambiguous',brokerOrderId}
  return {kind:'blocked',brokerOrderId:null}
}

export async function submitPaperExitReplacementOrder({
  replacementActionStore,
  submitPaperOrder,
  env=process.env,
}={}){
  if(!replacementActionStore||typeof replacementActionStore.load!=='function'||typeof replacementActionStore.transition!=='function'){
    throw new Error('paper_exit_replacement_submission_store_required')
  }
  let action=replacementActionStore.load()?.current
  if(!action)throw new Error('paper_exit_replacement_submission_action_missing')
  if(action.state!==S.PREPARED)throw new Error(`paper_exit_replacement_submission_invalid_state:${action.state}`)

  if(!enabled(env,'PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED')||!enabled(env,'PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED')){
    return Object.freeze({
      ok:true,version:VERSION,status:'EXIT_REPLACEMENT_SUBMISSION_DISABLED_BY_ENV',
      adapterInvoked:false,action,
      blockers:Object.freeze(['paper_exit_replacement_submission_not_enabled']),
      safety:safety({brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false}),
    })
  }
  if(typeof submitPaperOrder!=='function'){
    return Object.freeze({
      ok:true,version:VERSION,status:'EXIT_REPLACEMENT_SUBMISSION_ADAPTER_REQUIRED',
      adapterInvoked:false,action,
      blockers:Object.freeze(['injected_paper_order_adapter_required']),
      safety:safety({brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false}),
    })
  }

  action=move(replacementActionStore,action,S.SUBMITTING)
  let result
  try{
    result=await submitPaperOrder(Object.freeze({
      symbol:action.symbol,
      qty:action.quantity,
      side:'sell',
      type:'market',
      timeInForce:'day',
      clientOrderId:action.clientOrderId,
      paperOnly:true,
    }),Object.freeze({
      lifecycleId:action.lifecycleId,
      phase:'exit_replacement',
      replacementSequence:action.replacementSequence,
      predecessorClientOrderId:action.priorExitClientOrderId,
      predecessorBrokerOrderId:action.priorExitBrokerOrderId,
      deterministicIdentity:action,
      liveTradingAllowed:false,
    }))
  }catch(error){
    action=move(replacementActionStore,action,S.UNKNOWN,{submissionError:error?.message??String(error)})
    return Object.freeze({
      ok:true,version:VERSION,status:'EXIT_REPLACEMENT_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED',
      adapterInvoked:true,action,result:null,
      blockers:Object.freeze(['submission_exception_requires_reconciliation']),
      safety:safety({brokerContactAllowed:true,orderPlacementAllowed:true,accountMutationAllowed:true,reconciliationRequired:true}),
    })
  }

  const classification=classify(result)
  if(classification.kind==='confirmed'){
    action=move(replacementActionStore,action,S.OPEN,{
      brokerOrderId:classification.brokerOrderId,
      brokerOrderStatus:clean(result?.status)||null,
    })
  }else if(classification.kind==='rejected'){
    action=move(replacementActionStore,action,S.FAILED_NEEDS_REVIEW,{
      submissionRejected:true,
      brokerOrderStatus:clean(result?.status)||'rejected',
    })
  }else{
    action=move(replacementActionStore,action,S.UNKNOWN,{
      brokerOrderId:classification.brokerOrderId,
      brokerOrderStatus:clean(result?.status)||null,
    })
  }
  return Object.freeze({
    ok:true,version:VERSION,
    status:classification.kind==='confirmed'
      ?'EXIT_REPLACEMENT_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED'
      :classification.kind==='rejected'
        ?'EXIT_REPLACEMENT_SUBMISSION_REJECTED'
       :'EXIT_REPLACEMENT_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED',
    adapterInvoked:true,action,result:result??null,
    blockers:Object.freeze(
      classification.kind==='confirmed'
        ?['broker_authoritative_reconciliation_required']
        :classification.kind==='rejected'
          ?['submission_rejected_requires_review']
         :['ambiguous_submission_requires_reconciliation']
    ),
    safety:safety({
      brokerContactAllowed:true,orderPlacementAllowed:true,accountMutationAllowed:true,
      reconciliationRequired:classification.kind!=='rejected',
    }),
  })
}
export default{VERSION,submitPaperExitReplacementOrder}
