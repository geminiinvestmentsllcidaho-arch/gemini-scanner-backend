import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {PaperAutoExecutionExitReplacementActionStore,STATES as S} from '../src/scanner/paper_auto_execution_exit_replacement_action_store.mjs'
import {reconcilePaperExitReplacementAction as reconcile} from '../src/scanner/paper_auto_execution_exit_replacement_reconciliation_service.mjs'

const nowMs=Date.parse('2026-08-16T20:10:00.000Z')
function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gs-exitrepl-recon-'))
  const actionStore=new PaperAutoExecutionExitReplacementActionStore({filePath:path.join(dir,'action.json'),clock:()=>nowMs})
  let a=actionStore.prepare({lifecycleId:'life-1',symbol:'ABC',residualQuantity:3,priorExitClientOrderId:'prior-c',priorExitBrokerOrderId:'prior-b',terminalReason:'canceled'})
  a=actionStore.transition({expectedReplacementSequence:a.replacementSequence,expectedClientOrderId:a.clientOrderId,expectedState:S.PREPARED,nextState:S.SUBMITTING})
  a=actionStore.transition({expectedReplacementSequence:a.replacementSequence,expectedClientOrderId:a.clientOrderId,expectedState:S.SUBMITTING,nextState:S.UNKNOWN})
  let lifecycle={lifecycleId:'life-1',state:'EXIT_UNKNOWN',selectedSymbol:'ABC',filledQuantity:3,scannerEvidence:{paperOnly:true},reconciliation:[]}
  const transitions=[]
  const lifecycleStore={
    load(){return structuredClone(lifecycle)},
    transition(nextState,patch={}){transitions.push(nextState);lifecycle={...lifecycle,...structuredClone(patch),state:nextState};return structuredClone(lifecycle)},
  }
  return {dir,actionStore,lifecycleStore,transitions}
}
const lookup=order=>async()=>order===null
  ?{ok:true,status:'order_not_found',brokerContactType:'readonly_get'}
  :{ok:true,status:'order_found',brokerContactType:'readonly_get',order}
const account=positions=>async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:09:50.000Z',account:{tradingBlocked:false,accountBlocked:false},positions})

