import test from 'node:test'
import assert from 'node:assert/strict'
import {
  VERSION,
  adaptAlpacaPaperFilledOrderHistory,
} from '../src/scanner/paper_auto_execution_reporting_history.mjs'

test('normalizes broker-confirmed filled PAPER orders into customer-report fill records', () => {
  const result = adaptAlpacaPaperFilledOrderHistory({
    historicalOrders: [
      {
        id: 'sell-1',
        client_order_id: 'gs-pa-exit-life-1',
        symbol: 'aapl',
        side: 'sell',
        status: 'filled',
        filled_qty: '2',
        filled_avg_price: '103.50',
        filled_at: '2026-08-09T15:31:00Z',
      },
      {
        id: 'buy-1',
        client_order_id: 'gs-pa-enter-life-1',
        symbol: 'AAPL',
        side: 'buy',
        status: 'filled',
        filled_qty: '2',
        filled_avg_price: '100.25',
        filled_at: '2026-08-09T14:31:00Z',
      },
    ],
  })

  assert.equal(result.version, VERSION)
  assert.equal(result.sourceRecordCount, 2)
  assert.equal(result.fillRecordCount, 2)
  assert.equal(result.invalidOrUnfilledRecordCount, 0)
  assert.equal(result.duplicateBrokerOrderCount, 0)
  assert.deepEqual(result.fillRecords.map((record) => record.fillId), ['buy-1', 'sell-1'])
  assert.deepEqual(result.fillRecords[0], {
    fillId: 'buy-1',
    brokerOrderId: 'buy-1',
    clientOrderId: 'gs-pa-enter-life-1',
    symbol: 'AAPL',
    side: 'buy',
    qty: 2,
    fillPrice: 100.25,
    filledAt: '2026-08-09T14:31:00.000Z',
    createdAt: '2026-08-09T14:31:00.000Z',
    source: 'alpaca_paper_order_history',
    paperOnly: true,
    brokerConfirmed: true,
  })
  assert.equal(result.legacySourceIntentSemanticsFabricated, false)
})

test('ignores open, canceled, malformed, zero-fill, and timestamp-less records', () => {
  const result = adaptAlpacaPaperFilledOrderHistory({
    historicalOrders: [
      { id: 'open-1', symbol: 'AAPL', side: 'buy', status: 'open', filled_qty: '0', filled_avg_price: null, filled_at: null },
      { id: 'cancel-1', symbol: 'AAPL', side: 'buy', status: 'canceled', filled_qty: '0', filled_avg_price: null, filled_at: null },
      { id: 'bad-price', symbol: 'AAPL', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '0', filled_at: '2026-08-09T14:00:00Z' },
      { id: 'bad-time', symbol: 'AAPL', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '100', filled_at: null },
      { id: '', symbol: 'AAPL', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '100', filled_at: '2026-08-09T14:00:00Z' },
    ],
  })

  assert.equal(result.fillRecordCount, 0)
  assert.equal(result.invalidOrUnfilledRecordCount, 5)
  assert.equal(result.duplicateBrokerOrderCount, 0)
})

test('deduplicates by broker order ID without inventing legacy intent or ticket IDs', () => {
  const order = {
    id: 'filled-1',
    client_order_id: 'gs-pa-enter-life-2',
    symbol: 'BTG',
    side: 'buy',
    status: 'filled',
    filled_qty: '1',
    filled_avg_price: '4.12',
    filled_at: '2026-08-09T14:32:00Z',
  }
  const result = adaptAlpacaPaperFilledOrderHistory({ historicalOrders: [order, { ...order }] })

  assert.equal(result.fillRecordCount, 1)
  assert.equal(result.duplicateBrokerOrderCount, 1)
  assert.equal('sourceIntentId' in result.fillRecords[0], false)
  assert.equal('sourceTicketId' in result.fillRecords[0], false)
  assert.equal(result.fillRecords[0].clientOrderId, 'gs-pa-enter-life-2')
})

test('accepts camelCase order fields while requiring broker-confirmed filled timestamp', () => {
  const result = adaptAlpacaPaperFilledOrderHistory({
    historicalOrders: [{
      id: 'filled-camel',
      clientOrderId: 'gs-pa-exit-life-3',
      symbol: 'SPY',
      side: 'sell',
      status: 'filled',
      filledQty: 1.5,
      filledAvgPrice: 630.25,
      filledAt: '2026-08-09T15:00:00-06:00',
    }],
  })

  assert.equal(result.fillRecordCount, 1)
  assert.equal(result.fillRecords[0].qty, 1.5)
  assert.equal(result.fillRecords[0].fillPrice, 630.25)
  assert.equal(result.fillRecords[0].filledAt, '2026-08-09T21:00:00.000Z')
})
