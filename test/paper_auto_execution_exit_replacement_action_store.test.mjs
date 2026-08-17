import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  STATES as S,
  PaperAutoExecutionExitReplacementActionStore,
} from '../src/scanner/paper_auto_execution_exit_replacement_action_store.mjs'

const make = () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gs-exitrepl-store-'))
  const filePath=path.join(dir,'action.json')
  const store=new PaperAutoExecutionExitReplacementActionStore({filePath,clock:()=>Date.parse('2026-08-16T20:00:00.000Z')})
  return {dir,filePath,store}
}
const prep = store => store.prepare({
  lifecycleId:'life-1',
  symbol:'AAPL',
  residualQuantity:3,
  priorExitClientOrderId:('exit-client-1'),
  priorExitBrokerOrderId:'exit-broker-1',
  terminalReason:'canceled',
})

test('prepare persists sequence identity and locks unresolved replacement mutation', () => {
  const {dir,filePath,store}=make()
  try{
    const a=prep(store)
    assert.equal(a.replacementSequence,1)
    assert.equal(a.state,S.PREPARED)
    assert.equal(a.quantity,3)
    assert.equal(a.side,'sell')
    assert.equal(store.hasUnresolved(),true)
    assert.equal(store.mutationLocked(),true)
    assert.equal(fs.statSync(filePath).mode & 0o777,0o600)
    assert.deepEqual(store.load().current,a)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('restart preserves unresolved exact identity and blocks a second prepare', () => {
  const {dir,filePath,store}=make()
  try{
    const a=prep(store)
    const restarted=new PaperAutoExecutionExitReplacementActionStore({filePath})
    assert.equal(restarted.load().current.clientOrderId,a.clientOrderId)
    assert.throws(()=>prep(restarted),/unresolved_action_exists/)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('valid transition chain keeps deterministic identity immutable', () => {
  const {dir,store}=make()
  try{
    let a=prep(store)
    a=store.transition({expectedReplacementSequence:1,expectedClientOrderId:a.clientOrderId,expectedState:S.PREPARED,nextState:S.SUBMITTING})
    assert.equal(a.state,S.SUBMITTING)
    a=store.transition({expectedReplacementSequence:1,expectedClientOrderId:a.clientOrderId,expectedState:S.SUBMITTING,nextState:S.OPEN,patch:{brokerOrderId:'broker-r1',brokerOrderStatus:'accepted'}})
    assert.equal(a.brokerOrderId,'broker-r1')
    assert.equal(a.priorExitBrokerOrderId,'exit-broker-1')
    assert.equal(a.residualQuantity,3)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('terminal reconciled replacement releases mutation lock for later generation',()=>{
  const {dir,store}=make()
  try{
    let a=store.prepare({lifecycleId:'life-t',symbol:'ABC',residualQuantity:3,priorExitClientOrderId:'prior-c',priorExitBrokerOrderId:'prior-b',terminalReason:'canceled'})
    a=store.transition({expectedReplacementSequence:a.replacementSequence,expectedClientOrderId:a.clientOrderId,expectedState:S.PREPARED,nextState:S.SUBMITTING,patch:{}})
    a=store.transition({expectedReplacementSequence:a.replacementSequence,expectedClientOrderId:a.clientOrderId,expectedState:S.SUBMITTING,nextState:S.TERMINAL_RECONCILED,patch:{brokerOrderId:'repl-b1',brokerOrderStatus:'canceled',reconciledAt:'2026-08-16T20:02:00.000Z',observedFilledQuantity:1,observedResidualQuantity:2}})
    assert.equal(store.mutationLocked(),false)
    const b=store.prepare({lifecycleId:'life-t',symbol:'ABC',residualQuantity:2,priorExitClientOrderId:a.clientOrderId,priorExitBrokerOrderId:'repl-b1',terminalReason:'canceled'})
    assert.equal(b.replacementSequence,2)
    assert.notEqual(b.clientOrderId,a.clientOrderId)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('resolved replacement permits a later distinct sequence', () => {
  const {dir,store}=make()
  try{
    let a=prep(store)
    a=store.transition({expectedReplacementSequence:1,expectedClientOrderId:a.clientOrderId,expectedState:S.PREPARED,nextState:S.SUBMITTING})
    a=store.transition({expectedReplacementSequence:1,expectedClientOrderId:a.clientOrderId,expectedState:S.SUBMITTING,nextState:S.FILLED_RECONCILED,patch:{brokerOrderId:'broker-r1',brokerOrderStatus:'filled',reconciledAt:'2026-08-16T20:01:00.000Z',observedFilledQuantity:3,observedResidualQuantity:0}})
    assert.equal(store.mutationLocked(),false)
    const b=store.prepare({lifecycleId:'life-1',symbol:'AAPL',residualQuantity:2,priorExitClientOrderId:a.clientOrderId,priorExitBrokerOrderId:'broker-r1',terminalReason:'expired'})
    assert.equal(b.replacementSequence,2)
    assert.notEqual(b.clientOrderId,a.clientOrderId)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('tampered deterministic identity and forbidden patch keys fail closed', () => {
  const {dir,filePath,store}=make()
  try{
    const a=prep(store)
    const raw=JSON.parse(fs.readFileSync(filePath,'utf8'))
    raw.current.quantity=99
    fs.writeFileSync(filePath,JSON.stringify(raw))
    assert.throws(()=>store.load(),/store_invalid/)
    fs.rmSync(filePath,{force:true})
    const b=prep(store)
    assert.throws(()=>store.transition({expectedReplacementSequence:1,expectedClientOrderId:b.clientOrderId,expectedState:S.PREPARED,nextState:S.SUBMITTING,patch:{symbol:'MSFT'}}),/patch_forbidden/)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})
