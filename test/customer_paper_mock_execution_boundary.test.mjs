import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { buildPaperAutoOrderIdentity } from '../src/scanner/paper_auto_execution_order_identity.mjs'
import { exerciseCustomerPaperMockExecutionBoundary } from '../src/scanner/customer_paper_mock_execution_boundary.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gs-mock-boundary-'))

function enterFixture() {
  const dir = tmp(); const file = path.join(dir, 'lifecycle.json'); const store = new PaperAutoExecutionLifecycleStore({ filePath: file })
  const lifecycle = store.create({ selectedSymbol: 'ABC' })
  const identity = buildPaperAutoOrderIdentity({ lifecycleId: lifecycle.lifecycleId, phase: 'enter', symbol: 'ABC', quantity: 1, side: 'buy' })
  return { dir, store, lifecycle, identity }
}

test('ENTER mock boundary consumes temp latch and exercises submission state with no broker', async () => {
  const { dir, store, lifecycle, identity } = enterFixture(); const nowMs = 1786128300000
  const handoff = { ok:true, status:'READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY', mode:'ENTER', order:{ qty:1 }, authorization:{ authorizationId:'mock-enter-1', operator:'Borac', phrase:'I_APPROVE_ONE_DISABLED_PAPER_AUTO_ENTER_ONCE', scope:'paper_auto_enter_once_only', lifecycleId:lifecycle.lifecycleId, symbol:'ABC', quantity:1, expiresAtMs:nowMs+60000, latchFile:path.join(dir,'enter-latch.json') } }
  const out = await exerciseCustomerPaperMockExecutionBoundary({ handoff, lifecycleStore:store, nowMs })
  assert.equal(out.status, 'MOCK_FULL_LIFECYCLE_COMPLETED_NO_BROKER')
  assert.equal(out.submission.adapterInvoked, true)
  assert.equal(out.submission.identity.clientOrderId, identity.clientOrderId)
  assert.equal(out.lifecycle.state, 'MONITORING')
  assert.equal(out.reconciliation.nextState, 'POSITION_CONFIRMED')
  assert.equal(out.mockObservations.orders[0].status, 'filled')
  assert.equal(out.mockObservations.positions[0].qty, 1)
  assert.equal(fs.existsSync(handoff.authorization.latchFile), true)
  assert.equal(out.safety.brokerContactAllowed, false)
})

test('EXIT mock boundary consumes temp latch and exercises exact MONITORING lifecycle with no broker', async () => {
  const dir = tmp(); const file = path.join(dir,'lifecycle.json'); const store = new PaperAutoExecutionLifecycleStore({ filePath:file })
  store.create({ selectedSymbol:'BTG' }); store.transition('ENTER_SUBMITTING',{enterClientOrderId:'enter-x'}); store.transition('ENTER_OPEN',{enterBrokerOrderId:'mock-enter'}); store.transition('POSITION_CONFIRMED',{filledQuantity:2,averageFillPrice:4.5,brokerPositionIdentity:'BTG:2'}); const lifecycle = store.transition('MONITORING')
  const nowMs = 1786128300000
  const handoff = { ok:true, status:'READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY', mode:'EXIT', order:{ qty:2 }, authorization:{ authorizationId:'mock-exit-1', operator:'Borac', phrase:'I_APPROVE_ONE_EXACT_POSITION_PAPER_AUTO_EXIT_ONCE', scope:'paper_auto_exit_once_only', lifecycleId:lifecycle.lifecycleId, symbol:'BTG', quantity:2, expiresAtMs:nowMs+60000, latchFile:path.join(dir,'exit-latch.json') } }
  const out = await exerciseCustomerPaperMockExecutionBoundary({ handoff, lifecycleStore:store, nowMs })
  assert.equal(out.submission.adapterInvoked, true)
  assert.equal(out.lifecycle.state, 'ROUND_TRIP_COMPLETED')
  assert.equal(out.reconciliation.nextState, 'ROUND_TRIP_COMPLETED')
  assert.equal(out.mockObservations.orders[0].status, 'filled')
  assert.equal(out.mockObservations.positions.length, 0)
  assert.equal(out.authorization.lifecycleId, lifecycle.lifecycleId)
  assert.equal(fs.existsSync(handoff.authorization.latchFile), true)
  assert.equal(out.safety.realOrderPlacementAllowed, false)
  assert.equal(out.safety.syntheticReconciliationOnly, true)
})
