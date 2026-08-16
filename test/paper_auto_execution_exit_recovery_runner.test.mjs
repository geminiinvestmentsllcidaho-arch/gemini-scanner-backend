import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'
import { createPaperAutoExecutionExitRecoveryRunner } from '../src/scanner/paper_auto_execution_exit_recovery_runner.mjs'

test('EXIT recovery is a no-op before an EXIT recovery state and performs no broker read', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exit-recovery-'))
  try {
    const filePath = path.join(dir, 'state.json')
    const store = new PaperAutoExecutionLifecycleStore({ filePath, idFactory: () => 'lifecycle-1' })
    store.create({ selectedSymbol: 'AAPL', scannerEvidence: { paperOnly: true } })
    let accountCalls = 0
    let historyCalls = 0
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      fetchAccount: async () => { accountCalls += 1; throw Error('unexpected_account_read') },
      fetchHistoricalOrders: async () => { historyCalls += 1; throw Error('unexpected_history_read') },
    })
    const result = await runner.runOnce()
    assert.equal(result.lastStatus, 'EXIT_RECOVERY_NOT_REQUIRED')
    assert.equal(accountCalls, 0)
    assert.equal(historyCalls, 0)
    assert.equal(result.safety.orderPlacementAllowed, false)
    assert.equal(result.safety.cancellationAllowed, false)
    assert.equal(result.safety.replacementAllowed, false)
    assert.deepEqual(result.safety.allowedBrokerMethods, ['GET'])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exit-recovery-'))
  const filePath = path.join(dir, 'state.json')
  const store = new PaperAutoExecutionLifecycleStore({
    filePath,
    clock: () => Date.parse('2026-08-04T04:40:00.000Z'),
    idFactory: () => 'lifecycle-1',
  })
  return { dir, filePath, store }
}

function armExitSubmitting(store) {
  store.create({ selectedSymbol: 'AAPL', scannerEvidence: { paperOnly: true } })
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-1' })
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 1, averageFillPrice: 202.5, brokerPositionIdentity: 'asset-1' })
  store.transition(S.EXIT_TRIGGERED, { exitClientOrderId: 'exit-1' })
  store.transition(S.EXIT_SUBMITTING)
}

const credentials = async () => ({
  readyForReadonlyBrokerRead: true,
  env: { ALPACA_KEY: 'paper-key', ALPACA_SECRET: 'paper-secret', APCA_API_BASE_URL: 'https://paper-api.alpaca.markets' },
})

function account(positions = []) {
  return {
    ok: true,
    status: 'connected_readonly',
    mode: 'PAPER_ONLY',
    observedAt: '2026-08-04T04:40:00.000Z',
    runtime: { readOnly: true, allowedMethods: ['GET'] },
    positions,
    openOrders: [],
  }
}

function history(historicalOrders = []) {
  return {
    historicalOrders,
    historyLimitReached: false,
    readOnly: true,
    paperOnly: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    brokerContactType: 'readonly_get',
  }
}

