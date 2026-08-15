import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionScaleActionStore, STATES as S } from '../src/scanner/paper_auto_execution_scale_action_store.mjs'

function makeStore(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paper-scale-store-'))
  const file=path.join(dir,'state.json')
  let now=Date.parse('2026-08-14T20:00:00Z')
  return { file, store:new PaperAutoExecutionScaleActionStore({filePath:file,clock:()=>now}), tick:()=>{now+=1000} }
}
function prepare(store, action='scale_in', fromQuantity=4, targetQuantity=6){
  return store.prepare({lifecycleId:'life-1',action,symbol:'ABC',fromQuantity,targetQuantity})
}
function move(store,current,nextState,patch={}){
  return store.transition({
    expectedActionSequence:current.actionSequence,
    expectedClientOrderId:current.clientOrderId,
    expectedState:current.state,
    nextState,
    patch,
  })
}

test('prepare persists sequence identity and locks mutation',()=>{
  const {file,store}=makeStore()
  const action=prepare(store)
  assert.equal(action.state,S.PREPARED)
  assert.equal(action.actionSequence,1)
  assert.equal(store.mutationLocked(),true)
  assert.throws(()=>prepare(store),/paper_scale_unresolved_action_exists/)
  const disk=JSON.parse(fs.readFileSync(file,'utf8'))
  assert.equal(disk.lastSequence,1)
  assert.equal(disk.current.clientOrderId,action.clientOrderId)
  assert.equal(fs.statSync(file).mode & 0o777,0o600)
})

test('restart preserves unresolved identity and expected-before guards',()=>{
  const {file,store}=makeStore()
  const prepared=prepare(store)
  const submitting=move(store,prepared,S.SUBMITTING,{brokerOrderId:'broker-1'})
  const restarted=new PaperAutoExecutionScaleActionStore({filePath:file})
  assert.equal(restarted.mutationLocked(),true)
  assert.equal(restarted.load().current.clientOrderId,prepared.clientOrderId)
  assert.throws(()=>restarted.transition({
    expectedActionSequence:2,
    expectedClientOrderId:submitting.clientOrderId,
    expectedState:submitting.state,
    nextState:S.UNKNOWN,
  }),/paper_scale_action_sequence_changed/)
  assert.throws(()=>restarted.transition({
    expectedActionSequence:1,
    expectedClientOrderId:'other',
    expectedState:submitting.state,
    nextState:S.UNKNOWN,
  }),/paper_scale_action_client_order_id_changed/)
  assert.throws(()=>restarted.transition({
    expectedActionSequence:1,
    expectedClientOrderId:submitting.clientOrderId,
    expectedState:S.OPEN,
    nextState:S.UNKNOWN,
  }),/paper_scale_action_state_changed/)
})

test('unknown remains mutation-locked until reconciliation and later action gets a distinct sequence',()=>{
  const {store}=makeStore()
  const prepared=prepare(store)
  const submitting=move(store,prepared,S.SUBMITTING)
  const unknown=move(store,submitting,S.UNKNOWN,{submissionError:'ambiguous'})
  assert.equal(store.mutationLocked(),true)
  assert.throws(()=>prepare(store),/paper_scale_unresolved_action_exists/)
  const reconciled=move(store,unknown,S.FILLED_RECONCILED,{brokerOrderId:'broker-1'})
  assert.equal(reconciled.state,S.FILLED_RECONCILED)
  assert.equal(store.mutationLocked(),false)
  const later=prepare(store,'scale_out',6,5)
  assert.equal(later.actionSequence,2)
  assert.notEqual(later.clientOrderId,prepared.clientOrderId)
})

test('transition graph immutable identity and corrupt state fail closed',()=>{
  const {file,store}=makeStore()
  const prepared=prepare(store)
  assert.throws(()=>move(store,prepared,S.OPEN),/paper_scale_transition_invalid:PREPARED->OPEN/)
  assert.throws(()=>move(store,prepared,S.SUBMITTING,{symbol:'XYZ'}),/paper_scale_transition_patch_forbidden:symbol/)
  fs.writeFileSync(file,'{"version":"paper_auto_execution_scale_action_store_v1","lastSequence":2,"current":{"state":"PREPARED","actionSequence":1}}\n')
  assert.throws(()=>store.load(),/paper_scale_store_invalid/)
})

test('failed-needs-review remains mutation-locked until explicit resolution',()=>{
  const {store}=makeStore()
  const prepared=prepare(store)
  const failed=move(store,prepared,S.FAILED_NEEDS_REVIEW,{failureReason:'broker_rejected'})
  assert.equal(failed.state,S.FAILED_NEEDS_REVIEW)
  assert.equal(store.mutationLocked(),true)
  assert.throws(()=>prepare(store),/paper_scale_unresolved_action_exists/)
})

test('load rejects tampered deterministic identity fields and transition rejects unknown patch keys',()=>{
  const {file,store}=makeStore()
  const prepared=prepare(store)
  const original=JSON.parse(fs.readFileSync(file,'utf8'))

  for(const [key,value] of [
    ['clientOrderId','gs-pa-scalein-tampered'],
    ['digest','0'.repeat(64)],
    ['canonical','tampered-canonical'],
    ['quantity',prepared.quantity+1],
    ['paperOnly',false],
    ['liveTradingAllowed',true],
  ]){
    const tampered=JSON.parse(JSON.stringify(original))
    tampered.current[key]=value
    fs.writeFileSync(file,`${JSON.stringify(tampered,null,2)}
`,{mode:0o600})
    assert.throws(()=>store.load(),/paper_scale_store_invalid/)
  }

  fs.writeFileSync(file,`${JSON.stringify(original,null,2)}
`,{mode:0o600})
  assert.throws(
    ()=>move(store,prepared,S.SUBMITTING,{unexpectedField:'nope'}),
    /paper_scale_transition_patch_forbidden:unexpectedField/,
  )
})
