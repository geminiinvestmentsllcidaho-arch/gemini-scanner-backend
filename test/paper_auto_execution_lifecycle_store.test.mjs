import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-'))
  const filePath = path.join(dir, 'state.json')
  let tick = Date.parse('2026-08-04T03:57:00.000Z')
  return {
    filePath,
    store: new PaperAutoExecutionLifecycleStore({
      filePath,
      clock: () => tick++,
      idFactory: () => 'lifecycle-1',
    }),
  }
}

test('enforces one active lifecycle and immutable symbol', () => {
  const { store } = fixture()
  store.create({ selectedSymbol: 'spy' })
  assert.throws(() => store.create({ selectedSymbol: 'AAPL' }), /active_lifecycle_exists/)
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-1' })
  assert.throws(() => store.transition(S.ENTER_UNKNOWN, { selectedSymbol: 'AAPL' }), /selected_symbol_immutable/)
})

test('unresolved enter blocks new lifecycle and restart reloads exact state', () => {
  const { filePath, store } = fixture()
  store.create({ selectedSymbol: 'SPY', scannerEvidence: { rank: 1 } })
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-1' })
  store.transition(S.ENTER_UNKNOWN)
  assert.throws(() => store.create({ selectedSymbol: 'AAPL' }), /active_lifecycle_exists/)
  const restarted = new PaperAutoExecutionLifecycleStore({ filePath })
  assert.deepEqual(restarted.load(), store.load())
})

test('confirmed position moves to monitoring and exit target must match exact position', () => {
  const { store } = fixture()
  store.create({ selectedSymbol: 'SPY' })
  store.transition(S.ENTER_SUBMITTING)
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 1, averageFillPrice: 630 })
  store.transition(S.MONITORING)
  assert.equal(store.assertExitTarget({ symbol: 'SPY', quantity: 1 }), true)
  assert.throws(() => store.assertExitTarget({ symbol: 'AAPL', quantity: 1 }), /exit_symbol_mismatch/)
  assert.throws(() => store.assertExitTarget({ symbol: 'SPY', quantity: 2 }), /exit_quantity_mismatch/)
})

test('completed lifecycle permits a later lifecycle', () => {
  const { store } = fixture()
  store.create({ selectedSymbol: 'SPY' })
  store.transition(S.ENTER_SUBMITTING)
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 1 })
  store.transition(S.EXIT_TRIGGERED)
  store.transition(S.EXIT_SUBMITTING)
  store.transition(S.ROUND_TRIP_COMPLETED)
  store.resetToIdle()
  assert.equal(store.create({ selectedSymbol: 'AAPL' }).selectedSymbol, 'AAPL')
})

test('corrupt or incomplete state fails closed', () => {
  const { filePath, store } = fixture()
  fs.writeFileSync(filePath, '{bad-json')
  assert.throws(() => store.load(), /state_corrupt/)
  fs.writeFileSync(filePath, JSON.stringify({ version: 'paper_auto_execution_lifecycle_v1' }))
  assert.throws(() => store.load(), /state_missing/)
})

test('focused store tests perform no network or broker contact', () => {
  const { store } = fixture()
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    throw new Error('network forbidden')
  }
  try {
    store.create({ selectedSymbol: 'SPY' })
    store.transition(S.ENTER_SUBMITTING)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('patchMonitoring atomically updates scale reconciliation fields while preserving canonical identities and MONITORING state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-monitor-patch-'))
  const file = path.join(dir, 'life.json')
  let now = Date.parse('2026-08-14T15:00:00Z')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: file, clock: () => now, idFactory: () => 'life-scale-patch' })
  store.create({ selectedSymbol: 'ABC' })
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-original' })
  store.transition(S.ENTER_OPEN, { enterBrokerOrderId: 'enter-broker-original' })
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 8, averageFillPrice: 10, brokerPositionIdentity: 'ABC:8' })
  store.transition(S.MONITORING)

  now += 1000
  const patched = store.patchMonitoring({
    expectedLifecycleId: 'life-scale-patch',
    expectedSymbol: 'ABC',
    expectedFromQuantity: 8,
    filledQuantity: 6,
    averageFillPrice: 9.75,
    brokerPositionIdentity: 'ABC:6',
    reconciliationEntry: { kind: 'paper_scale_action_filled', action: 'scale_out', orderQuantity: 2 },
  })

  assert.equal(patched.state, S.MONITORING)
  assert.equal(patched.lifecycleId, 'life-scale-patch')
  assert.equal(patched.selectedSymbol, 'ABC')
  assert.equal(patched.filledQuantity, 6)
  assert.equal(patched.averageFillPrice, 9.75)
  assert.equal(patched.brokerPositionIdentity, 'ABC:6')
  assert.equal(patched.enterClientOrderId, 'enter-original')
  assert.equal(patched.enterBrokerOrderId, 'enter-broker-original')
  assert.equal(patched.exitClientOrderId, null)
  assert.equal(patched.exitBrokerOrderId, null)
  assert.equal(patched.reconciliation.at(-1).kind, 'paper_scale_action_filled')
  assert.equal(store.load().filledQuantity, 6)
})

test('patchMonitoring fails closed outside MONITORING and rejects forbidden or non-whole quantity changes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-monitor-patch-blocked-'))
  const file = path.join(dir, 'life.json')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => 'life-scale-blocked' })
  store.create({ selectedSymbol: 'ABC' })
  assert.throws(() => store.patchMonitoring({ filledQuantity: 2 }), /monitoring_patch_invalid_state/)

  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-original' })
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 8, brokerPositionIdentity: 'ABC:8' })
  store.transition(S.MONITORING)

  const expected = { expectedLifecycleId: 'life-scale-blocked', expectedSymbol: 'ABC', expectedFromQuantity: 8 }
  assert.throws(() => store.patchMonitoring({ ...expected, selectedSymbol: 'XYZ' }), /monitoring_patch_forbidden:selectedSymbol/)
  assert.throws(() => store.patchMonitoring({ ...expected, state: S.EXIT_TRIGGERED }), /monitoring_patch_forbidden:state/)
  assert.throws(() => store.patchMonitoring({ ...expected, enterClientOrderId: 'changed' }), /monitoring_patch_forbidden:enterClientOrderId/)
  assert.throws(() => store.patchMonitoring({ ...expected, reconciliation: [] }), /monitoring_patch_forbidden:reconciliation/)
  assert.throws(() => store.patchMonitoring({ ...expected, filledQuantity: 6.5 }), /monitoring_patch_whole_quantity_required/)
  assert.throws(() => store.patchMonitoring({ ...expected, expectedLifecycleId: 'other' }), /monitoring_patch_lifecycle_changed/)
  assert.throws(() => store.patchMonitoring({ ...expected, expectedSymbol: 'XYZ' }), /monitoring_patch_symbol_changed/)
  assert.throws(() => store.patchMonitoring({ ...expected, expectedFromQuantity: 7 }), /monitoring_patch_quantity_changed/)
  assert.equal(store.load().filledQuantity, 8)
  assert.equal(store.load().state, S.MONITORING)
})
