import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { adaptPaperAutoExecutionSnapshot } from '../src/scanner/paper_auto_execution_snapshot_adapter.mjs'

const observedAt = '2026-08-04T04:30:00.000Z'
const base = {
  status: 'connected_readonly',
  mode: 'PAPER_ONLY',
  observedAt,
  runtime: { readOnly: true, allowedMethods: ['GET'] },
  positions: [{ assetId: 'asset-1', symbol: 'aapl', qty: 1, averageEntryPrice: 202.5 }],
  openOrders: [{ id: 'open-1', clientOrderId: 'cid-enter', symbol: 'aapl', side: 'buy', qty: 1, status: 'accepted' }],
}

test('adapts fresh paper-only GET snapshot for reconciliation', () => {
  const result = adaptPaperAutoExecutionSnapshot({
    accountSnapshot: base,
    nowMs: Date.parse(observedAt) + 30_000,
    historicalOrders: [{ id: 'filled-1', client_order_id: 'cid-exit', symbol: 'AAPL', side: 'sell', status: 'filled', filled_qty: '1', filled_avg_price: '204.1' }],
  })
  assert.equal(result.ready, true)
  assert.deepEqual(result.blockers, [])
  assert.deepEqual(result.positions[0], { assetId: 'asset-1', symbol: 'AAPL', qty: 1, avgEntryPrice: 202.5 })
  assert.equal(result.orders.length, 2)
  assert.equal(result.orders.find((order) => order.clientOrderId === 'cid-exit').filledQty, 1)
})

test('fails closed for stale, disconnected, non-paper, or non-GET snapshots', () => {
  const result = adaptPaperAutoExecutionSnapshot({
    accountSnapshot: {
      ...base,
      status: 'readonly_fetch_failed',
      mode: 'LIVE',
      runtime: { readOnly: false, allowedMethods: ['GET', 'POST'] },
    },
    nowMs: Date.parse(observedAt) + 300_000,
  })
  assert.equal(result.ready, false)
  assert.deepEqual(result.blockers, [
    'connected_readonly_snapshot_required',
    'paper_only_snapshot_required',
    'readonly_runtime_required',
    'get_only_runtime_required',
    'account_snapshot_stale',
  ])
})

test('deduplicates historical and open orders by exact client identity', () => {
  const result = adaptPaperAutoExecutionSnapshot({
    accountSnapshot: base,
    nowMs: Date.parse(observedAt),
    historicalOrders: [{ id: 'old', clientOrderId: 'cid-enter', symbol: 'AAPL', side: 'buy', status: 'new' }],
  })
  assert.equal(result.orders.length, 1)
  assert.equal(result.orders[0].id, 'open-1')
})

test('snapshot adapter performs no network or broker mutation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_snapshot_adapter.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /\bPOST\b|\bDELETE\b|\bPATCH\b/)
  const result = adaptPaperAutoExecutionSnapshot({ accountSnapshot: base, nowMs: Date.parse(observedAt) })
  assert.equal(result.safety.orderPlacementAllowed, false)
  assert.equal(result.safety.brokerMutationAllowed, false)
  assert.deepEqual(result.safety.allowedMethods, ['GET'])
})


test('retains historical order broker timestamps', () => {
  const r=adaptPaperAutoExecutionSnapshot({
    accountSnapshot:{status:'connected_readonly',mode:'PAPER_ONLY',observedAt:'2026-08-11T15:00:01Z',runtime:{readOnly:true,allowedMethods:['GET']},positions:[],openOrders:[]},
    historicalOrders:[{id:'x',client_order_id:'cid-x',symbol:'BTG',side:'sell',status:'filled',filled_qty:'1',submitted_at:'2026-08-11T15:00:00Z',filled_at:'2026-08-11T15:00:00.250Z'}],
    nowMs:Date.parse('2026-08-11T15:00:01Z'),
  })
  assert.equal(r.orders[0].submittedAt,'2026-08-11T15:00:00.000Z')
  assert.equal(r.orders[0].filledAt,'2026-08-11T15:00:00.250Z')
})
