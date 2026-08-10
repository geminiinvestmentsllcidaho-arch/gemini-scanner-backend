import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAlpacaPaperHistoricalOrdersReadonly } from '../src/scanner/paper_auto_execution_reporting_history_fetch.mjs'

test('reporting history fetch uses PAPER GET orders only', async () => {
  const calls = []
  const result = await fetchAlpacaPaperHistoricalOrdersReadonly({
    env: {
      APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
      APCA_API_KEY_ID: 'paper-key',
      APCA_API_SECRET_KEY: 'paper-secret',
    },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return { ok: true, status: 200, json: async () => [{ id: 'order-1' }] }
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://paper-api.alpaca.markets/v2/orders?status=all&limit=500&direction=desc')
  assert.equal(calls[0].init.method, 'GET')
  assert.deepEqual(result.historicalOrders, [{ id: 'order-1' }])
  assert.equal(result.historyLimit, 500)
  assert.equal(result.sourceRecordCount, 1)
  assert.equal(result.historyLimitReached, false)
  assert.equal(result.historyComplete, true)
  assert.equal(result.historyPossiblyTruncated, false)
  assert.equal(result.readOnly, true)
  assert.equal(result.paperOnly, true)
  assert.equal(result.orderPlacementAllowed, false)
  assert.equal(result.accountMutationAllowed, false)
})

test('reporting history fetch rejects non-PAPER host before fetch', async () => {
  let called = false
  await assert.rejects(
    fetchAlpacaPaperHistoricalOrdersReadonly({
      env: {
        APCA_API_BASE_URL: 'https://api.alpaca.markets',
        APCA_API_KEY_ID: 'key',
        APCA_API_SECRET_KEY: 'secret',
      },
      fetchImpl: async () => { called = true },
    }),
    /paper_reporting_history_paper_host_required/,
  )
  assert.equal(called, false)
})

test('reporting history fetch prefers established ALPACA_KEY credentials over stale APCA aliases', async () => {
  const calls = []
  await fetchAlpacaPaperHistoricalOrdersReadonly({
    env: {
      APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
      ALPACA_KEY: 'current-key',
      ALPACA_SECRET: 'current-secret',
      APCA_API_KEY_ID: 'stale-key',
      APCA_API_SECRET_KEY: 'stale-secret',
    },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return { ok: true, status: 200, json: async () => [] }
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.headers['APCA-API-KEY-ID'], 'current-key')
  assert.equal(calls[0].init.headers['APCA-API-SECRET-KEY'], 'current-secret')
})

test('reporting history fetch retains APCA credential aliases as fallback', async () => {
  const calls = []
  await fetchAlpacaPaperHistoricalOrdersReadonly({
    env: {
      APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
      APCA_API_KEY_ID: 'fallback-key',
      APCA_API_SECRET_KEY: 'fallback-secret',
    },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return { ok: true, status: 200, json: async () => [] }
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.headers['APCA-API-KEY-ID'], 'fallback-key')
  assert.equal(calls[0].init.headers['APCA-API-SECRET-KEY'], 'fallback-secret')
})


test('reporting history fetch marks exact limit hit as possibly truncated without another call', async () => {
  const calls = []
  const orders = Array.from({ length: 500 }, (_, index) => ({ id: `order-${index}` }))
  const result = await fetchAlpacaPaperHistoricalOrdersReadonly({
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', APCA_API_KEY_ID: 'paper-key', APCA_API_SECRET_KEY: 'paper-secret' },
    fetchImpl: async (url, init) => { calls.push({ url: String(url), init }); return { ok: true, status: 200, json: async () => orders } },
  })
  assert.equal(calls.length, 1)
  assert.equal(result.historyLimit, 500)
  assert.equal(result.sourceRecordCount, 500)
  assert.equal(result.historyLimitReached, true)
  assert.equal(result.historyComplete, false)
  assert.equal(result.historyPossiblyTruncated, true)
})
