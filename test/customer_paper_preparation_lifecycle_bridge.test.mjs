import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bridgePaperPreparationToLifecycle } from '../src/scanner/customer_paper_preparation_lifecycle_bridge.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gs-bridge-'))

test('ENTER creates lifecycle and deterministic one-share BUY handoff without broker permission', () => {
  const runsDir = tmp()
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-enter-1', mode: 'ENTER', symbol: 'ABC', quantity: 1,
  }, { runsDir, accountId: 'customer-zero' })
  assert.equal(out.lifecycleState, 'CANDIDATE_SELECTED')
  assert.equal(out.order.qty, 1)
  assert.equal(out.order.side, 'buy')
  assert.match(out.order.clientOrderId, /^gs-pa-enter-/)
  assert.equal(out.safety.orderPlacementAllowed, false)
  assert.equal(out.safety.submissionBoundaryRetained, true)
  assert.equal(fs.existsSync(out.lifecycleFile), true)
})

test('EXIT resolves exactly one matching MONITORING lifecycle and deterministic SELL handoff', () => {
  const runsDir = tmp()
  const now = new Date().toISOString()
  const file = path.join(runsDir, 'paper_auto_enter_only_mechanical_lifecycle_test.json')
  fs.writeFileSync(file, JSON.stringify({
    version: 'paper_auto_execution_lifecycle_v1',
    lifecycleId: 'life-123',
    state: 'MONITORING',
    selectedSymbol: 'BTG',
    enterClientOrderId: 'enter-1',
    enterBrokerOrderId: 'broker-1',
    exitClientOrderId: null,
    exitBrokerOrderId: null,
    filledQuantity: 2,
    averageFillPrice: 4.5,
    brokerPositionIdentity: 'BTG:2',
    reconciliation: [],
    createdAt: now,
    updatedAt: now,
  }))
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-exit-1', mode: 'EXIT', symbol: 'BTG', quantity: 2,
  }, { runsDir })
  assert.equal(out.lifecycleId, 'life-123')
  assert.equal(out.lifecycleState, 'MONITORING')
  assert.equal(out.order.side, 'sell')
  assert.equal(out.order.qty, 2)
  assert.match(out.order.clientOrderId, /^gs-pa-exit-/)
})

test('EXIT fails closed without exactly one matching lifecycle', () => {
  const runsDir = tmp()
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-exit-missing', mode: 'EXIT', symbol: 'USAS', quantity: 1,
  }, { runsDir }), /matching_lifecycle_not_found/)
})

test('ENTER handoff carries exact unconsumed one-shot authorization metadata', () => {
  const runsDir = tmp()
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-auth-enter', mode: 'ENTER', symbol: 'ABC', quantity: 1,
  }, { runsDir, accountId: 'customer-zero' })
  assert.equal(out.authorization.operator, 'Borac')
  assert.equal(out.authorization.scope, 'paper_auto_enter_once_only')
  assert.equal(out.authorization.phrase, 'I_APPROVE_ONE_DISABLED_PAPER_AUTO_ENTER_ONCE')
  assert.equal(out.authorization.lifecycleId, out.lifecycleId)
  assert.equal(out.authorization.symbol, 'ABC')
  assert.equal(out.authorization.quantity, 1)
  assert.equal(out.authorization.consumed, false)
  assert.equal(out.authorization.requiresExplicitConsumptionAtExecutionBoundary, true)
})

test('EXIT handoff carries exact lifecycle-bound unconsumed one-shot authorization metadata', () => {
  const runsDir = tmp()
  const now = new Date().toISOString()
  const file = path.join(runsDir, 'paper_auto_enter_only_mechanical_lifecycle_auth-exit.json')
  fs.writeFileSync(file, JSON.stringify({
    version: 'paper_auto_execution_lifecycle_v1',
    lifecycleId: 'life-auth-exit',
    state: 'MONITORING',
    selectedSymbol: 'BTG',
    enterClientOrderId: 'enter-1',
    enterBrokerOrderId: 'broker-1',
    exitClientOrderId: null,
    exitBrokerOrderId: null,
    filledQuantity: 2,
    averageFillPrice: 4.5,
    brokerPositionIdentity: 'BTG:2',
    reconciliation: [],
    createdAt: now,
    updatedAt: now,
  }))
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-auth-exit', mode: 'EXIT', symbol: 'BTG', quantity: 2,
  }, { runsDir })
  assert.equal(out.authorization.scope, 'paper_auto_exit_once_only')
  assert.equal(out.authorization.phrase, 'I_APPROVE_ONE_EXACT_POSITION_PAPER_AUTO_EXIT_ONCE')
  assert.equal(out.authorization.lifecycleId, 'life-auth-exit')
  assert.equal(out.authorization.symbol, 'BTG')
  assert.equal(out.authorization.quantity, 2)
  assert.equal(out.authorization.consumed, false)
})

