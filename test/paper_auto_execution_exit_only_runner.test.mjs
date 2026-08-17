import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'
import { runPaperAutoExecutionExitOnly } from '../src/scanner/paper_auto_execution_exit_only_runner.mjs'
import { derivePaperPositionMutationLockFile as D, acquirePaperPositionMutationLock as A, releasePaperPositionMutationLock as R } from '../src/scanner/paper_auto_execution_position_mutation_lock.mjs'

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
    readyForReadonlyBrokerRead: true,
    accessSwitchEnabled: true,
    credentialSource: 'test_resolver',
    env: { ALPACA_KEY: 'paper-key', ALPACA_SECRET: 'paper-secret' },
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


test('EXIT-only direct credential resolver calls receive GEMINI_CREDENTIAL_MASTER_KEY', async () => {
  const f = fixture()
  delete f.env.APCA_API_KEY_ID
  delete f.env.APCA_API_SECRET_KEY
  f.env.GEMINI_CREDENTIAL_MASTER_KEY = 'm'.repeat(64)
  const calls = []
  const resolver = async (args) => {
    calls.push(args)
    if (args?.masterKey !== f.env.GEMINI_CREDENTIAL_MASTER_KEY) {
      return { readyForReadonlyBrokerRead: false, env: {} }
    }
    return {
      readyForReadonlyBrokerRead: true,
      accessSwitchEnabled: true,
      credentialSource: 'encrypted_tenant_store',
      env: {
        ALPACA_KEY: 'resolved-paper-key',
        ALPACA_SECRET: 'resolved-paper-secret',
        APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
        ALPACA_PAPER_TRADING: 'true',
      },
    }
  }
  try {
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: f.args,
        env: f.env,
        nowMs: f.nowMs,
        accountCredentialResolver: resolver,
        fetchImpl: async (url) => {
          if (String(url).endsWith('/v2/clock')) {
            return new Response(
              JSON.stringify({ is_open: false, timestamp: new Date(f.nowMs).toISOString() }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          }
          throw new Error(`unexpected_fetch:${url}`)
        },
      }),
      /paper_exit_only_market_open_required/,
    )
    assert.ok(calls.length >= 1)
    assert.equal(calls[0]?.masterKey, f.env.GEMINI_CREDENTIAL_MASTER_KEY)
    assert.equal(calls[0]?.env?.GEMINI_CREDENTIAL_MASTER_KEY, f.env.GEMINI_CREDENTIAL_MASTER_KEY)
    assert.equal(calls[0]?.purpose, 'paper_exit_only_market_clock_readonly')
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true })
  }
})

