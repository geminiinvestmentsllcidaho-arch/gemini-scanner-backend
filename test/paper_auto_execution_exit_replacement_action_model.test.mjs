import test from 'node:test'
import assert from 'node:assert/strict'
import { VERSION, buildPaperExitReplacementIdentity } from '../src/scanner/paper_auto_execution_exit_replacement_action_model.mjs'

const base = {
  lifecycleId:'life-1',
  symbol:'AAPL',
  residualQuantity:3,
  priorExitClientOrderId:'gs-pa-exit-original',
  priorExitBrokerOrderId:'broker-original',
  terminalReason:'canceled',
}

test('builds deterministic PAPER-only exact residual EXIT replacement identity', () => {
  const a=buildPaperExitReplacementIdentity({...base,replacementSequence:1})
  const b=buildPaperExitReplacementIdentity({...base,replacementSequence:1})
  assert.equal(a.version,VERSION)
  assert.equal(a.clientOrderId,b.clientOrderId)
  assert.equal(a.quantity,3)
  assert.equal(a.side,'sell')
  assert.equal(a.paperOnly,true)
  assert.equal(a.liveTradingAllowed,false)
  assert.match(a.clientOrderId,/^gs-pa-exitrepl-[0-9a-f]{20}$/)
})

test('replacement sequence produces a distinct deterministic client identity', () => {
  const a=buildPaperExitReplacementIdentity({...base,replacementSequence:1})
  const b=buildPaperExitReplacementIdentity({...base,replacementSequence:2})
  assert.notEqual(a.clientOrderId,b.clientOrderId)
  assert.notEqual(a.digest,b.digest)
})

test('terminal predecessor status is required and bounded', () => {
  for(const terminalReason of ['canceled','cancelled','rejected','expired','done_for_day','stopped']){
    assert.doesNotThrow(()=>buildPaperExitReplacementIdentity({...base,terminalReason,replacementSequence:1}))
  }
  for(const terminalReason of ['open','new','accepted','pending_new','partially_filled','filled','unknown']){
    assert.throws(()=>buildPaperExitReplacementIdentity({...base,terminalReason,replacementSequence:1}),/terminal_reason_invalid/)
  }
})

test('exact predecessor identities and whole residual quantity are mandatory', () => {
  assert.throws(()=>buildPaperExitReplacementIdentity({...base,replacementSequence:1,priorExitClientOrderId:''}),/prior_client_order_id_required/)
  assert.throws(()=>buildPaperExitReplacementIdentity({...base,replacementSequence:1,priorExitBrokerOrderId:''}),/prior_broker_order_id_required/)
  assert.throws(()=>buildPaperExitReplacementIdentity({...base,replacementSequence:1,residualQuantity:0}),/residual_whole_quantity_required/)
  assert.throws(()=>buildPaperExitReplacementIdentity({...base,replacementSequence:1,residualQuantity:1.5}),/residual_whole_quantity_required/)
  assert.throws(()=>buildPaperExitReplacementIdentity({...base,replacementSequence:0}),/sequence_required/)
})
