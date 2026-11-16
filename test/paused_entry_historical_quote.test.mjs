import test from 'node:test'
import assert from 'node:assert/strict'
import { historicalEntryQuote } from '../scripts/paused_entry_historical_quote.mjs'

const decisionAt = '2026-11-16T15:00:30.001Z'
const request = { symbol: 'ABC', feed: 'iex', decisionAt }
const raw = { bp: 10, ap: 10.1, bs: 1, as: 2, t: '2026-11-16T15:00:30.000987654Z' }
const resolveCredentials = async () => ({ readyForReadonlyBrokerRead: true, env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets' } })
const response = quotes => ({ ok: true, json: async () => ({ quotes }) })
const get = data => historicalEntryQuote(request, { resolveCredentials, fetchImpl: async () => response(data) })

test('retrieves the last same-symbol same-feed quote ending at the millisecond of decision', async () => {
  const q = await historicalEntryQuote(request, { resolveCredentials, fetchImpl: async (url, opts) => {
    assert.equal(opts.method, 'GET'); assert.equal(opts.redirect, 'error')
    assert.equal(url.origin + url.pathname, 'https://data.alpaca.markets/v2/stocks/quotes')
    assert.deepEqual(Object.fromEntries(url.searchParams), {symbols:'ABC', feed:'iex', asof:'-', start:'2026-11-16T15:00:15.001Z', end:decisionAt, sort:'desc', limit:'1'})
    return response({ ABC: [raw] })
  } })
  assert.deepEqual(q, { bid:10, ask:10.1, at:raw.t, feed:'iex', ageMs:1 })
  assert.ok(await get({ ABC:[{ ...raw, t:'2026-11-16T15:00:30.001000000Z' }] }))
  assert.ok(await get({ ABC:[{ ...raw, t:'2026-11-16T15:00:15.001000000Z' }] }))
})

test('rejects future nanoseconds, stale, crossed, unsized and missing quotes', async () => {
  for (const patch of [{ t:'2026-11-16T15:00:30.001000001Z' }, { t:'2026-11-16T15:00:15.000999999Z' }, { bp:11 }, { bs:0 }, { as:0 }, { ap:null }]) {
    assert.equal(await get({ ABC:[{...raw, ...patch}] }), null)
  }
  assert.equal(await get({ OTHER:[raw] }), null)
})

test('missing feed makes no request and operational failures surface', async () => {
  assert.equal(await historicalEntryQuote({...request, feed:null}, {resolveCredentials:assert.fail, fetchImpl:assert.fail}), null)
  await assert.rejects(historicalEntryQuote(request, {resolveCredentials:async()=>({readyForReadonlyBrokerRead:false}), fetchImpl:assert.fail}), /PAPER credentials/)
  await assert.rejects(historicalEntryQuote(request, {resolveCredentials, fetchImpl:async()=>({ok:false,status:429})}), /HTTP 429/)
  await assert.rejects(get(null), /invalid historical quote response/)
})
