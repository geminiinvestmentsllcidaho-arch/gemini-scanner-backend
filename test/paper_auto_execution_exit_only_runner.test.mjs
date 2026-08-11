import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'
import { runPaperAutoExecutionExitOnly } from '../src/scanner/paper_auto_execution_exit_only_runner.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-exit-only-'))
  const lifecycleFile = path.join(dir, 'lifecycle.json')
  const reportFile = path.join(dir, 'report.json')
  const store = new PaperAutoExecutionLifecycleStore({
    filePath: lifecycleFile,
    idFactory: () => 'life-exit-only-1',
  })
  store.create({ selectedSymbol: 'BTG' })
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-cid' })
  store.transition(S.POSITION_CONFIRMED, {
    enterBrokerOrderId: 'enter-broker',
    filledQuantity: 1,
    averageFillPrice: 4.12,
    brokerPositionIdentity: 'BTG:1',
  })
  store.transition(S.MONITORING)
  const nowMs = Date.now()
  const args = {
    execute: 'true',
    lifecycleId: 'life-exit-only-1',
    symbol: 'BTG',
    quantity: '1',
    lifecycleFile,
  }
  const env = {
    APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
    APCA_API_KEY_ID: 'paper-key',
    APCA_API_SECRET_KEY: 'paper-secret',
    ALPACA_PAPER_TRADING: 'true',
  }
  const accountCredentialResolver = async () => ({
    readyForReadonlyBrokerRead: false,
    accessSwitchEnabled: true,
    env: {},
  })
  return { dir, lifecycleFile, reportFile, nowMs, args, env, accountCredentialResolver }
}

test('fails closed before network when explicit execution is absent', async () => {
  const f = fixture()
  let calls = 0
  try {
    const result = await runPaperAutoExecutionExitOnly({
      args: { ...f.args, execute: 'false' },
      env: f.env,
      nowMs: f.nowMs,
      fetchImpl: async () => { calls += 1; throw new Error('network forbidden') },
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 'EXIT_ONLY_BLOCKED')
    assert.ok(result.blockers.includes('explicit_execute_true_required'))
    assert.equal(calls, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: f.lifecycleFile }).load().state, S.MONITORING)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})

test('fails closed before network when exact EXIT identity is missing', async () => {
  const f = fixture()
  let calls = 0
  try {
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: { ...f.args, lifecycleId: '', symbol: '', quantity: '0' },
        env: f.env,
        nowMs: f.nowMs,
        fetchImpl: async () => { calls += 1; throw new Error('network forbidden') },
      }),
      /paper_exit_only_exact_lifecycle_id_required/,
    )
    assert.equal(calls, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: f.lifecycleFile }).load().state, S.MONITORING)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})

test('fails closed before submission when exact broker position is absent', async () => {
  const f = fixture()
  let postCalls = 0
  try {
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: f.args,
        env: f.env,
        nowMs: f.nowMs,
        accountCredentialResolver: f.accountCredentialResolver,
        fetchImpl: async (url, init = {}) => {
          if (init.method === 'POST') postCalls += 1
          if (String(url).includes('/v2/clock')) {
            return new Response(JSON.stringify({ is_open: true }), { status: 200, headers: { 'content-type': 'application/json' } })
          }
          if (String(url).includes('/v2/positions')) {
            return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
          }
          if (String(url).includes('/v2/account')) {
            return new Response(JSON.stringify({ cash: '100000', buying_power: '400000', equity: '100000', portfolio_value: '100000' }), { status: 200, headers: { 'content-type': 'application/json' } })
          }
          if (String(url).includes('/v2/orders')) {
            return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
          }
          throw new Error(`unexpected:${url}`)
        },
      }),
      /paper_exit_only_exact_broker_position_required/,
    )
    assert.equal(postCalls, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: f.lifecycleFile }).load().state, S.MONITORING)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})