test('clock preflight accepts resolver-backed PAPER credentials when direct APCA keys are absent', async () => {
  const f = fixture()
  delete f.env.APCA_API_KEY_ID
  delete f.env.APCA_API_SECRET_KEY
  const observed = []
  const accountCredentialResolver = async () => ({
    readyForReadonlyBrokerRead: true,
    accessSwitchEnabled: true,
    credentialSource: 'encrypted_internal_owner_credentials',
    env: {
      ALPACA_KEY: 'resolved-paper-key',
      ALPACA_SECRET: 'resolved-paper-secret',
    },
  })
  try {
    await assert.rejects(
      runPaperAutoExecutionExitOnly({
        args: f.args,
        env: f.env,
        nowMs: f.nowMs,
        accountCredentialResolver,
        fetchImpl: async (url, init = {}) => {
          observed.push({ url: String(url), headers: init.headers ?? {} })
          if (String(url).endsWith('/v2/clock')) {
            return new Response(
              JSON.stringify({ is_open: false, timestamp: new Date(f.nowMs).toISOString() }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          }
          throw new Error('network_after_clock_forbidden')
        },
      }),
      /paper_exit_only_market_open_required/,
    )
    const clock = observed.find(row => row.url.endsWith('/v2/clock'))
    assert.ok(clock)
    assert.equal(clock.headers['APCA-API-KEY-ID'], 'resolved-paper-key')
    assert.equal(clock.headers['APCA-API-SECRET-KEY'], 'resolved-paper-secret')
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
            orders.push({ id: 'exit-broker', client_order_id: life.exitClientOrderId, symbol: 'BTG', side: 'sell', status: 'filled', filled_qty: '1', filled_avg_price: '4.13', submitted_at: '2026-08-11T15:00:00Z', filled_at: '2026-08-11T15:00:00.250Z' })
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
          return new Response(JSON.stringify({ id: 'exit-broker', submitted_at: '2026-08-11T15:00:00Z' }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`unexpected:${target}`)
      },
    })
    assert.equal(postCalls, 1)
    assert.equal(result.ok, true)
    assert.equal(result.status, 'EXACT_POSITION_PAPER_EXIT_COMPLETED')
    assert.equal(result.brokerTiming.submittedAt, '2026-08-11T15:00:00.000Z')
    assert.equal(result.brokerTiming.filledAt, '2026-08-11T15:00:00.250Z')
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

test('historical-order read uses resolver-backed PAPER credentials when direct APCA keys are absent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-exit-history-resolver-'))
  const file = path.join(dir, 'lifecycle.json')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: file })
  const life = store.create({ lifecycleId: 'life-history-resolver', selectedSymbol: 'BTG', intendedQuantity: 1 })
  store.transition('ENTER_SUBMITTING', { enterClientOrderId: 'enter-history-resolver' })
  store.transition('POSITION_CONFIRMED', { filledQuantity: 1, averageFillPrice: 1, brokerPositionIdentity: 'BTG:1' })
  store.transition('MONITORING')

  const seen = []
  let exitSubmitted = false
  let exitPostHeaders = null
  const fetchImpl = async (url, init = {}) => {
    const u = String(url)
    seen.push({ url: u, headers: init.headers ?? {} })
    if (u.includes('/v2/clock')) return new Response(JSON.stringify({ is_open: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    if (u.includes('/v2/positions')) return new Response(JSON.stringify(exitSubmitted ? [] : [{ symbol: 'BTG', qty: '1', asset_id: 'BTG-ASSET', avg_entry_price: '1' }]), { status: 200, headers: { 'content-type': 'application/json' } })
    if (u.includes('/v2/orders?status=open')) return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    if (u.endsWith('/v2/orders') && init.method === 'POST') {
      const body = JSON.parse(init.body)
      exitPostHeaders = init.headers ?? {}
      exitSubmitted = true
      return new Response(JSON.stringify({ id: 'exit-history-resolver-broker', client_order_id: body.client_order_id, status: 'accepted', submitted_at: '2026-08-12T19:00:00Z' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (u.includes('/v2/orders?status=all')) {
      const current = store.load()
      return new Response(JSON.stringify([{ id: 'exit-history-resolver-broker', client_order_id: current.exitClientOrderId, symbol: 'BTG', side: 'sell', status: 'filled', qty: '1', filled_qty: '1', submitted_at: '2026-08-12T19:00:00Z', filled_at: '2026-08-12T19:00:01Z' }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (u.includes('/v2/account')) return new Response(JSON.stringify({ status: 'ACTIVE', buying_power: '10000', cash: '10000', portfolio_value: '10000', equity: '10000' }), { status: 200, headers: { 'content-type': 'application/json' } })
    throw new Error(`unexpected_fetch:${u}`)
  }

  const resolver = async () => ({
    readyForReadonlyBrokerRead: true,
    credentialSource: 'test_resolver',
    env: { ALPACA_KEY: 'resolver-key', ALPACA_SECRET: 'resolver-secret', APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_PAPER_TRADING: 'true' },
  })

  const result = await runPaperAutoExecutionExitOnly({
    args: { execute: 'true', lifecycleFile: file, lifecycleId: life.lifecycleId, symbol: 'BTG', quantity: '1' },
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_PAPER_TRADING: 'true', PAPER_AUTO_EXECUTION_ENABLED: '1', PAPER_AUTO_EXIT_ENABLED: '1' },
    fetchImpl,
    accountCredentialResolver: resolver,
    incidentEmitter: async () => {},
  })
  const history = seen.find((x) => x.url.includes('/v2/orders?status=all'))
  assert.equal(exitPostHeaders?.['APCA-API-KEY-ID'], 'resolver-key')
  assert.equal(exitPostHeaders?.['APCA-API-SECRET-KEY'], 'resolver-secret')
  assert.equal(history?.headers?.['APCA-API-KEY-ID'], 'resolver-key')
  assert.equal(history?.headers?.['APCA-API-SECRET-KEY'], 'resolver-secret')
  assert.equal(result.status, 'EXACT_POSITION_PAPER_EXIT_COMPLETED')
  assert.equal(result.lifecycle.state, 'ROUND_TRIP_COMPLETED')
})


test('shared SCALE lock blocks EXIT before submission',async()=>{
 const f=fixture();let posts=0
 const h=A({lockFile:D(f.lifecycleFile),lifecycleId:f.args.lifecycleId,symbol:f.args.symbol,action:'scale_out',now:()=>f.nowMs,tokenFactory:()=> 'scale-held'})
 try{
  await assert.rejects(runPaperAutoExecutionExitOnly({args:f.args,env:f.env,nowMs:f.nowMs,accountCredentialResolver:f.accountCredentialResolver,fetchImpl:async(u,x={})=>{
   const q=String(u);if(x.method==='POST')posts++
   if(q.includes('/v2/clock'))return new Response('{"is_open":true}',{status:200})
   if(q.includes('/v2/account'))return new Response('{"cash":"100000","buying_power":"400000","equity":"100000","portfolio_value":"100000","trading_blocked":false,"account_blocked":false}',{status:200})
   if(q.includes('/v2/positions'))return new Response('[{"symbol":"BTG","qty":"1","avg_entry_price":"4.12"}]',{status:200})
   if(q.includes('/v2/orders?status=open'))return new Response('[]',{status:200})
   throw Error(`unexpected:${q}`)
  }}),/POSITION_MUTATION_LOCK_HELD/)
  assert.equal(posts,0)
  assert.equal(new PaperAutoExecutionLifecycleStore({filePath:f.lifecycleFile}).load().state,S.MONITORING)
 }finally{R(h);fs.rmSync(f.dir,{recursive:true,force:true})}
})

test('post-lock fresh broker quantity change blocks stale EXIT before submission',async()=>{
 const f=fixture();let posts=0,positionReads=0
 try{
  await assert.rejects(runPaperAutoExecutionExitOnly({
   args:f.args,env:f.env,nowMs:f.nowMs,accountCredentialResolver:f.accountCredentialResolver,
   fetchImpl:async(u,x={})=>{
    const q=String(u);if(x.method==='POST')posts++
    if(q.includes('/v2/clock'))return new Response('{"is_open":true}',{status:200})
    if(q.includes('/v2/account'))return new Response('{"id":"paper-account-test","cash":"100000","buying_power":"400000","equity":"100000","portfolio_value":"100000","trading_blocked":false,"account_blocked":false}',{status:200})
    if(q.includes('/v2/positions')){positionReads++;return new Response(positionReads<=1?'[{"symbol":"BTG","qty":"1","avg_entry_price":"4.12"}]':'[{"symbol":"BTG","qty":"2","avg_entry_price":"4.12"}]',{status:200})}
    if(q.includes('/v2/orders?status=open'))return new Response('[]',{status:200})
    throw Error(`unexpected:${q}`)
   }
  }),/paper_exit_only_post_lock_exact_broker_position_required/)
  assert.equal(posts,0)
  assert.ok(positionReads>=2)
  assert.equal(new PaperAutoExecutionLifecycleStore({filePath:f.lifecycleFile}).load().state,S.MONITORING)
 }finally{fs.rmSync(f.dir,{recursive:true,force:true})}
})



test('post-lock market close blocks stale EXIT before submission',async()=>{
 const f=fixture();let posts=0,clockReads=0
 try{
  await assert.rejects(runPaperAutoExecutionExitOnly({
   args:f.args,env:f.env,nowMs:f.nowMs,accountCredentialResolver:f.accountCredentialResolver,
   fetchImpl:async(u,x={})=>{
    const q=String(u);if(x.method==='POST')posts++
    if(q.includes('/v2/clock')){clockReads++;return new Response(clockReads===1?'{"is_open":true}':'{"is_open":false}',{status:200})}
    if(q.includes('/v2/account'))return new Response('{"id":"paper-account-test","cash":"100000","buying_power":"400000","equity":"100000","portfolio_value":"100000","trading_blocked":false,"account_blocked":false}',{status:200})
    if(q.includes('/v2/positions'))return new Response('[{"symbol":"BTG","qty":"1","avg_entry_price":"4.12"}]',{status:200})
    if(q.includes('/v2/orders?status=open'))return new Response('[]',{status:200})
    throw Error(`unexpected:${q}`)
   }
  }),/paper_exit_only_post_lock_market_open_required/)
  assert.equal(posts,0)
  assert.equal(clockReads,2)
  assert.equal(new PaperAutoExecutionLifecycleStore({filePath:f.lifecycleFile}).load().state,S.MONITORING)
 }finally{fs.rmSync(f.dir,{recursive:true,force:true})}
})

test('post-lock unresolved SCALE sidecar blocks EXIT before submission',async()=>{
 const f=fixture();let posts=0
 try{
  const {PaperAutoExecutionScaleActionStore}=await import('../src/scanner/paper_auto_execution_scale_action_store.mjs')
  const base=path.basename(f.lifecycleFile)
  const sidecar=path.join(path.dirname(f.lifecycleFile),`${base.slice(0,-5)}.scale_action.json`)
  const ss=new PaperAutoExecutionScaleActionStore({filePath:sidecar,clock:()=>f.nowMs})
  ss.prepare({lifecycleId:f.args.lifecycleId,action:'scale_in',symbol:f.args.symbol,fromQuantity:1,targetQuantity:2})
  await assert.rejects(runPaperAutoExecutionExitOnly({
   args:f.args,env:f.env,nowMs:f.nowMs,accountCredentialResolver:f.accountCredentialResolver,
   fetchImpl:async(u,x={})=>{
    const q=String(u);if(x.method==='POST')posts++
    if(q.includes('/v2/clock'))return new Response('{"is_open":true}',{status:200})
    if(q.includes('/v2/account'))return new Response('{"id":"paper-account-test","cash":"100000","buying_power":"400000","equity":"100000","portfolio_value":"100000","trading_blocked":false,"account_blocked":false}',{status:200})
    if(q.includes('/v2/positions'))return new Response('[{"symbol":"BTG","qty":"1","avg_entry_price":"4.12"}]',{status:200})
    if(q.includes('/v2/orders?status=open'))return new Response('[]',{status:200})
    throw Error(`unexpected:${q}`)
   }
  }),/paper_exit_only_post_lock_unresolved_scale_action/)
  assert.equal(posts,0)
  assert.equal(new PaperAutoExecutionLifecycleStore({filePath:f.lifecycleFile}).load().state,S.MONITORING)
 }finally{fs.rmSync(f.dir,{recursive:true,force:true})}
})

test('resolver-not-ready blocks EXIT before network even when runtime APCA credentials exist',async()=>{
 const f=fixture();let calls=0
 try{
  await assert.rejects(runPaperAutoExecutionExitOnly({
   args:f.args,
   env:{...f.env,APCA_API_KEY_ID:'legacy-runtime-key',APCA_API_SECRET_KEY:'legacy-runtime-secret'},
   nowMs:f.nowMs,
   accountCredentialResolver:async()=>({
    readyForReadonlyBrokerRead:false,
    accessSwitchEnabled:true,
    credentialSource:'encrypted_tenant_store_unavailable',
   }),
   fetchImpl:async()=>{calls++;throw Error('network forbidden')},
  }),/paper_exit_only_clock_credentials_required/)
  assert.equal(calls,0)
  assert.equal(new PaperAutoExecutionLifecycleStore({filePath:f.lifecycleFile}).load().state,S.MONITORING)
 }finally{fs.rmSync(f.dir,{recursive:true,force:true})}
})
