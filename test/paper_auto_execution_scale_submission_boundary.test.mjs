import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionScaleActionStore, STATES as S } from '../src/scanner/paper_auto_execution_scale_action_store.mjs'
import { submitPaperScaleOrder } from '../src/scanner/paper_auto_execution_scale_submission_boundary.mjs'

function fixture(action='scale_in'){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paper-scale-submit-'))
  const store=new PaperAutoExecutionScaleActionStore({filePath:path.join(dir,'state.json'),clock:()=>1785819600000})
  const current=store.prepare({lifecycleId:'life-1',action,symbol:'ABC',fromQuantity:4,targetQuantity:action==='scale_in'?6:2})
  return {dir,store,current}
}

test('disabled by default leaves PREPARED durable and never invokes adapter',async()=>{
  const {dir,store,current}=fixture()
  try{
    let calls=0
    const result=await submitPaperScaleOrder({scaleActionStore:store,env:{},submitPaperOrder:async()=>{calls+=1}})
    assert.equal(result.status,'SCALE_SUBMISSION_DISABLED_BY_ENV')
    assert.equal(result.adapterInvoked,false)
    assert.equal(calls,0)
    assert.equal(store.load().current.state,S.PREPARED)
    assert.equal(store.load().current.clientOrderId,current.clientOrderId)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

const enabledEnv={
  PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1',
  PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',
  PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',
}

test('confirmed submission persists SUBMITTING before adapter then OPEN broker identity',async()=>{
  const {dir,store,current}=fixture('scale_in')
  try{
    let observedState=null
    const result=await submitPaperScaleOrder({
      scaleActionStore:store,
      env:enabledEnv,
      submitPaperOrder:async order=>{
        observedState=store.load().current.state
        assert.equal(order.clientOrderId,current.clientOrderId)
        assert.equal(order.qty,2)
        assert.equal(order.side,'buy')
        assert.equal(order.paperOnly,true)
        return {orderSubmitAttempted:true,orderSubmitted:true,orderId:'broker-scale-1',status:'accepted'}
      },
    })
    assert.equal(observedState,S.SUBMITTING)
    assert.equal(result.status,'SCALE_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
    assert.equal(result.action.state,S.OPEN)
    assert.equal(result.action.brokerOrderId,'broker-scale-1')
    assert.equal(store.mutationLocked(),true)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('submission exception persists UNKNOWN and blocks replay',async()=>{
  const {dir,store}=fixture('scale_out')
  try{
    const result=await submitPaperScaleOrder({
      scaleActionStore:store,
      env:enabledEnv,
      submitPaperOrder:async()=>{throw new Error('timeout_after_send')},
    })
    assert.equal(result.status,'SCALE_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED')
    assert.equal(result.action.state,S.UNKNOWN)
    assert.equal(store.mutationLocked(),true)
    await assert.rejects(
      submitPaperScaleOrder({scaleActionStore:store,env:enabledEnv,submitPaperOrder:async()=>({orderSubmitted:true,orderId:'duplicate'})}),
      /paper_scale_submission_invalid_state:UNKNOWN/
    )
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('rejected submission persists FAILED_NEEDS_REVIEW and remains mutation locked',async()=>{
  const {dir,store}=fixture('scale_in')
  try{
    const result=await submitPaperScaleOrder({
      scaleActionStore:store,
      env:enabledEnv,
      submitPaperOrder:async()=>({orderSubmitAttempted:true,rejected:true,status:'rejected'}),
    })
    assert.equal(result.status,'SCALE_SUBMISSION_REJECTED')
    assert.equal(result.action.state,S.FAILED_NEEDS_REVIEW)
    assert.equal(store.mutationLocked(),true)
    assert.throws(()=>store.prepare({lifecycleId:'life-1',action:'scale_in',symbol:'ABC',fromQuantity:4,targetQuantity:6}),/paper_scale_unresolved_action_exists/)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('ambiguous submitted-without-broker-id persists UNKNOWN and remains mutation locked',async()=>{
  const {dir,store}=fixture('scale_out')
  try{
    const result=await submitPaperScaleOrder({
      scaleActionStore:store,
      env:enabledEnv,
      submitPaperOrder:async()=>({orderSubmitAttempted:true,submitted:true,status:'accepted'}),
    })
    assert.equal(result.status,'SCALE_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED')
    assert.equal(result.action.state,S.UNKNOWN)
    assert.equal(store.mutationLocked(),true)
    assert.equal(result.action.brokerOrderId,null)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('enabled boundary without injected adapter leaves PREPARED durable and performs no submission transition',async()=>{
  const {dir,store,current}=fixture('scale_in')
  try{
    const result=await submitPaperScaleOrder({scaleActionStore:store,env:enabledEnv})
    assert.equal(result.status,'SCALE_SUBMISSION_ADAPTER_REQUIRED')
    assert.equal(result.adapterInvoked,false)
    assert.equal(store.load().current.state,S.PREPARED)
    assert.equal(store.load().current.clientOrderId,current.clientOrderId)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('direction gate independently blocks scale-out while boundary and scale-in are enabled',async()=>{
  const {dir,store}=fixture('scale_out')
  try{
    let calls=0
    const result=await submitPaperScaleOrder({
      scaleActionStore:store,
      env:{
        PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1',
        PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',
        PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'0',
      },
      submitPaperOrder:async()=>{calls+=1},
    })
    assert.equal(result.status,'SCALE_SUBMISSION_DISABLED_BY_ENV')
    assert.equal(calls,0)
    assert.equal(store.load().current.state,S.PREPARED)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
