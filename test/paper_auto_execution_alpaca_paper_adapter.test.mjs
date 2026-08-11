import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPaperAutoExecutionAlpacaPaperAdapter } from '../src/scanner/paper_auto_execution_alpaca_paper_adapter.mjs'

const enabledEnv = Object.freeze({
  PAPER_AUTO_ALPACA_ADAPTER_ENABLED: '1',
  PAPER_AUTO_ALPACA_PAPER_BASE_URL: 'https://paper-api.alpaca.markets',
  PAPER_AUTO_ALPACA_PAPER_KEY: 'paper-key',
  PAPER_AUTO_ALPACA_PAPER_SECRET: 'paper-secret',
})

const enter = Object.freeze({
  symbol: 'AAPL',
  quantity: 1,
  side: 'buy',
  type: 'market',
  timeInForce: 'day',
  clientOrderId: 'gs-pa-enter-life-1',
  paperOnly: true,
})

test('disabled by default performs no request', async () => {
  let calls = 0
  const built = createPaperAutoExecutionAlpacaPaperAdapter({
    env: {},
    fetchImpl: async () => { calls += 1; throw new Error('must not run') },
  })
  const result = await built.submitPaperOrder(enter)
  assert.equal(calls, 0)
  assert.equal(result.status, 'PAPER_AUTO_ADAPTER_BLOCKED')
  assert.ok(result.blockers.includes('paper_auto_alpaca_adapter_disabled'))
  assert.equal(built.diagnostics().safety.liveTradingAllowed, false)
  assert.equal(built.diagnostics().safety.retryAllowed, false)
})

test('rejects live host and missing deterministic identity without request', async () => {
  let calls = 0
  const built = createPaperAutoExecutionAlpacaPaperAdapter({
    env: { ...enabledEnv, PAPER_AUTO_ALPACA_PAPER_BASE_URL: 'https://api.alpaca.markets' },
    fetchImpl: async () => { calls += 1; return new Response('{}', { status: 200 }) },
  })
  const result = await built.submitPaperOrder({ ...enter, clientOrderId: '' })
  assert.equal(calls, 0)
  assert.ok(result.blockers.includes('alpaca_paper_host_required'))
  assert.ok(result.blockers.includes('client_order_id_required'))
})

test('submits one ENTER with preserved deterministic client identity', async () => {
  let calls = 0
  const built = createPaperAutoExecutionAlpacaPaperAdapter({
    env: enabledEnv,
    fetchImpl: async (url, init) => {
      calls += 1
      assert.equal(url, 'https://paper-api.alpaca.markets/v2/orders')
      assert.equal(init.method, 'POST')
      const payload = JSON.parse(init.body)
      assert.deepEqual(payload, {
        symbol: 'AAPL',
        qty: '1',
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
        client_order_id: 'gs-pa-enter-life-1',
      })
      return new Response(JSON.stringify({ id: 'broker-enter-1' }), { status: 200 })
    },
  })
  const result = await built.submitPaperOrder(enter)
  assert.equal(calls, 1)
  assert.equal(result.orderSubmitted, true)
  assert.equal(result.orderId, 'broker-enter-1')
  assert.equal(result.clientOrderId, enter.clientOrderId)
})

test('submits exact-position EXIT quantity and sell side', async () => {
  const built = createPaperAutoExecutionAlpacaPaperAdapter({
    env: enabledEnv,
    fetchImpl: async (_url, init) => {
      const payload = JSON.parse(init.body)
      assert.equal(payload.symbol, 'NVDA')
      assert.equal(payload.qty, '2.5')
      assert.equal(payload.side, 'sell')
      assert.equal(payload.client_order_id, 'gs-pa-exit-life-2')
      return new Response(JSON.stringify({ id: 'broker-exit-1' }), { status: 200 })
    },
  })
  const result = await built.submitPaperOrder({
    symbol: 'NVDA',
    quantity: 2.5,
    side: 'sell',
    type: 'market',
    timeInForce: 'day',
    clientOrderId: 'gs-pa-exit-life-2',
    paperOnly: true,
  })
  assert.equal(result.orderSubmitted, true)
  assert.equal(result.orderId, 'broker-exit-1')
})

test('network exception is ambiguous and not classified as rejection', async () => {
  const built = createPaperAutoExecutionAlpacaPaperAdapter({
    env: enabledEnv,
    fetchImpl: async () => { throw new Error('timeout_after_send') },
  })
  await assert.rejects(built.submitPaperOrder(enter), /paper_auto_alpaca_adapter_ambiguous_failure/)
})

test('success without broker identity remains unconfirmed', async () => {
  const built = createPaperAutoExecutionAlpacaPaperAdapter({
    env: enabledEnv,
    fetchImpl: async () => new Response('{}', { status: 200 }),
  })
  const result = await built.submitPaperOrder(enter)
  assert.equal(result.orderSubmitted, false)
  assert.equal(result.status, 'PAPER_AUTO_ORDER_REJECTED')
  assert.ok(result.blockers.includes('alpaca_paper_order_not_confirmed'))
})

test('source has no runtime, scheduling, PM2, or live endpoint integration', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_alpaca_paper_adapter.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /setInterval|setTimeout|createServer|pm2/)
  assert.equal(source.includes('https://api.alpaca.markets'), false)
  assert.match(source, /paper-api\.alpaca\.markets/)
  assert.match(source, /serverIntegrated: false/)
  assert.match(source, /automaticStartAllowed: false/)
  assert.match(source, /retryAllowed: false/)
})


test('preserves Alpaca broker submitted and filled timestamps', async () => {
  const adapter=createPaperAutoExecutionAlpacaPaperAdapter({
    env:{PAPER_AUTO_ALPACA_ADAPTER_ENABLED:'1',PAPER_AUTO_ALPACA_PAPER_BASE_URL:'https://paper-api.alpaca.markets',PAPER_AUTO_ALPACA_PAPER_KEY:'k',PAPER_AUTO_ALPACA_PAPER_SECRET:'s'},
    fetchImpl:async()=>new Response(JSON.stringify({id:'broker-time-1',submitted_at:'2026-08-11T15:00:00Z',filled_at:'2026-08-11T15:00:00.250Z'}),{status:200}),
  })
  const r=await adapter.submitPaperOrder({symbol:'BTG',quantity:1,side:'sell',type:'market',timeInForce:'day',clientOrderId:'cid-time',paperOnly:true})
  assert.equal(r.submittedAt,'2026-08-11T15:00:00.000Z')
  assert.equal(r.filledAt,'2026-08-11T15:00:00.250Z')
})