test('exact replacement order not found remains UNKNOWN and does not mutate lifecycle',async()=>{
  const x=setup()
  try{
    const r=await reconcile({lifecycleStore:x.lifecycleStore,replacementActionStore:x.actionStore,fetchOrderByClientOrderId:lookup(null),fetchAccount:account([]),now:()=>nowMs})
    assert.equal(r.status,'EXACT_EXIT_REPLACEMENT_ORDER_NOT_YET_PROVEN')
    assert.equal(r.reconciled,false)
    assert.equal(x.actionStore.load().current.state,S.UNKNOWN)
    assert.deepEqual(x.transitions,[])
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
})

test('terminal predecessor with exact residual becomes TERMINAL_RECONCILED and permits next generation',async()=>{
  const x=setup()
  try{
    const a=x.actionStore.load().current
    const order={id:'rb-1',client_order_id:a.clientOrderId,symbol:'ABC',side:'sell',qty:'3',filled_qty:'1',status:'canceled'}
    const r=await reconcile({lifecycleStore:x.lifecycleStore,replacementActionStore:x.actionStore,fetchOrderByClientOrderId:lookup(order),fetchAccount:account([{symbol:'ABC',qty:'2'}]),now:()=>nowMs})
    assert.equal(r.status,'PAPER_EXIT_REPLACEMENT_TERMINAL_RESIDUAL_RECONCILED')
    assert.equal(r.reconciled,true)
    assert.equal(r.nextReplacementEligible,true)
    assert.equal(x.actionStore.load().current.state,S.TERMINAL_RECONCILED)
    assert.equal(x.actionStore.mutationLocked(),false)
    assert.deepEqual(x.transitions,[])
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
})

test('filled exact replacement with flat broker position finalizes canonical round trip before sidecar release',async()=>{
  const x=setup()
  try{
    const a=x.actionStore.load().current
    const order={id:'rb-2',client_order_id:a.clientOrderId,symbol:'ABC',side:'sell',qty:'3',filled_qty:'3',status:'filled'}
    const r=await reconcile({lifecycleStore:x.lifecycleStore,replacementActionStore:x.actionStore,fetchOrderByClientOrderId:lookup(order),fetchAccount:account([]),now:()=>nowMs})
    assert.equal(r.status,'PAPER_EXIT_REPLACEMENT_FILLED_ROUND_TRIP_COMPLETED')
    assert.equal(r.reconciled,true)
    assert.deepEqual(x.transitions,['ROUND_TRIP_COMPLETED'])
    assert.equal(r.lifecycle.state,'ROUND_TRIP_COMPLETED')
    assert.equal(x.actionStore.load().current.state,S.FILLED_RECONCILED)
    assert.equal(x.actionStore.mutationLocked(),false)
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
})

test('filled plus residual arithmetic mismatch fails closed for review without lifecycle finalization',async()=>{
  const x=setup()
  try{
    const a=x.actionStore.load().current
    const order={id:'rb-3',client_order_id:a.clientOrderId,symbol:'ABC',side:'sell',qty:'3',filled_qty:'2',status:'filled'}
    const r=await reconcile({lifecycleStore:x.lifecycleStore,replacementActionStore:x.actionStore,fetchOrderByClientOrderId:lookup(order),fetchAccount:account([{symbol:'ABC',qty:'2'}]),now:()=>nowMs})
    assert.equal(r.ok,false)
    assert.equal(r.status,'EXIT_REPLACEMENT_FILL_RESIDUAL_MISMATCH_REVIEW_REQUIRED')
    assert.equal(x.actionStore.load().current.state,S.FAILED_NEEDS_REVIEW)
    assert.deepEqual(x.transitions,[])
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
})

test('missing readonly_get broker contact proof cannot reconcile terminal replacement',async()=>{
  const x=setup()
  try{
    const a=x.actionStore.load().current
    const order={id:'rb-bad-contact',client_order_id:a.clientOrderId,symbol:'ABC',side:'sell',qty:'3',filled_qty:'1',status:'canceled'}
    const r=await reconcile({
      lifecycleStore:x.lifecycleStore,
      replacementActionStore:x.actionStore,
      fetchOrderByClientOrderId:async()=>({ok:true,status:'order_found',order}),
      fetchAccount:account([{symbol:'ABC',qty:'2'}]),
      now:()=>nowMs,
    })
    assert.equal(r.ok,false)
    assert.equal(r.status,'EXACT_EXIT_REPLACEMENT_ORDER_LOOKUP_FAILED')
    assert.equal(x.actionStore.load().current.state,S.UNKNOWN)
    assert.equal(x.actionStore.mutationLocked(),true)
    assert.deepEqual(x.transitions,[])
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
})

test('active broker replacement remains mutation locked and cannot release next generation',async()=>{
  const x=setup()
  try{
    const a=x.actionStore.load().current
    const order={id:'rb-open',client_order_id:a.clientOrderId,symbol:'ABC',side:'sell',qty:'3',filled_qty:'0',status:'accepted'}
    const r=await reconcile({
      lifecycleStore:x.lifecycleStore,
      replacementActionStore:x.actionStore,
      fetchOrderByClientOrderId:lookup(order),
      fetchAccount:account([{symbol:'ABC',qty:'3'}]),
      now:()=>nowMs,
    })
    assert.equal(r.ok,true)
    assert.equal(r.status,'EXIT_REPLACEMENT_ORDER_OPEN')
    assert.equal(r.reconciled,false)
    assert.equal(x.actionStore.load().current.state,S.OPEN)
    assert.equal(x.actionStore.mutationLocked(),true)
    assert.deepEqual(x.transitions,[])
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
})