test('EXIT recovery completes exact filled sell only when broker position is absent', async () => {
  const { dir, filePath, store } = makeStore()
  try {
    armExitSubmitting(store)
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      accountCredentialResolver: credentials,
      fetchAccount: async () => account([]),
      fetchHistoricalOrders: async () => history([{
        id: 'broker-exit-1',
        client_order_id: 'exit-1',
        symbol: 'AAPL',
        side: 'sell',
        status: 'filled',
        qty: '1',
        filled_qty: '1',
        filled_avg_price: '205.00',
        filled_at: '2026-08-04T04:39:59.000Z',
      }]),
      now: () => Date.parse('2026-08-04T04:40:30.000Z'),
    })
    const result = await runner.runOnce()
    assert.equal(result.lastStatus, 'RECONCILED_STATE_UPDATED')
    assert.equal(result.lastLifecycle.state, S.ROUND_TRIP_COMPLETED)
    assert.equal(result.lastLifecycle.exitBrokerOrderId, 'broker-exit-1')
    assert.equal(result.reconciliations, 1)
    assert.equal(result.safety.orderPlacementAllowed, false)
    assert.equal(result.safety.cancellationAllowed, false)
    assert.equal(result.safety.replacementAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('EXIT recovery leaves terminal canceled exit with residual position unresolved and never replaces it', async () => {
  const { dir, filePath, store } = makeStore()
  try {
    armExitSubmitting(store)
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      accountCredentialResolver: credentials,
      fetchAccount: async () => account([{ assetId: 'asset-1', symbol: 'AAPL', qty: 1, averageEntryPrice: 202.5 }]),
      fetchHistoricalOrders: async () => history([{
        id: 'broker-exit-1',
        client_order_id: 'exit-1',
        symbol: 'AAPL',
        side: 'sell',
        status: 'canceled',
        qty: '1',
        filled_qty: '0',
      }]),
      now: () => Date.parse('2026-08-04T04:40:30.000Z'),
    })
    const result = await runner.runOnce()
    assert.equal(result.lastStatus, 'UNRESOLVED_NEEDS_RECONCILIATION')
    assert.equal(result.lastLifecycle.state, S.UNRESOLVED_NEEDS_RECONCILIATION)
    assert.ok(result.lastReconciliation.blockers.includes('exit_order_terminal_with_residual_position'))
    assert.equal(result.safety.orderPlacementAllowed, false)
    assert.equal(result.safety.cancellationAllowed, false)
    assert.equal(result.safety.replacementAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})


test('history truncation fails closed when exact EXIT identity is absent', async () => {
  const { dir, filePath, store } = makeStore()
  try {
    armExitSubmitting(store)
    let reconciled = 0
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      accountCredentialResolver: credentials,
      fetchAccount: async () => account([{ assetId: 'asset-1', symbol: 'AAPL', qty: 1, averageEntryPrice: 202.5 }]),
      fetchHistoricalOrders: async () => ({
        ...history([{ id: 'other-broker', client_order_id: 'other-client', symbol: 'AAPL', side: 'sell', status: 'filled', qty: '1', filled_qty: '1' }]),
        historyLimitReached: true,
      }),
      reconcile: async () => { reconciled += 1; throw new Error('unexpected_reconcile') },
    })
    const result = await runner.runOnce()
    assert.equal(result.lastStatus, 'EXIT_HISTORY_TRUNCATED_IDENTITY_NOT_FOUND')
    assert.equal(reconciled, 0)
    assert.equal(store.load().state, S.EXIT_SUBMITTING)
    assert.equal(result.safety.orderPlacementAllowed, false)
    assert.equal(result.safety.cancellationAllowed, false)
    assert.equal(result.safety.replacementAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})


test('history truncation allows exact client identity when broker identity is not yet known', async () => {
  const { dir, filePath, store } = makeStore()
  try {
    armExitSubmitting(store)
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      accountCredentialResolver: credentials,
      fetchAccount: async () => account([{ assetId: 'asset-1', symbol: 'AAPL', qty: 1, averageEntryPrice: 202.5 }]),
      fetchHistoricalOrders: async () => ({
        ...history([{ id: 'broker-exit-1', client_order_id: 'exit-1', symbol: 'AAPL', side: 'sell', status: 'open', qty: '1', filled_qty: '0' }]),
        historyLimitReached: true,
      }),
      now: () => Date.parse('2026-08-04T04:40:30.000Z'),
    })
    const result = await runner.runOnce()
    assert.equal(result.lastLifecycle.state, S.EXIT_SUBMITTING)
    assert.equal(result.lastLifecycle.exitBrokerOrderId, 'broker-exit-1')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('history truncation fails closed when client and broker identities are split across records', async () => {
  const { dir, filePath, store } = makeStore()
  try {
    armExitSubmitting(store)
    store.patchExitRecovery({ expectedLifecycleId:'lifecycle-1', expectedSymbol:'AAPL', expectedState:S.EXIT_SUBMITTING, exitBrokerOrderId:'broker-exit-1', reconciliation:[] })
    let reconciled = 0
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      accountCredentialResolver: credentials,
      fetchAccount: async () => account([{ assetId:'asset-1', symbol:'AAPL', qty:1, averageEntryPrice:202.5 }]),
      fetchHistoricalOrders: async () => ({
        ...history([
          { id:'broker-other', client_order_id:'exit-1', symbol:'AAPL', side:'sell', status:'open', qty:'1', filled_qty:'0' },
          { id:'broker-exit-1', client_order_id:'other-client', symbol:'AAPL', side:'sell', status:'open', qty:'1', filled_qty:'0' },
        ]),
        historyLimitReached:true,
      }),
      reconcile: async () => { reconciled += 1; throw new Error('unexpected_reconcile') },
    })
    const result = await runner.runOnce()
    assert.equal(result.lastStatus, 'EXIT_HISTORY_TRUNCATED_IDENTITY_NOT_FOUND')
    assert.equal(reconciled, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('history truncation allows same record matching client and broker identities', async () => {
  const { dir, filePath, store } = makeStore()
  try {
    armExitSubmitting(store)
    store.patchExitRecovery({ expectedLifecycleId:'lifecycle-1', expectedSymbol:'AAPL', expectedState:S.EXIT_SUBMITTING, exitBrokerOrderId:'broker-exit-1', reconciliation:[] })
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      accountCredentialResolver: credentials,
      fetchAccount: async () => account([{ assetId:'asset-1', symbol:'AAPL', qty:1, averageEntryPrice:202.5 }]),
      fetchHistoricalOrders: async () => ({
        ...history([{ id:'broker-exit-1', client_order_id:'exit-1', symbol:'AAPL', side:'sell', status:'open', qty:'1', filled_qty:'0' }]),
        historyLimitReached:true,
      }),
    })
    const result = await runner.runOnce()
    assert.equal(result.lastLifecycle.state, S.EXIT_SUBMITTING)
    assert.equal(result.lastLifecycle.exitBrokerOrderId, 'broker-exit-1')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('history brokerContactType must be readonly_get', async () => {
  const { dir, filePath, store } = makeStore()
  try {
    armExitSubmitting(store)
    let reconciled = 0
    const runner = createPaperAutoExecutionExitRecoveryRunner({
      getLifecycleFile: () => filePath,
      accountCredentialResolver: credentials,
      fetchAccount: async () => account([{ assetId:'asset-1', symbol:'AAPL', qty:1, averageEntryPrice:202.5 }]),
      fetchHistoricalOrders: async () => ({ ...history([]), brokerContactType:'none' }),
      reconcile: async () => { reconciled += 1 },
    })
    const result = await runner.runOnce()
    assert.equal(result.lastStatus, 'READONLY_HISTORY_REQUIRED')
    assert.equal(reconciled, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
