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
