import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { submitPaperAutoOrder } from '../src/scanner/paper_auto_execution_submission_boundary.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'

function fixture(symbol = 'AAPL') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-submit-'))
  const store = new PaperAutoExecutionLifecycleStore({ filePath: path.join(dir, 'state.json'), clock: () => 1785819600000, idFactory: () => 'life-submit-1' })
  store.create({ selectedSymbol: symbol })
  return { dir, store }
}
const env = { PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1', PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1', PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '1' }

test('disabled by default never invokes injected adapter', async () => {
  const { dir, store } = fixture()
  try {
    let calls = 0
    const result = await submitPaperAutoOrder({ lifecycleStore: store, phase: 'enter', submitPaperOrder: async () => { calls += 1 }, env: {} })
    assert.equal(result.status, 'SUBMISSION_DISABLED_BY_ENV')
    assert.equal(calls, 0)
    assert.equal(store.load().state, S.CANDIDATE_SELECTED)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('confirmed enter persists deterministic and broker identities', async () => {
  const { dir, store } = fixture()
  try {
    const result = await submitPaperAutoOrder({ lifecycleStore: store, phase: 'enter', env, submitPaperOrder: async (order) => ({ orderSubmitAttempted: true, orderSubmitted: true, orderId: 'broker-1', echoed: order.clientOrderId }) })
    assert.equal(result.status, 'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
    assert.equal(result.lifecycle.state, S.ENTER_OPEN)
    assert.match(result.lifecycle.enterClientOrderId, /^gs-pa-enter-/)
    assert.equal(result.lifecycle.enterBrokerOrderId, 'broker-1')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('exception becomes enter unknown and replay is blocked by state', async () => {
  const { dir, store } = fixture('MSFT')
  try {
    const incidents = []
    const result = await submitPaperAutoOrder({ lifecycleStore: store, phase: 'enter', env, incidentEmitter: async (incident) => { incidents.push(incident) }, submitPaperOrder: async () => { throw new Error('timeout_after_send') } })
    assert.equal(result.lifecycle.state, S.ENTER_UNKNOWN)
    assert.equal(incidents.length, 1)
    assert.equal(incidents[0].source, 'paper_execution')
    assert.equal(incidents[0].failureCode, 'submission_exception_requires_reconciliation')
    await assert.rejects(submitPaperAutoOrder({ lifecycleStore: store, phase: 'enter', env, submitPaperOrder: async () => ({ orderSubmitted: true, orderId: 'duplicate' }) }), /paper_auto_enter_submission_invalid_state:ENTER_UNKNOWN/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('authoritative exit decision evidence persists atomically from EXIT_TRIGGERED through submission state', async () => {
  const { dir, store } = fixture('BTG')
  try {
    store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'cid-enter' })
    store.transition(S.POSITION_CONFIRMED, { filledQuantity: 1, brokerPositionIdentity: 'BTG:1' })
    store.transition(S.MONITORING)
    const exitDecisionEvidence = {
      version: 'paper_auto_execution_exit_decision_v1',
      lifecycleId: 'life-submit-1',
      symbol: 'BTG',
      decision: 'EXIT',
      exitRequired: true,
      status: 'AUTHORITATIVE_PROTECTIVE_PAPER_EXIT',
      reasonCodes: ['OWNED_POSITION_HARD_LOSS_REVIEW'],
      protectiveExit: true,
      protectiveType: 'hard_loss',
      priority: 'critical',
      severity: 'critical',
    }
    const result = await submitPaperAutoOrder({
      lifecycleStore: store,
      phase: 'exit',
      quantity: 1,
      exitDecisionEvidence,
      env,
      submitPaperOrder: async () => ({ orderSubmitAttempted: true, orderSubmitted: true, orderId: 'broker-exit-1' }),
    })
    assert.equal(result.lifecycle.state, S.EXIT_UNKNOWN)
    assert.equal(result.lifecycle.exitReason, 'OWNED_POSITION_HARD_LOSS_REVIEW')
    assert.deepEqual(result.lifecycle.exitDecisionEvidence, exitDecisionEvidence)
    const persisted = store.load()
    assert.equal(persisted.exitReason, 'OWNED_POSITION_HARD_LOSS_REVIEW')
    assert.deepEqual(persisted.exitDecisionEvidence, exitDecisionEvidence)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('exact exit quantity is enforced', async () => {
  const { dir, store } = fixture('NVDA')
  try {
    store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'cid-enter' })
    store.transition(S.POSITION_CONFIRMED, { filledQuantity: 2, brokerPositionIdentity: 'asset-nvda' })
    store.transition(S.MONITORING)
    await assert.rejects(submitPaperAutoOrder({ lifecycleStore: store, phase: 'exit', quantity: 1, env, submitPaperOrder: async () => ({}) }), /paper_auto_exit_quantity_mismatch/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})


test('rejected and ambiguous submissions emit fail-open Admin incidents without changing statuses', async () => {
  for (const scenario of [
    { broker: { rejected: true }, status: 'SUBMISSION_REJECTED', failureCode: 'submission_rejected_requires_review' },
    { broker: { orderSubmitAttempted: true, ambiguous: true }, status: 'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED', failureCode: 'ambiguous_submission_requires_reconciliation' },
    { broker: {}, status: 'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED', failureCode: 'submission_unclassified_requires_reconciliation' },
  ]) {
    const { dir, store } = fixture('AMD')
    try {
      const incidents = []
      const result = await submitPaperAutoOrder({ lifecycleStore: store, phase: 'enter', env, incidentEmitter: async (incident) => { incidents.push(incident) }, submitPaperOrder: async () => scenario.broker })
      assert.equal(result.status, scenario.status)
      assert.equal(incidents.length, 1)
      assert.equal(incidents[0].failureCode, scenario.failureCode)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  }
})
