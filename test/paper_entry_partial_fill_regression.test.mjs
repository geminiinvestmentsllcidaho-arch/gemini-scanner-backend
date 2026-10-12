import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAlpacaPaperAccountReadonly } from '../src/scanner/alpaca_paper_account_readonly_fetch.mjs'
import { adaptPaperAutoExecutionSnapshot } from '../src/scanner/paper_auto_execution_snapshot_adapter.mjs'
import { reconcilePaperAutoExecution } from '../src/scanner/paper_auto_execution_reconciliation.mjs'

const lifecycle = { state: 'ENTER_UNKNOWN', selectedSymbol: 'MSTZ', enterClientOrderId: 'entry' }
const order = { id: 'broker-entry', client_order_id: 'entry', symbol: 'MSTZ', side: 'buy', qty: '22', status: 'partially_filled', filled_qty: '6', filled_avg_price: '4.26', submitted_at: '2026-09-15T16:45:27Z' }
const position = { symbol: 'MSTZ', qty: '6', avg_entry_price: '4.26' }
const snapshot = (openOrders) => ({ status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: '2026-09-15T16:45:30Z', runtime: { readOnly: true, allowedMethods: ['GET'] }, positions: [position], openOrders })
const adapt = (openOrders, historicalOrders = []) => adaptPaperAutoExecutionSnapshot({ accountSnapshot: snapshot(openOrders), historicalOrders, nowMs: Date.parse('2026-09-15T16:45:30Z') })

test('PAPER read → snapshot → reconciliation preserves a 6-of-22 partial entry', async () => {
  const result = await fetchAlpacaPaperAccountReadonly({
    env: {},
    credentialResolver: () => ({ readyForReadonlyBrokerRead: true, env: { ALPACA_KEY: 'fixture', ALPACA_SECRET: 'fixture', APCA_API_BASE_URL: 'https://paper-api.alpaca.markets' } }),
    fetchImpl: async (url, options) => {
      assert.equal(options.method, 'GET')
      const body = url.includes('/orders') ? [order] : url.endsWith('/positions') ? [position] : { status: 'ACTIVE' }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    },
  })
  assert.equal(result.status, 'connected_readonly')
  assert.equal(result.openOrders[0].filledQty, 6)
  assert.equal(result.openOrders[0].filledAvgPrice, 4.26)
  assert.equal(result.openOrders[0].submittedAt, order.submitted_at)
  const adapted = adapt(result.openOrders, [order])
  assert.equal(adapted.ready, true)
  const partial = reconcilePaperAutoExecution({ lifecycle, ...adapted })
  assert.equal(partial.nextState, 'ENTER_PARTIALLY_FILLED')
  assert.equal(partial.patch.filledQuantity, 6)
  const completed = reconcilePaperAutoExecution({ lifecycle: { ...lifecycle, ...partial.patch, state: partial.nextState }, orders: [{ ...order, status: 'filled', filled_qty: '22' }], positions: [{ ...position, qty: '22' }] })
  assert.equal(completed.nextState, 'POSITION_CONFIRMED')
  assert.equal(completed.patch.filledQuantity, 22)
  assert.deepEqual(completed.blockers, [])
})

test('incomplete duplicate cannot erase historical partial-fill evidence', () => {
  const result = adapt([{ ...order, filled_qty: null, filled_avg_price: null }], [order])
  assert.equal(result.ready, true)
  assert.equal(result.orders[0].filledQty, 6)
  assert.equal(result.orders[0].filledAvgPrice, 4.26)
})

test('concurrent contradictory fill snapshots fail closed for a fresh retry', () => {
  for (const change of [{ filled_qty: '7' }, { status: 'filled', filled_qty: '22' }, { id: 'other' }, { filled_avg_price: '5' }, { symbol: 'CTMX' }]) {
    assert.equal(adapt([{ ...order, ...change }], [order]).ready, false)
  }
})

test('missing fill evidence, identity conflicts, and duplicate positions cannot confirm entry', () => {
  for (const orders of [[], [{ ...order, filled_qty: null }], [{ ...order, symbol: 'CTMX' }], [{ ...order, side: 'sell' }], [order, order], [{ ...order, status: 'filled', filled_qty: '6' }], [{ ...order, status: 'canceled' }]]) {
    const result = reconcilePaperAutoExecution({ lifecycle, orders, positions: [position] })
    assert.equal(result.nextState, 'UNRESOLVED_NEEDS_RECONCILIATION')
    assert.equal(result.patch.filledQuantity, undefined)
  }
  assert.equal(reconcilePaperAutoExecution({ lifecycle: { ...lifecycle, enterBrokerOrderId: 'different' }, orders: [order], positions: [position] }).resolved, false)
  assert.equal(reconcilePaperAutoExecution({ lifecycle, orders: [order], positions: [position, position] }).resolved, false)
})

test('MONITORING records are never silently repaired by entry reconciliation', () => {
  const result = reconcilePaperAutoExecution({ lifecycle: { ...lifecycle, state: 'MONITORING', filledQuantity: 6 }, orders: [{ ...order, status: 'filled', filled_qty: '22' }], positions: [{ ...position, qty: '22' }] })
  assert.equal(result.nextState, 'MONITORING')
  assert.equal(result.patch.filledQuantity, undefined)
  const correct = reconcilePaperAutoExecution({ lifecycle: { ...lifecycle, state: 'MONITORING', filledQuantity: 22 }, orders: [{ ...order, status: 'filled', filled_qty: '22' }], positions: [{ ...position, qty: '22' }] })
  assert.equal(correct.nextState, 'MONITORING')
  assert.equal(correct.patch.filledQuantity, undefined)
})
