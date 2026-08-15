import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcilePaperScaleAction as reconcile} from '../src/scanner/paper_auto_execution_scale_reconciliation_service.mjs'
const nowMs=Date.parse('2026-08-15T12:00:00Z')
const action={lifecycleId:'life-1',action:'scale_in',symbol:'ABC',actionSequence:1,fromQuantity:2,targetQuantity:3,quantity:1,side:'buy',clientOrderId:'gs-pa-scalein-test',state:'UNKNOWN'}
const lifecycle={lifecycleId:'life-1',selectedSymbol:'ABC',state:'MONITORING',filledQuantity:2,averageFillPrice:10,brokerPositionIdentity:'ABC:2'}
function stores(){
 let a={...action},l={...lifecycle}; const transitions=[],patches=[]
 return {transitions,patches,
  scaleActionStore:{load(){return{current:a}},transition(x){assert.equal(x.expectedState,a.state);a={...a,...x.patch,state:x.nextState};transitions.push(x.nextState);return a}},
  lifecycleStore:{load(){return l},patchMonitoring(x){patches.push({...x});l={...l,...x,state:'MONITORING'};return l}}}
}
const lookup=order=>async()=>order===null?{ok:true,status:'order_not_found'}:{ok:true,status:'order_found',order}
const account=positions=>async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-15T11:59:50Z',account:{tradingBlocked:false,accountBlocked:false},positions})

test('exact fill patches lifecycle before sidecar release',async()=>{
 const x=stores()
 const order={id:'b1',status:'filled',client_order_id:'gs-pa-scalein-test',filled_qty:'1'}
 const r=await reconcile({lifecycleStore:x.lifecycleStore,scaleActionStore:x.scaleActionStore,fetchOrderByClientOrderId:lookup(order),fetchAccount:account([{symbol:'ABC',qty:'3',avg_entry_price:'10.5'}]),now:()=>nowMs})
 assert.equal(r.status,'PAPER_SCALE_ACTION_RECONCILED_MONITORING')
 assert.equal(r.reconciled,true)
 assert.equal(x.patches.length,1)
 assert.equal(x.transitions.at(-1),'FILLED_RECONCILED')
})

test('order not found remains unresolved without lifecycle patch',async()=>{
 const x=stores()
 const r=await reconcile({lifecycleStore:x.lifecycleStore,scaleActionStore:x.scaleActionStore,fetchOrderByClientOrderId:lookup(null),fetchAccount:account([]),now:()=>nowMs})
 assert.equal(r.status,'EXACT_SCALE_ORDER_NOT_YET_PROVEN')
 assert.equal(r.reconciled,false)
 assert.equal(x.patches.length,0)
 assert.equal(x.transitions.length,0)
})

test('one-share partial fill is impossible and fails closed for review without lifecycle patch',async()=>{
 const x=stores()
 const order={id:'b2',status:'partially_filled',client_order_id:'gs-pa-scalein-test',filled_qty:'1'}
 const r=await reconcile({lifecycleStore:x.lifecycleStore,scaleActionStore:x.scaleActionStore,fetchOrderByClientOrderId:lookup(order),fetchAccount:account([]),now:()=>nowMs})
 assert.equal(r.status,'SCALE_PARTIAL_FILL_INVALID_REVIEW_REQUIRED')
 assert.equal(r.reconciled,false)
 assert.equal(r.action.state,'FAILED_NEEDS_REVIEW')
 assert.equal(x.patches.length,0)
 assert.deepEqual(x.transitions,['FAILED_NEEDS_REVIEW'])
})

test('stale account blocks exact fill reconciliation without lifecycle patch or sidecar release',async()=>{
 const x=stores()
 const order={id:'b3',status:'filled',client_order_id:'gs-pa-scalein-test',filled_qty:'1'}
 const stale=async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-15T11:58:00Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'3',avg_entry_price:'10.5'}]})
 const r=await reconcile({lifecycleStore:x.lifecycleStore,scaleActionStore:x.scaleActionStore,fetchOrderByClientOrderId:lookup(order),fetchAccount:stale,now:()=>nowMs})
 assert.equal(r.status,'FRESH_PAPER_ACCOUNT_STALE_FOR_SCALE_RECONCILIATION')
 assert.equal(r.reconciled,false)
 assert.equal(x.patches.length,0)
 assert.equal(x.transitions.length,0)
})

test('canonical MONITORING patch failure leaves scale action unresolved',async()=>{
 const x=stores()
 const order={id:'b4',status:'filled',client_order_id:'gs-pa-scalein-test',filled_qty:'1'}
 x.lifecycleStore.patchMonitoring=()=>{throw new Error('canonical_patch_failed')}
 await assert.rejects(
  reconcile({
   lifecycleStore:x.lifecycleStore,
   scaleActionStore:x.scaleActionStore,
   fetchOrderByClientOrderId:lookup(order),
   fetchAccount:account([{symbol:'ABC',qty:'3',avg_entry_price:'10.5'}]),
   now:()=>nowMs,
  }),
  /canonical_patch_failed/,
 )
 assert.equal(x.transitions.length,0)
 assert.equal(x.scaleActionStore.load().current.state,'UNKNOWN')
})
