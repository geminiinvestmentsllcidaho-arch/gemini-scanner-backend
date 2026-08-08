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

test('ENTER mock boundary exercises deterministic submission state with no broker', async () => {
  const { store, identity } = enterFixture(); const nowMs = 1786128300000
  const handoff = { ok:true, status:'READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY', mode:'ENTER', order:{ qty:1 } }
  const out = await exerciseCustomerPaperMockExecutionBoundary({ handoff, lifecycleStore:store, nowMs })
  assert.equal(out.status, 'MOCK_FULL_LIFECYCLE_COMPLETED_NO_BROKER')
  assert.equal(out.submission.adapterInvoked, true)
  assert.equal(out.submission.identity.clientOrderId, identity.clientOrderId)
  assert.equal(out.lifecycle.state, 'MONITORING')
  assert.equal(out.reconciliation.nextState, 'POSITION_CONFIRMED')
  assert.equal(out.mockObservations.orders[0].status, 'filled')
  assert.equal(out.mockObservations.positions[0].qty, 1)
  assert.equal(out.safety.humanAuthorizationRequired, false)
  assert.equal(out.safety.brokerContactAllowed, false)
})

test('EXIT mock boundary exercises exact MONITORING lifecycle with no broker', async () => {
  const dir = tmp(); const file = path.join(dir,'lifecycle.json'); const store = new PaperAutoExecutionLifecycleStore({ filePath:file })
  store.create({ selectedSymbol:'BTG' }); store.transition('ENTER_SUBMITTING',{enterClientOrderId:'enter-x'}); store.transition('ENTER_OPEN',{enterBrokerOrderId:'mock-enter'}); store.transition('POSITION_CONFIRMED',{filledQuantity:2,averageFillPrice:4.5,brokerPositionIdentity:'BTG:2'}); const lifecycle = store.transition('MONITORING')
  const nowMs = 1786128300000
  const handoff = { ok:true, status:'READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY', mode:'EXIT', order:{ qty:2 } }
  const out = await exerciseCustomerPaperMockExecutionBoundary({ handoff, lifecycleStore:store, nowMs })
  assert.equal(out.submission.adapterInvoked, true)
  assert.equal(out.lifecycle.state, 'ROUND_TRIP_COMPLETED')
  assert.equal(out.reconciliation.nextState, 'ROUND_TRIP_COMPLETED')
  assert.equal(out.mockObservations.orders[0].status, 'filled')
  assert.equal(out.mockObservations.positions.length, 0)
  assert.equal(out.lifecycle.lifecycleId, lifecycle.lifecycleId)
  assert.equal(out.safety.humanAuthorizationRequired, false)
  assert.equal(out.safety.realOrderPlacementAllowed, false)
  assert.equal(out.safety.syntheticReconciliationOnly, true)
})