test('ENTER authorization handoff has deterministic latch expiry and evaluates without consumption', () => {
  const runsDir = tmp()
  const nowMs = 1786128000000
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-eval-enter', mode: 'ENTER', symbol: 'ABC', quantity: 1,
  }, {
    runsDir,
    accountId: 'customer-zero',
    nowMs,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  assert.equal(out.authorization.expiresAtMs, nowMs + 15 * 60 * 1000)
  assert.match(out.authorization.latchFile, /customer_paper_user_authorization_latches/)
  assert.equal(out.authorizationEvaluation.ok, true)
  assert.equal(out.authorizationEvaluation.authorizationId, out.authorization.authorizationId)
  assert.equal(out.authorization.consumed, false)
  assert.equal(fs.existsSync(out.authorization.latchFile), false)
})

test('EXIT authorization handoff evaluates exact lifecycle target without consumption', () => {
  const runsDir = tmp()
  const now = new Date().toISOString()
  const lifecycleFile = path.join(runsDir, 'paper_auto_enter_only_mechanical_lifecycle_eval-exit.json')
  fs.writeFileSync(lifecycleFile, JSON.stringify({
    version: 'paper_auto_execution_lifecycle_v1',
    lifecycleId: 'life-eval-exit',
    state: 'MONITORING',
    selectedSymbol: 'BTG',
    enterClientOrderId: 'enter-1',
    enterBrokerOrderId: 'broker-1',
    exitClientOrderId: null,
    exitBrokerOrderId: null,
    filledQuantity: 2,
    averageFillPrice: 4.5,
    brokerPositionIdentity: 'BTG:2',
    reconciliation: [],
    createdAt: now,
    updatedAt: now,
  }))
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-eval-exit', mode: 'EXIT', symbol: 'BTG', quantity: 2,
  }, {
    runsDir,
    nowMs: 1786128000000,
    authorizationEnv: { PAPER_AUTO_EXIT_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  assert.equal(out.authorizationEvaluation.ok, true)
  assert.equal(out.authorizationEvaluation.lifecycleId, 'life-eval-exit')
  assert.equal(out.authorizationEvaluation.symbol, 'BTG')
  assert.equal(out.authorizationEvaluation.quantity, 2)
  assert.equal(fs.existsSync(out.authorization.latchFile), false)
})


test('repeated ENTER preparation fails closed while customer lifecycle is active', () => {
  const runsDir = tmp()
  const first = bridgePaperPreparationToLifecycle({
    ok: true,
    preparationId: 'prep-first-enter',
    mode: 'ENTER',
    symbol: 'ABC',
    quantity: 1,
  }, {
    runsDir,
    accountId: 'customer-zero',
    nowMs: 1786128600000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  assert.equal(first.lifecycleState, 'CANDIDATE_SELECTED')
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true,
    preparationId: 'prep-second-enter',
    mode: 'ENTER',
    symbol: 'XYZ',
    quantity: 1,
  }, {
    runsDir,
    accountId: 'customer-zero',
    nowMs: 1786128601000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  }), /paper_enter_active_customer_lifecycle_exists/)
  const lifecycleFiles = fs.readdirSync(runsDir).filter((name) => name.startsWith('customer_paper_user_lifecycle_customer-zero') && name.endsWith('.json'))
  assert.equal(lifecycleFiles.length, 1)
})

test('different customer account may create its own pending ENTER lifecycle', () => {
  const runsDir = tmp()
  bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-a', mode: 'ENTER', symbol: 'ABC', quantity: 1,
  }, {
    runsDir, accountId: 'customer-a', nowMs: 1786128600000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  const second = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-b', mode: 'ENTER', symbol: 'XYZ', quantity: 1,
  }, {
    runsDir, accountId: 'customer-b', nowMs: 1786128600000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  assert.equal(second.lifecycleState, 'CANDIDATE_SELECTED')
})
