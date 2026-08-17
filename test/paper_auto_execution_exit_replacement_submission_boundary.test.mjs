import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionExitReplacementActionStore, STATES as S } from '../src/scanner/paper_auto_execution_exit_replacement_action_store.mjs'
import { submitPaperExitReplacementOrder } from '../src/scanner/paper_auto_execution_exit_replacement_submission_boundary.mjs'

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gs-exitrepl-submit-'))
  const store=new PaperAutoExecutionExitReplacementActionStore({filePath:path.join(dir,'action.json')})
  const action=store.prepare({
    lifecycleId:'life-1',symbol:'AAPL',residualQuantity:2,
    priorExitClientOrderId:'exit-client-1',priorExitBrokerOrderId:'exit-broker-1',
    terminalReason:'canceled',
  })
  return {dir,store,action}
}
const env={
  PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED:'1',
  PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED:'1',
}

test('disabled by default does not call adapter',async()=>{
  const {dir,store}=setup()
  try{
    let calls=0
    const r=await submitPaperExitReplacementOrder({replacementActionStore:store,env:{},submitPaperOrder:async()=>{calls++;return {}}})
    assert.equal(r.status,'EXIT_REPLACEMENT_SUBMISSION_DISABLED_BY_ENV')
    assert.equal(calls,0)
    assert.equal(store.load().current.state,S.PREPARED)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('confirmed PAPER replacement submits exact deterministic sell identity',async()=>{
  const {dir,store,action}=setup()
  try{
    let received
    const r=await submitPaperExitReplacementOrder({replacementActionStore:store,env,submitPaperOrder:async(order,context)=>{
      received={order,context}
      return {orderSubmitted:true,brokerOrderId:'replacement-broker-1',status:'accepted'}
    }})
    assert.equal(r.status,'EXIT_REPLACEMENT_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
    assert.deepEqual(received.order,{
      symbol:'AAPL',qty:2,side:'sell',type:'market',timeInForce:'day',
      clientOrderId:action.clientOrderId,paperOnly:true,
    })
    assert.equal(received.context.phase,'exit_replacement')
    assert.equal(received.context.liveTradingAllowed,false)
    assert.equal(store.load().current.state,S.OPEN)
    assert.equal(store.load().current.brokerOrderId,'replacement-broker-1')
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('submission exception becomes UNKNOWN without retry',async()=>{
  const {dir,store}=setup()
  try{
    let calls=0
    const r=await submitPaperExitReplacementOrder({replacementActionStore:store,env,submitPaperOrder:async()=>{calls++;throw new Error('network-uncertain')}})
    assert.equal(calls,1)
    assert.equal(r.status,'EXIT_REPLACEMENT_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED')
    assert.equal(store.load().current.state,S.UNKNOWN)
    assert.equal(store.load().current.submissionError,'network-uncertain')
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