test('blocks a closed market before authorization consumption or submission', async () => {
  const f = fixture()
  let postCalls = 0
  try {
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: f.args,
        env: f.env,
        nowMs: f.nowMs,
        accountCredentialResolver: f.accountCredentialResolver,
        fetchImpl: async (url, init = {}) => {
          if (init.method === 'POST') postCalls += 1
          if (String(url).includes('/v2/clock')) return new Response(JSON.stringify({ is_open: false }), { status: 200, headers: { 'content-type': 'application/json' } })
          throw new Error(`unexpected:${url}`)
        },
      }),
      /paper_exit_only_market_open_required/,
    )
    assert.equal(postCalls, 0)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})

test('blocks a conflicting open order before authorization consumption or submission', async () => {
  const f = fixture()
  let postCalls = 0
  try {
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: f.args,
        env: f.env,
        nowMs: f.nowMs,
        accountCredentialResolver: f.accountCredentialResolver,
        fetchImpl: async (url, init = {}) => {
          const target = String(url)
          if (init.method === 'POST') postCalls += 1
          if (target.includes('/v2/clock')) return new Response(JSON.stringify({ is_open: true }), { status: 200, headers: { 'content-type': 'application/json' } })
          if (target.includes('/v2/account')) return new Response(JSON.stringify({ cash: '100000', buying_power: '400000', equity: '100000', portfolio_value: '100000', trading_blocked: false, account_blocked: false }), { status: 200, headers: { 'content-type': 'application/json' } })
          if (target.includes('/v2/positions')) return new Response(JSON.stringify([{ symbol: 'BTG', qty: '1', avg_entry_price: '4.12' }]), { status: 200, headers: { 'content-type': 'application/json' } })
          if (target.includes('/v2/orders?status=open')) return new Response(JSON.stringify([{ id: 'open-1', symbol: 'BTG', side: 'sell', qty: '1', status: 'new' }]), { status: 200, headers: { 'content-type': 'application/json' } })
          throw new Error(`unexpected:${target}`)
        },
      }),
      /paper_exit_only_conflicting_open_order/,
    )
    assert.equal(postCalls, 0)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})

test('blocks broker-position identity mismatch before authorization consumption or submission', async () => {
  const f = fixture()
  let postCalls = 0
  try {
    const life = JSON.parse(fs.readFileSync(f.lifecycleFile, 'utf8'))
    life.brokerPositionIdentity = 'BTG:2'
    fs.writeFileSync(f.lifecycleFile, `${JSON.stringify(life, null, 2)}\n`)
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: f.args,
        env: f.env,
        nowMs: f.nowMs,
        accountCredentialResolver: f.accountCredentialResolver,
        fetchImpl: async (url, init = {}) => {
          const target = String(url)
          if (init.method === 'POST') postCalls += 1
          if (target.includes('/v2/clock')) return new Response(JSON.stringify({ is_open: true }), { status: 200, headers: { 'content-type': 'application/json' } })
          if (target.includes('/v2/account')) return new Response(JSON.stringify({ cash: '100000', buying_power: '400000', equity: '100000', portfolio_value: '100000', trading_blocked: false, account_blocked: false }), { status: 200, headers: { 'content-type': 'application/json' } })
          if (target.includes('/v2/positions')) return new Response(JSON.stringify([{ symbol: 'BTG', qty: '1', avg_entry_price: '4.12' }]), { status: 200, headers: { 'content-type': 'application/json' } })
          if (target.includes('/v2/orders?status=open')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
          throw new Error(`unexpected:${target}`)
        },
      }),
      /paper_exit_only_broker_position_identity_mismatch/,
    )
    assert.equal(postCalls, 0)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})

