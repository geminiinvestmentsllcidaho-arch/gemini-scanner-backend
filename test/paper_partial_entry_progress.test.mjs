import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { runPaperAutoExecutionReconciliation as run } from '../src/scanner/paper_auto_execution_reconciliation_runner.mjs'

const nowMs = Date.parse('2026-09-15T16:45:30Z')
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-progress-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const store = new PaperAutoExecutionLifecycleStore({ filePath: path.join(dir, 'state.json'), clock: () => nowMs, idFactory: () => 'fixture' })
  store.create({ selectedSymbol: 'MSTZ' })
  store.transition('ENTER_SUBMITTING', { enterClientOrderId: 'entry' })
  store.transition('ENTER_PARTIALLY_FILLED', { enterBrokerOrderId: 'broker-entry', filledQuantity: 6, averageFillPrice: 4.26 })
  return store
}
const order = (qty) => ({ id: 'broker-entry', clientOrderId: 'entry', symbol: 'MSTZ', side: 'buy', qty: 22, status: qty === 22 ? 'filled' : 'partially_filled', filledQty: qty, filledAvgPrice: 4.3 })
const snapshot = (qty) => ({ status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(nowMs).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] }, positions: [{ symbol: 'MSTZ', qty, averageEntryPrice: 4.3 }], openOrders: [order(qty)] })
const reconcile = (store, qty, extras = {}) => run({ lifecycleStore: store, accountSnapshot: snapshot(qty), nowMs, incidentEmitter: async () => {}, ...extras })

test('persists 6 to 12 partial progress, retries without a write, then confirms 22', async (t) => {
  const store = fixture(t)
  const progress = await reconcile(store, 12)
  assert.equal(progress.changed, true)
  assert.equal(progress.lifecycle.state, 'ENTER_PARTIALLY_FILLED')
  assert.equal(store.load().filledQuantity, 12)
  assert.equal(store.load().averageFillPrice, 4.3)
  assert.equal(store.load().reconciliation.length, 1)
  const before = fs.readFileSync(store.filePath, 'utf8')
  assert.equal((await reconcile(store, 12)).changed, false)
  assert.equal(fs.readFileSync(store.filePath, 'utf8'), before)
  const filled = await reconcile(store, 22)
  assert.equal(filled.lifecycle.state, 'POSITION_CONFIRMED')
  assert.equal(store.load().filledQuantity, 22)
  assert.equal(filled.safety.orderPlacementAllowed, false)
})

test('conflicting snapshots leave partial record byte-for-byte unchanged', async (t) => {
  const store = fixture(t)
  const before = fs.readFileSync(store.filePath, 'utf8')
  const result = await reconcile(store, 12, { historicalOrders: [order(6)] })
  assert.equal(result.status, 'BLOCKED_SNAPSHOT_NOT_READY')
  assert.equal(fs.readFileSync(store.filePath, 'utf8'), before)
})

test('MONITORING remains untouched by entry evidence', async (t) => {
  const store = fixture(t)
  store.transition('POSITION_CONFIRMED')
  store.transition('MONITORING')
  const before = fs.readFileSync(store.filePath, 'utf8')
  assert.equal((await reconcile(store, 22)).changed, false)
  assert.equal(fs.readFileSync(store.filePath, 'utf8'), before)
  assert.throws(() => store.patchPartialEntryProgress({}), /invalid_state/)
})

test('identity, quantity and forbidden-field guards reject stale updates without writes', (t) => {
  const store = fixture(t)
  const patch = { expectedLifecycleId: 'fixture', expectedSymbol: 'MSTZ', expectedQuantity: 6, expectedClientOrderId: 'entry', expectedBrokerOrderId: 'broker-entry', filledQuantity: 12, reconciliation: [] }
  const before = fs.readFileSync(store.filePath, 'utf8')
  for (const change of [{ expectedLifecycleId: 'other' }, { expectedSymbol: 'CTMX' }, { expectedQuantity: 7 }, { expectedClientOrderId: 'other' }, { expectedBrokerOrderId: 'other' }, { filledQuantity: 6 }, { filledQuantity: 5 }, { state: 'MONITORING' }, { averageFillPrice: 0 }, { reconciliation: null }]) {
    assert.throws(() => store.patchPartialEntryProgress({ ...patch, ...change }))
    assert.equal(fs.readFileSync(store.filePath, 'utf8'), before)
  }
})
