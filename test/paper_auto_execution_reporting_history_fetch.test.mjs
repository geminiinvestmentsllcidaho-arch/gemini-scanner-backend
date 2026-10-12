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


test('reporting history fetch proves completeness after an exact full page', async () => {
  const calls = []
  const orders = Array.from({ length: 500 }, (_, index) => ({ id: `order-${index}` }))
  const result = await fetchAlpacaPaperHistoricalOrdersReadonly({
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', APCA_API_KEY_ID: 'paper-key', APCA_API_SECRET_KEY: 'paper-secret' },
    fetchImpl: async (url, init) => { calls.push({ url: String(url), init }); return { ok: true, status: 200, json: async () => calls.length === 1 ? orders : [] } },
  })
  assert.equal(calls.length, 2)
  assert.equal(result.historyLimit, 500)
  assert.equal(result.sourceRecordCount, 500)
  assert.equal(result.historyLimitReached, true)
  assert.equal(result.historyComplete, true)
  assert.equal(result.historyPossiblyTruncated, false)
  assert.match(calls[1].url, /before_order_id=order-499/)
})

test('reporting history includes older orders and deduplicates pagination overlap using resolved owner credentials', async () => {
  const pages = [Array.from({ length: 500 }, (_, i) => ({ id: `order-${i}` })), [{ id: 'order-499' }, ...Array.from({ length: 88 }, (_, i) => ({ id: `order-${500 + i}` }))]]
  let calls = 0
  const result = await fetchAlpacaPaperHistoricalOrdersReadonly({
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_KEY: 'wrong-key', ALPACA_SECRET: 'wrong-secret' },
    credentialResolver: async () => ({ readyForReadonlyBrokerRead: true, env: { ALPACA_KEY: 'owner-key', ALPACA_SECRET: 'owner-secret' } }),
    fetchImpl: async (url, init) => {
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'error')
      assert.equal(init.headers['APCA-API-KEY-ID'], 'owner-key')
      assert.equal(init.headers['APCA-API-SECRET-KEY'], 'owner-secret')
      return { ok: true, json: async () => pages[calls++] }
    },
  })
  assert.equal(result.sourceRecordCount, 588)
  assert.equal(result.historyComplete, true)
  assert.equal(result.historicalOrders.at(-1).id, 'order-587')
})

test('reporting rejects unavailable owner credentials rather than falling back to another account', async () => {
  await assert.rejects(fetchAlpacaPaperHistoricalOrdersReadonly({
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_KEY: 'wrong-key', ALPACA_SECRET: 'wrong-secret' },
    credentialResolver: async () => ({ readyForReadonlyBrokerRead: false }),
    fetchImpl: async () => { assert.fail('broker must not be contacted') },
  }), /credentials_required/)
})

test('reporting rejects a stalled pagination cursor instead of claiming complete history', async () => {
  const page = Array.from({ length: 500 }, (_, i) => ({ id: `order-${i}` }))
  await assert.rejects(fetchAlpacaPaperHistoricalOrdersReadonly({
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_KEY: 'key', ALPACA_SECRET: 'secret' },
    fetchImpl: async () => ({ ok: true, json: async () => page }),
  }), /cursor_stalled/)
})