test('submits one exact sell and reconciles the lifecycle closed', async () => {
  const f = fixture()
  let submitted = false
  let postCalls = 0
  try {
    const result = await runPaperAutoExecutionExitOnly({
      args: f.args,
      env: f.env,
      nowMs: f.nowMs,
      accountCredentialResolver: f.accountCredentialResolver,
      reportFile: f.reportFile,
      fetchImpl: async (url, init = {}) => {
        const target = String(url)
        if (target.includes('/v2/clock')) {
          return new Response(JSON.stringify({ is_open: true }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (target.includes('/v2/account')) {
          return new Response(JSON.stringify({ cash: '100000', buying_power: '400000', equity: '100000', portfolio_value: '100000', trading_blocked: false, account_blocked: false }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (target.includes('/v2/positions')) {
          const body = submitted ? [] : [{ asset_id: 'asset-btg', symbol: 'BTG', qty: '1', avg_entry_price: '4.12' }]
          return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (target.includes('/v2/orders?status=open')) {
          return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (target.includes('/v2/orders?status=all')) {
          const life = new PaperAutoExecutionLifecycleStore({ filePath: f.lifecycleFile }).load()
          const orders = [
            { id: 'enter-broker', client_order_id: life.enterClientOrderId, symbol: 'BTG', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '4.12' },
          ]
          if (life.exitClientOrderId) {
            orders.push({ id: 'exit-broker', client_order_id: life.exitClientOrderId, symbol: 'BTG', side: 'sell', status: 'filled', filled_qty: '1', filled_avg_price: '4.13' })
          }
          return new Response(JSON.stringify(orders), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (target.endsWith('/v2/orders') && init.method === 'POST') {
          postCalls += 1
          const payload = JSON.parse(init.body)
          assert.equal(payload.symbol, 'BTG')
          assert.equal(payload.qty, '1')
          assert.equal(payload.side, 'sell')
          assert.equal(payload.type, 'market')
          assert.equal(payload.time_in_force, 'day')
          assert.match(payload.client_order_id, /^gs-pa-exit-/)
          submitted = true
          return new Response(JSON.stringify({ id: 'exit-broker' }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`unexpected:${target}`)
      },
    })
    assert.equal(postCalls, 1)
    assert.equal(result.ok, true)
    assert.equal(result.status, 'EXACT_POSITION_PAPER_EXIT_COMPLETED')
    assert.equal(result.lifecycle.state, S.ROUND_TRIP_COMPLETED)
    assert.equal(result.safety.enterAllowed, false)
    assert.equal(result.safety.liveTradingAllowed, false)
    assert.equal(JSON.parse(fs.readFileSync(f.reportFile, 'utf8')).status, 'EXACT_POSITION_PAPER_EXIT_COMPLETED')
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})


test('emits fail-open Admin incident for EXIT-only operational failure without changing thrown error', async () => {
  const f = fixture()
  const incidents = []
  try {
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: f.args,
        env: f.env,
        nowMs: f.nowMs,
        incidentEmitter: async (incident) => {
          incidents.push(incident)
          throw new Error('notification_down')
        },
        accountCredentialResolver: f.accountCredentialResolver,
        fetchImpl: async (url, init = {}) => {
          const target = String(url)
          if (target.includes('/v2/clock')) {
            return new Response(JSON.stringify({ is_open: false }), { status: 200, headers: { 'content-type': 'application/json' } })
          }
          throw new Error(`unexpected:${target}`)
        },
      }),
      /paper_exit_only_market_open_required/,
    )
    assert.equal(incidents.length, 1)
    assert.equal(incidents[0].source, 'paper_execution')
    assert.equal(incidents[0].phase, 'exit')
    assert.equal(incidents[0].failureCode, 'paper_exit_only_market_open_required')
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: f.lifecycleFile }).load().state, S.MONITORING)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})

test('does not emit Admin incident for ordinary EXIT-only local authorization blockers', async () => {
  const f = fixture()
  const incidents = []
  let calls = 0
  try {
    const result = await runPaperAutoExecutionExitOnly({
      args: { ...f.args, execute: 'false' },
      env: f.env,
      nowMs: f.nowMs,
      incidentEmitter: async (incident) => incidents.push(incident),
      fetchImpl: async () => { calls += 1; throw new Error('network forbidden') },
    })
    assert.equal(result.status, 'EXIT_ONLY_BLOCKED')
    assert.equal(incidents.length, 0)
    assert.equal(calls, 0)
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})
