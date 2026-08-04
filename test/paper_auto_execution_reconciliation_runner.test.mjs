import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'
import { runPaperAutoExecutionReconciliation } from '../src/scanner/paper_auto_execution_reconciliation_runner.mjs'

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-runner-'))
  return {
    dir,
    store: new PaperAutoExecutionLifecycleStore({
      filePath: path.join(dir, 'state.json'),
      clock: () => Date.parse('2026-08-04T04:40:00.000Z'),
      idFactory: () => 'lifecycle-1',
    }),
  }
}

function snapshot(overrides = {}) {
  return {
    status: 'connected_readonly',
    mode: 'PAPER_ONLY',
    observedAt: '2026-08-04T04:40:00.000Z',
    runtime: { readOnly: true, allowedMethods: ['GET'] },
    positions: [],
    openOrders: [],
    ...overrides,
  }
}

test('returns no-op when no lifecycle exists', async () => {
  const { store, dir } = makeStore()
  try {
    const result = await runPaperAutoExecutionReconciliation({
      lifecycleStore: store,
      accountSnapshot: snapshot(),
      nowMs: Date.parse('2026-08-04T04:40:30.000Z'),
    })
    assert.equal(result.status, 'NO_ACTIVE_LIFECYCLE')
    assert.equal(result.changed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('blocks without mutating lifecycle when snapshot is stale or unsafe', async () => {
  const { store, dir } = makeStore()
  try {
    store.create({ selectedSymbol: 'AAPL' })
    store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'cid-enter' })
    const before = store.load()
    const result = await runPaperAutoExecutionReconciliation({
      lifecycleStore: store,
      accountSnapshot: snapshot({
        mode: 'LIVE',
        observedAt: '2026-08-04T04:30:00.000Z',
        runtime: { readOnly: false, allowedMethods: ['GET', 'POST'] },
      }),
      nowMs: Date.parse('2026-08-04T04:40:30.000Z'),
    })
    assert.equal(result.status, 'BLOCKED_SNAPSHOT_NOT_READY')
    assert.equal(result.changed, false)
    assert.deepEqual(store.load(), before)
    assert.ok(result.blockers.includes('paper_only_snapshot_required'))
    assert.ok(result.blockers.includes('account_snapshot_stale'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('persists broker-authoritative position confirmation exactly once', async () => {
  const { store, dir } = makeStore()
  try {
    store.create({ selectedSymbol: 'AAPL' })
    store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'cid-enter' })
    const result = await runPaperAutoExecutionReconciliation({
      lifecycleStore: store,
      accountSnapshot: snapshot({
        positions: [{ assetId: 'asset-1', symbol: 'AAPL', qty: 1, averageEntryPrice: 202.5 }],
        openOrders: [{ id: 'order-1', clientOrderId: 'cid-enter', symbol: 'AAPL', side: 'buy', status: 'filled', filledQty: 1, filledAvgPrice: 202.5 }],
      }),
      nowMs: Date.parse('2026-08-04T04:40:30.000Z'),
    })
    assert.equal(result.status, 'RECONCILED_STATE_UPDATED')
    assert.equal(result.changed, true)
    assert.equal(result.lifecycle.state, S.POSITION_CONFIRMED)
    assert.equal(result.lifecycle.filledQuantity, 1)
    assert.equal(result.lifecycle.brokerPositionIdentity, 'asset-1')
    assert.equal(result.lifecycle.reconciliation.length, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('persists unresolved state and never performs broker contact', async () => {
  const { store, dir } = makeStore()
  try {
    store.create({ selectedSymbol: 'AAPL' })
    store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'cid-missing' })
    const result = await runPaperAutoExecutionReconciliation({
      lifecycleStore: store,
      accountSnapshot: snapshot(),
      nowMs: Date.parse('2026-08-04T04:40:30.000Z'),
    })
    assert.equal(result.status, 'UNRESOLVED_NEEDS_RECONCILIATION')
    assert.equal(result.changed, true)
    assert.equal(result.lifecycle.state, S.UNRESOLVED_NEEDS_RECONCILIATION)
    assert.deepEqual(result.blockers, ['enter_identity_not_found'])
    assert.equal(result.safety.brokerContactAllowed, false)
    assert.equal(result.safety.orderPlacementAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
