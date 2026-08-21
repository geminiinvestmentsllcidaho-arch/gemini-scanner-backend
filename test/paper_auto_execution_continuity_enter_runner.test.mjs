import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionContinuityEnterRunner } from '../src/scanner/paper_auto_execution_continuity_enter_runner.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-enter-'))
const readyCredentials = async () => ({ readyForReadonlyBrokerRead: true, env: { ALPACA_KEY: 'paper-key', ALPACA_SECRET: 'paper-secret', APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_PAPER_TRADING: 'true' } })
const freshCandidateSnapshot = (symbol, now = Date.now(), price = 10) => ({ observedAt: new Date(now).toISOString(), candidates: [{ symbol, state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 99, price }] })
const PAPER_ACCOUNT_IDENTITY = 'alpaca-paper:0123456789abcdef01234567'
const currentBaseline = () => { const q=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value])); return {ok:true,paperOnly:true,readOnly:true,sessionDate:`${q.year}-${q.month}-${q.day}`,accountIdentity:PAPER_ACCOUNT_IDENTITY} }

test('passes GEMINI_CREDENTIAL_MASTER_KEY into the account credential resolver without broker work while downstream reads stay injected', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-continuity-enter-master-key-'))
  const lifecycleFile = path.join(dir, 'lifecycle.json')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
  store.create({
    selectedSymbol: 'KEY',
    scannerEvidence: { source: 'paper_auto_continuity_scanner_candidate', symbol: 'KEY', state: 'ENTER', score: 99, paperOnly: true },
  })
  const expectedMasterKey = 'm'.repeat(64)
  let resolverArgs = null
  let downstreamReads = 0
  const runner = createPaperAutoExecutionContinuityEnterRunner({
    env: {
      PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1',
      GEMINI_CREDENTIAL_MASTER_KEY: expectedMasterKey,
    },
    getLifecycleFile: () => lifecycleFile,
    getPremarketBaseline: async () => currentBaseline(),
    getScanSnapshot: async () => freshCandidateSnapshot('KEY'),
    accountCredentialResolver: async (args) => {
      resolverArgs = args
      return {
        readyForReadonlyBrokerRead: true,
        env: {
          ALPACA_KEY: 'paper-key',
          ALPACA_SECRET: 'paper-secret',
          APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
          ALPACA_PAPER_TRADING: 'true',
        },
      }
    },
    fetchClock: async () => {
      downstreamReads += 1
      return { ok: true, status: 'connected_readonly', marketClock: { isOpen: false } }
    },
    fetchAccount: async () => {
      downstreamReads += 1
      throw new Error('account_read_must_not_run_after_closed_clock')
    },
  })
  const out = await runner.runOnce()
  assert.equal(resolverArgs?.masterKey, expectedMasterKey)
  assert.equal(resolverArgs?.env?.GEMINI_CREDENTIAL_MASTER_KEY, expectedMasterKey)
  assert.equal(resolverArgs?.purpose, 'paper_continuity_enter_credentials')
  assert.equal(out.submissions, 0)
  assert.equal(out.reconciliations, 0)
  assert.ok(downstreamReads >= 1)
})
const clockOpen = async ({ nowMs = Date.now() } = {}) => ({ ok: true, status: 'connected_readonly', marketClock: { isOpen: true, timestamp: new Date(nowMs).toISOString() } })

test('disabled by default never contacts broker or submits', async () => {
  let contacts = 0
  const runner = createPaperAutoExecutionContinuityEnterRunner({
    env: {},
    fetchAccount: async () => { contacts += 1 },
    fetchClock: async () => { contacts += 1 },
    accountCredentialResolver: async () => { contacts += 1 },
  })
  const out = await runner.runOnce()
  assert.equal(out.lastStatus, 'CONTINUITY_ENTER_DISABLED_BY_ENV')
  assert.equal(contacts, 0)
  assert.equal(out.safety.paperOnly, true)
  assert.equal(out.safety.liveTradingAllowed, false)
})

test('stale candidate snapshot fails closed before credential resolution or broker work', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'STALE' })
    const now = Date.now()
    let resolverCalls = 0
    let brokerReads = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => ({ observedAt: new Date(now - 30001).toISOString(), candidates: [{ symbol: 'STALE', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [] }] }),
      now: () => now,
      accountCredentialResolver: async () => { resolverCalls += 1; return readyCredentials() },
      fetchClock: async () => { brokerReads += 1 },
      fetchAccount: async () => { brokerReads += 1 },
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'FRESH_CANDIDATE_REQUIRED')
    assert.equal(resolverCalls, 0)
    assert.equal(brokerReads, 0)
    assert.equal(out.submissions, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})


test('missing scan snapshot adapter fails closed before credential resolution or broker work', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'NOSCAN' })
    let resolverCalls = 0
    let brokerReads = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      accountCredentialResolver: async () => { resolverCalls += 1; return readyCredentials() },
      fetchClock: async () => { brokerReads += 1 },
      fetchAccount: async () => { brokerReads += 1 },
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'FRESH_CANDIDATE_REVALIDATION_REQUIRED')
    assert.equal(resolverCalls, 0)
    assert.equal(brokerReads, 0)
    assert.equal(out.submissions, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('future candidate snapshot fails closed before credential resolution or broker work', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'FUTURE' })
    const now = Date.now()
    let resolverCalls = 0
    let brokerReads = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('FUTURE', now + 1),
      now: () => now,
      accountCredentialResolver: async () => { resolverCalls += 1; return readyCredentials() },
      fetchClock: async () => { brokerReads += 1 },
      fetchAccount: async () => { brokerReads += 1 },
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'FRESH_CANDIDATE_REQUIRED')
    assert.equal(resolverCalls, 0)
    assert.equal(brokerReads, 0)
    assert.equal(out.submissions, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

for (const invalid of ['missing_symbol', 'blocked', 'blockers']) {
  test(`candidate revalidation fails closed for ${invalid}`, async () => {
    const dir = tmp()
    try {
      const file = path.join(dir, 'life.json')
      new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'EXACT' })
      const now = Date.now()
      const candidate = invalid === 'missing_symbol'
        ? { symbol: 'OTHER', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [] }
        : invalid === 'blocked'
          ? { symbol: 'EXACT', state: 'ENTER', buyRecommendation: true, blocked: true, blockers: [] }
          : { symbol: 'EXACT', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: ['risk'] }
      let resolverCalls = 0
      let brokerReads = 0
      const runner = createPaperAutoExecutionContinuityEnterRunner({
        env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
        getLifecycleFile: () => file,
        getPremarketBaseline: async () => currentBaseline(),
        getScanSnapshot: async () => ({ observedAt: new Date(now).toISOString(), candidates: [candidate] }),
        now: () => now,
        accountCredentialResolver: async () => { resolverCalls += 1; return readyCredentials() },
        fetchClock: async () => { brokerReads += 1 },
        fetchAccount: async () => { brokerReads += 1 },
      })
      const out = await runner.runOnce()
      assert.equal(out.lastStatus, 'CANDIDATE_REVALIDATION_FAILED')
      assert.equal(resolverCalls, 0)
      assert.equal(brokerReads, 0)
      assert.equal(out.submissions, 0)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
}

test('fresh eligible candidate reaches credential resolution then closed market stops before submission', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'FRESH' })
    const now = Date.now()
    let resolverCalls = 0
    let submitted = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('FRESH', now),
      now: () => now,
      accountCredentialResolver: async () => { resolverCalls += 1; return readyCredentials() },
      fetchClock: async () => ({ ok: true, status: 'connected_readonly', marketClock: { isOpen: false } }),
      fetchAccount: async () => ({ ok: true, status: 'connected_readonly', observedAt: new Date(now).toISOString(), account: { accountIdentity: PAPER_ACCOUNT_IDENTITY,}, positions: [], openOrders: [] }),
      createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
    })
    const out = await runner.runOnce()
    assert.equal(resolverCalls, 1)
    assert.equal(out.lastStatus, 'MARKET_OPEN_REQUIRED')
    assert.equal(submitted, 0)
    assert.equal(out.submissions, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('candidate no longer eligible fails closed before credential resolution or broker work', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'OLD' })
    const now = Date.now()
    let resolverCalls = 0
    let brokerReads = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => ({ observedAt: new Date(now).toISOString(), candidates: [{ symbol: 'OLD', state: 'WAIT', buyRecommendation: false, blocked: false, blockers: [] }] }),
      now: () => now,
      accountCredentialResolver: async () => { resolverCalls += 1; return readyCredentials() },
      fetchClock: async () => { brokerReads += 1 },
      fetchAccount: async () => { brokerReads += 1 },
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'CANDIDATE_REVALIDATION_FAILED')
    assert.equal(resolverCalls, 0)
    assert.equal(brokerReads, 0)
    assert.equal(out.submissions, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('candidate selected submits one PAPER ENTER, reconciles, and reaches MONITORING', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    const store = new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => 'life-1' })
    store.create({ selectedSymbol: 'ABC' })
    let submitted = 0
    let notifications = 0
    const now = Date.now()
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('ABC', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
        account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 },
        positions: submitted ? [{ symbol: 'ABC', qty: 10, averageEntryPrice: 10 }] : [],
        openOrders: [],
      }),
      fetchHistoricalOrders: async () => ({
        historicalOrders: submitted ? [{ id: 'order-1', client_order_id: store.load()?.enterClientOrderId, symbol: 'ABC', side: 'buy', status: 'filled', filled_qty: '10', filled_avg_price: '10' }] : [],
      }),
      executionNotifier: async event => {
        notifications += 1
        assert.equal(event.action, 'ENTER')
        assert.equal(event.symbol, 'ABC')
        assert.equal(event.quantity, 10)
        assert.equal(event.brokerOrderId, 'order-1')
        assert.equal(event.lifecycleId, 'life-1')
        throw new Error('notification_test_failure')
      },
      createAdapter: () => ({
        submitPaperOrder: async order => {
          submitted += 1
          assert.equal(order.symbol, 'ABC')
          assert.equal(order.side, 'buy')
          assert.equal(order.qty, 10)
          assert.equal(order.paperOnly, true)
          return { ok: true, orderSubmitted: true, brokerOrderId: 'order-1', orderId: 'order-1', clientOrderId: order.clientOrderId }
        },
      }),
    })
    const out = await runner.runOnce()
    assert.equal(submitted, 1)
    assert.equal(notifications, 1)
    assert.equal(out.lastStatus, 'CONTINUITY_ENTER_MONITORING_CONFIRMED')
    assert.equal(out.lastLifecycle.state, 'MONITORING')
    assert.equal(out.lastLifecycle.filledQuantity, 10)
    assert.equal(out.lastLifecycle.brokerPositionIdentity, 'ABC:10')
    assert.equal(out.lastSizing.allocationPercent, 10)
    assert.equal(out.lastSizing.quantity, 10)
    assert.equal(out.lastSizing.requiredBuyingPower, 100)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})


test('future PAPER account snapshot fails closed before submission', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'ACCT' })
    const now = Date.now()
    let submitted = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('ACCT', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', observedAt: new Date(now + 1).toISOString(),
        account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 }, positions: [], openOrders: [],
      }),
      createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'PAPER_ACCOUNT_SNAPSHOT_STALE')
    assert.equal(submitted, 0)
    assert.equal(out.submissions, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('missing or invalid candidate price fails closed before submission', async () => {
  for (const price of [undefined, null, 0, -1, 'bad']) {
    const dir = tmp()
    try {
      const file = path.join(dir, 'life.json')
      new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'PRICE' })
      const now = Date.now()
      let submitted = 0
      const snapshot = freshCandidateSnapshot('PRICE', now, 10)
      snapshot.candidates[0].price = price
      const runner = createPaperAutoExecutionContinuityEnterRunner({
        env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
        getLifecycleFile: () => file,
        getPremarketBaseline: async () => currentBaseline(),
        getScanSnapshot: async () => snapshot,
        now: () => now,
        accountCredentialResolver: readyCredentials,
        fetchClock: clockOpen,
        fetchAccount: async () => ({
          ok: true, status: 'connected_readonly', observedAt: new Date(now).toISOString(),
          account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 },
          positions: [], openOrders: [],
        }),
        createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
      })
      const out = await runner.runOnce()
      assert.equal(out.lastStatus, 'POSITION_SIZING_CANDIDATE_PRICE_REQUIRED')
      assert.equal(submitted, 0)
      assert.equal(out.submissions, 0)
      assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  }
})

test('missing or insufficient PAPER buying power fails closed before percentage-sized submission', async () => {
  for (const buyingPower of [undefined, null, 99.99]) {
    const dir = tmp()
    try {
      const file = path.join(dir, 'life.json')
      new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'FUNDS' })
      const now = Date.now()
      let submitted = 0
      const runner = createPaperAutoExecutionContinuityEnterRunner({
        env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
        getLifecycleFile: () => file,
        getPremarketBaseline: async () => currentBaseline(),
        getScanSnapshot: async () => freshCandidateSnapshot('FUNDS', now, 10),
        now: () => now,
        accountCredentialResolver: readyCredentials,
        fetchClock: clockOpen,
        fetchAccount: async () => ({
          ok: true, status: 'connected_readonly', observedAt: new Date(now).toISOString(),
          account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower },
          positions: [], openOrders: [],
        }),
        createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
      })
      const out = await runner.runOnce()
      assert.equal(out.lastStatus, 'POSITION_SIZING_INSUFFICIENT_BUYING_POWER_FOR_ALLOCATION')
      assert.equal(submitted, 0)
      assert.equal(out.submissions, 0)
      assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  }
})

test('PAPER buying power equal to percentage-sized required capital passes affordability guard', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    const store = new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => 'life-affordability-boundary' })
    store.create({ selectedSymbol: 'BOUND' })
    const now = Date.now()
    let submitted = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('BOUND', now, 10),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', observedAt: new Date(now).toISOString(),
        account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 100, buyingPower: 10 },
        positions: submitted ? [{ symbol: 'BOUND', qty: 1, averageEntryPrice: 10 }] : [],
        openOrders: [],
      }),
      fetchHistoricalOrders: async () => ({
        historicalOrders: submitted ? [{ id: 'order-bound', client_order_id: store.load()?.enterClientOrderId, symbol: 'BOUND', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '10' }] : [],
      }),
      createAdapter: () => ({
        submitPaperOrder: async order => {
          submitted += 1
          return { ok: true, orderSubmitted: true, brokerOrderId: 'order-bound', orderId: 'order-bound', clientOrderId: order.clientOrderId }
        },
      }),
    })
    const out = await runner.runOnce()
    assert.equal(submitted, 1)
    assert.notEqual(out.lastStatus, 'CANDIDATE_PRICE_REQUIRED_FOR_AFFORDABILITY')
    assert.notEqual(out.lastStatus, 'POSITION_SIZING_INSUFFICIENT_BUYING_POWER_FOR_ALLOCATION')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('existing position or open-order conflict fails closed before submission', async () => {
  for (const conflict of ['position', 'order']) {
    const dir = tmp()
    try {
      const file = path.join(dir, 'life.json')
      new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'XYZ' })
      let submitted = 0
      const now = Date.now()
      const runner = createPaperAutoExecutionContinuityEnterRunner({
        env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
        getLifecycleFile: () => file,
        getPremarketBaseline: async () => currentBaseline(),
        getScanSnapshot: async () => freshCandidateSnapshot('XYZ', now),
        now: () => now,
        accountCredentialResolver: readyCredentials,
        fetchClock: clockOpen,
        fetchAccount: async () => ({
          ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
          account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 },
          positions: conflict === 'position' ? [{ symbol: 'XYZ', qty: 1 }] : [],
          openOrders: conflict === 'order' ? [{ symbol: 'XYZ', side: 'buy' }] : [],
        }),
        createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
      })
      const out = await runner.runOnce()
      assert.equal(submitted, 0)
      assert.equal(out.lastStatus, conflict === 'position' ? 'EXISTING_BROKER_POSITION_CONFLICT' : 'CONFLICTING_OPEN_ORDER')
      assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  }
})

test('different-symbol open PAPER order blocks continuity ENTER under global single-flight policy', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'NEW' })
    let submitted = 0
    const now = Date.now()
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('NEW', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
        account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 },
        positions: [],
        openOrders: [{ symbol: 'USAS', side: 'sell' }],
      }),
      createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'GLOBAL_OPEN_ORDER_CONCURRENCY_LIMIT')
    assert.equal(submitted, 0)
    assert.equal(out.submissions, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('different-symbol existing PAPER position blocks continuity ENTER under global one-position policy', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'NEW' })
    let submitted = 0
    const now = Date.now()
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('NEW', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
        account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 },
        positions: [{ symbol: 'USAS', qty: 1 }],
        openOrders: [],
      }),
      createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'GLOBAL_POSITION_CONCURRENCY_LIMIT')
    assert.equal(submitted, 0)
    assert.equal(out.submissions, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('concurrent enter cycles deduplicate to one submission', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'ONE' })
    let submitted = 0
    const now = Date.now()
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('ONE', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
        account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 },
        positions: submitted ? [{ symbol: 'ONE', qty: 1, averageEntryPrice: 5 }] : [],
        openOrders: [],
      }),
      fetchHistoricalOrders: async () => ({ historicalOrders: submitted ? [{ id: 'o1', client_order_id: new PaperAutoExecutionLifecycleStore({ filePath: file }).load()?.enterClientOrderId, symbol: 'ONE', side: 'buy', status: 'filled', filled_qty: '10', filled_avg_price: '5' }] : [] }),
      createAdapter: () => ({ submitPaperOrder: async order => { submitted += 1; await new Promise(r => setTimeout(r, 10)); return { ok: true, orderSubmitted: true, brokerOrderId: 'o1', orderId: 'o1', clientOrderId: order.clientOrderId } } }),
    })
    const [a, b] = await Promise.all([runner.runOnce(), runner.runOnce()])
    assert.equal(submitted, 1)
    assert.equal(a.lastStatus, 'CONTINUITY_ENTER_MONITORING_CONFIRMED')
    assert.equal(b.lastStatus, 'CONTINUITY_ENTER_MONITORING_CONFIRMED')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})


for (const restartState of ['ENTER_OPEN', 'ENTER_UNKNOWN']) {
  test(`persisted ${restartState} restart reconciles without blind ENTER resubmission`, async () => {
    const dir = tmp()
    try {
      const file = path.join(dir, 'life.json')
      const store = new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => `restart-${restartState.toLowerCase()}` })
      store.create({ selectedSymbol: 'RST' })
      store.transition('ENTER_SUBMITTING', { enterClientOrderId: `gs-restart-${restartState.toLowerCase()}` })
      store.transition(restartState, { enterBrokerOrderId: 'restart-order-1' })
      let submitted = 0
      let adapterCreates = 0
      let clockFetches = 0
      const now = Date.now()
      const runner = createPaperAutoExecutionContinuityEnterRunner({
        env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
        getLifecycleFile: () => file,
        now: () => now,
        accountCredentialResolver: readyCredentials,
        fetchClock: async () => { clockFetches += 1; return clockOpen() },
        fetchAccount: async () => ({
          ok: true,
          status: 'connected_readonly',
          mode: 'PAPER_ONLY',
          observedAt: new Date(now).toISOString(),
          runtime: { readOnly: true, allowedMethods: ['GET'] },
          account: { accountIdentity: PAPER_ACCOUNT_IDENTITY, tradingBlocked: false, accountBlocked: false, equity: 1000, buyingPower: 1000 },
          positions: [{ symbol: 'RST', qty: 1, averageEntryPrice: 7.5 }],
          openOrders: [],
        }),
        fetchHistoricalOrders: async () => ({
          historicalOrders: [{
            id: 'restart-order-1',
            client_order_id: store.load()?.enterClientOrderId,
            symbol: 'RST',
            side: 'buy',
            status: 'filled',
            filled_qty: '10',
            filled_avg_price: '7.5',
          }],
        }),
        createAdapter: () => {
          adapterCreates += 1
          return { submitPaperOrder: async () => { submitted += 1 } }
        },
        submitOrder: async () => {
          submitted += 1
          throw new Error('blind_resubmit_must_not_happen')
        },
      })
      const out = await runner.runOnce()
      assert.equal(submitted, 0)
      assert.equal(adapterCreates, 0)
      assert.equal(clockFetches, 0)
      assert.equal(out.submissions, 0)
      assert.equal(out.reconciliations, 1)
      assert.equal(out.lastStatus, 'CONTINUITY_ENTER_MONITORING_CONFIRMED')
      assert.equal(out.lastLifecycle.state, 'MONITORING')
      assert.equal(out.lastLifecycle.filledQuantity, 1)
      assert.equal(out.lastLifecycle.brokerPositionIdentity, 'RST:1')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}

test('continuity ENTER baseline account identity mismatch blocks before submission',async()=>{const d=tmp();try{const f=path.join(d,'life.json');new PaperAutoExecutionLifecycleStore({filePath:f}).create({selectedSymbol:'BASE'});const n=Date.now();let s=0,a=0;const r=createPaperAutoExecutionContinuityEnterRunner({env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},getLifecycleFile:()=>f,getPremarketBaseline:async()=>({...currentBaseline(),accountIdentity:'alpaca-paper:fedcba9876543210fedcba98'}),getScanSnapshot:async()=>freshCandidateSnapshot('BASE',n),now:()=>n,accountCredentialResolver:readyCredentials,fetchClock:clockOpen,fetchAccount:async()=>{a++;return{ok:true,status:'connected_readonly',observedAt:new Date(n).toISOString(),account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:[],openOrders:[]}},createAdapter:()=>({submitPaperOrder:async()=>{s++}})});const o=await r.runOnce();assert.equal(o.lastStatus,'PREMARKET_CAPITAL_BASELINE_ACCOUNT_IDENTITY_MISMATCH');assert.equal(a,1);assert.equal(s,0);assert.equal(o.submissions,0);assert.equal(new PaperAutoExecutionLifecycleStore({filePath:f}).load().state,'CANDIDATE_SELECTED')}finally{fs.rmSync(d,{recursive:true,force:true})}})

test('Module 6 re-entry control fails closed on governance', async () => {
  const d = tmp()
  try {
    const f = path.join(d, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: f }).create({ selectedSymbol: 'M6BLOCK' })
    const n = Date.now()
    let resolverCalls = 0
    const snapshot = freshCandidateSnapshot('M6BLOCK', n)
    snapshot.reentryControl = {
      connected: true, fresh: true, stale: false, sourceAgeSec: 1, maxAgeSec: 30,
      cooldownState: 'cooldown_required',
      resetPermission: 'allowed',
      reentryPermission: 'allowed',
      continuationPermission: 'allowed',
    }
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: {
        PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1',
        PAPER_AUTO_CONTINUITY_REENTRY_CONTROL_ENABLED: '1',
      },
      getLifecycleFile: () => f,
      getScanSnapshot: async () => snapshot,
      now: () => n,
      accountCredentialResolver: async () => {
        resolverCalls += 1
        return readyCredentials()
      },
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'REENTRY_COOLDOWN_NOT_CLEAR')
    assert.equal(out.lastReentryControl?.allowed, false)
    assert.equal(out.lastReentryControl?.status, 'REENTRY_COOLDOWN_NOT_CLEAR')
    assert.equal(resolverCalls, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: f }).load().state, 'CANDIDATE_SELECTED')
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('Module 6 re-entry control allows fresh fully allowed governance', async () => {
  const d = tmp()
  try {
    const f = path.join(d, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: f }).create({ selectedSymbol: 'M6ALLOW' })
    const n = Date.now()
    let resolverCalls = 0
    const snapshot = freshCandidateSnapshot('M6ALLOW', n)
    snapshot.reentryControl = {
      connected: true, fresh: true, stale: false, sourceAgeSec: 1, maxAgeSec: 30,
      cooldownState: 'cooldown_clear',
      resetPermission: 'allowed',
      reentryPermission: 'allowed',
      continuationPermission: 'allowed',
    }
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: {
        PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1',
        PAPER_AUTO_CONTINUITY_REENTRY_CONTROL_ENABLED: '1',
      },
      getLifecycleFile: () => f,
      getScanSnapshot: async () => snapshot,
      now: () => n,
      accountCredentialResolver: async () => {
        resolverCalls += 1
        return { readyForReadonlyBrokerRead: false, env: {} }
      },
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'PAPER_CREDENTIALS_NOT_READY')
    assert.equal(out.lastReentryControl?.allowed, true)
    assert.equal(out.lastReentryControl?.status, 'REENTRY_ALLOWED')
    assert.equal(resolverCalls, 1)
    assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: f }).load().state, 'CANDIDATE_SELECTED')
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('Module 7 portfolio capital governor evaluates enabled ENTER growth before submission', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'ABC' })
    const now = Date.now()
    let submitCalls = 0
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: {
        PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1',
        PAPER_AUTO_PORTFOLIO_CAPITAL_GOVERNOR_ENABLED: '1',
      },
      getLifecycleFile: () => file,
      getPremarketBaseline: async () => currentBaseline(),
      getScanSnapshot: async () => freshCandidateSnapshot('ABC', now, 101),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true,
        status: 'connected_readonly',
        observedAt: new Date(now).toISOString(),
        account: {
          accountIdentity: PAPER_ACCOUNT_IDENTITY,
          tradingBlocked: false,
          accountBlocked: false,
          equity: 10000,
          buyingPower: 50000,
        },
        positions: [],
        openOrders: [],
      }),
      createAdapter: () => ({ submitPaperOrder: async () => ({ ok: true }) }),
      submitOrder: async () => {
        submitCalls += 1
        return { ok: true, status: 'TEST_SUBMIT_STUB' }
      },
    })
    const out = await runner.runOnce()
    assert.equal(out.lastPortfolioCapitalGovernor?.allowed, true)
    assert.equal(out.lastPortfolioCapitalGovernor?.status, 'PORTFOLIO_CAPITAL_GOVERNOR_ALLOWED')
    assert.equal(out.lastPortfolioCapitalGovernor?.maxSinglePositionPercent, 10)
    assert.ok(out.lastPortfolioCapitalGovernor?.resultingSymbolExposurePercent <= 10)
    assert.equal(submitCalls, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})


test('Module 9 ENTER rejects stale open authoritative market clock before submission', async () => {
  const d=tmp()
  try{
    const f=path.join(d,'life.json')
    new PaperAutoExecutionLifecycleStore({filePath:f}).create({selectedSymbol:'M9STALE'})
    const n=Date.now()
    let submits=0
    const r=createPaperAutoExecutionContinuityEnterRunner({
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>f,
      getPremarketBaseline:async()=>currentBaseline(),
      getScanSnapshot:async()=>freshCandidateSnapshot('M9STALE',n),
      now:()=>n,
      accountCredentialResolver:readyCredentials,
      fetchClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(n-30001).toISOString()}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(n).toISOString(),account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:[],openOrders:[]}),
      createAdapter:()=>({submitPaperOrder:async()=>{submits++}}),
    })
    const out=await r.runOnce()
    assert.equal(out.lastStatus,'PAPER_MARKET_CLOCK_STALE')
    assert.equal(out.submissions,0)
    assert.equal(submits,0)
  }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('Module 9 ENTER rechecks market open immediately before submission', async () => {
  const d=tmp()
  try{
    const f=path.join(d,'life.json')
    new PaperAutoExecutionLifecycleStore({filePath:f}).create({selectedSymbol:'M9CLOSE'})
    const n=Date.now()
    let clocks=0,submits=0
    const r=createPaperAutoExecutionContinuityEnterRunner({
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>f,
      getPremarketBaseline:async()=>currentBaseline(),
      getScanSnapshot:async()=>freshCandidateSnapshot('M9CLOSE',n),
      now:()=>n,
      accountCredentialResolver:readyCredentials,
      fetchClock:async()=>{clocks++;return{ok:true,status:'connected_readonly',marketClock:{isOpen:clocks===1,timestamp:new Date(n).toISOString()}}},
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(n).toISOString(),account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:[],openOrders:[]}),
      createAdapter:()=>({submitPaperOrder:async()=>{submits++}}),
    })
    const out=await r.runOnce()
    assert.equal(out.lastStatus,'PRE_SUBMIT_MARKET_OPEN_REQUIRED')
    assert.equal(clocks,2)
    assert.equal(out.submissions,0)
    assert.equal(submits,0)
  }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('Module 8 ENTER records market clock transport failure but not a healthy closed market', async () => {
  const d = tmp()
  try {
    const file = path.join(d, 'life.json')
    new PaperAutoExecutionLifecycleStore({ filePath: file }).create({ selectedSymbol: 'M8CLOCK' })
    const now = Date.now()
    const failures = []
    const mode = {
      evaluateAction: () => ({ allowed:true, status:'BROKER_MODE_NORMAL' }),
      recordFailure: e => { failures.push(e); return {} },
      recordSuccess: () => ({}),
      diagnostics: () => ({ enabled:true }),
    }
    const common = {
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      getPremarketBaseline:async()=>currentBaseline(),
      getScanSnapshot:async()=>freshCandidateSnapshot('M8CLOCK',now),
      now:()=>now,
      accountCredentialResolver:readyCredentials,
      degradedBrokerMode:mode,
      fetchAccount:async()=>({
        ok:true,status:'connected_readonly',observedAt:new Date(now).toISOString(),
        account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},
        positions:[],openOrders:[],
      }),
    }
    let runner=createPaperAutoExecutionContinuityEnterRunner({
      ...common,
      fetchClock:async()=>({ok:false,status:'clock_fetch_failed',marketClock:{isOpen:false}}),
    })
    let out=await runner.runOnce()
    assert.equal(out.lastStatus,'MARKET_OPEN_REQUIRED')
    assert.equal(failures.at(-1)?.kind,'MARKET_CLOCK_READ_FAILED')
    failures.length=0
    runner=createPaperAutoExecutionContinuityEnterRunner({
      ...common,
      fetchClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:false}}),
    })
    out=await runner.runOnce()
    assert.equal(out.lastStatus,'MARKET_OPEN_REQUIRED')
    assert.equal(failures.length,0)
  } finally { fs.rmSync(d,{recursive:true,force:true}) }
})
test('Module 8 ENTER records broker account blocked before submission', async () => {
  const d=tmp()
  try {
    const file=path.join(d,'life.json')
    new PaperAutoExecutionLifecycleStore({filePath:file}).create({selectedSymbol:'M8BLOCK'})
    const now=Date.now()
    const failures=[]
    let submitted=0
    const runner=createPaperAutoExecutionContinuityEnterRunner({
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      getPremarketBaseline:async()=>currentBaseline(),
      getScanSnapshot:async()=>freshCandidateSnapshot('M8BLOCK',now),
      now:()=>now,
      accountCredentialResolver:readyCredentials,
      fetchClock:clockOpen,
      fetchAccount:async()=>({
        ok:true,status:'connected_readonly',observedAt:new Date(now).toISOString(),
        account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:true,accountBlocked:false,equity:1000,buyingPower:1000},
        positions:[],openOrders:[],
      }),
      createAdapter:()=>({submitPaperOrder:async()=>{submitted+=1}}),
      degradedBrokerMode:{
        evaluateAction:()=>({allowed:true,status:'BROKER_MODE_NORMAL'}),
        recordFailure:e=>{failures.push(e);return{}},
        recordSuccess:()=>({}),
        diagnostics:()=>({enabled:true}),
      },
    })
    const out=await runner.runOnce()
    assert.equal(out.lastStatus,'PAPER_ACCOUNT_BLOCKED')
    assert.equal(failures.at(-1)?.kind,'BROKER_ACCOUNT_BLOCKED')
    assert.equal(submitted, 0)
    assert.equal(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED')
  } finally { fs.rmSync(d,{recursive:true,force:true}) }
})
test('Module 8 ENTER submission ambiguity records immediate degraded failure and still reconciles', async () => {
  const d=tmp()
  try {
    const file=path.join(d,'life.json')
    const store=new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=> 'm8-enter-life'})
    store.create({selectedSymbol:'M8AMB'})
    const now=Date.now()
    const failures=[]
    let accountReads=0
    const runner=createPaperAutoExecutionContinuityEnterRunner({
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      getPremarketBaseline:async()=>currentBaseline(),
      getScanSnapshot:async()=>freshCandidateSnapshot('M8AMB',now),
      now:()=>now,
      accountCredentialResolver:readyCredentials,
      fetchClock:clockOpen,
      fetchAccount:async()=>{
        accountReads+=1
        return {
          ok:true,status:'connected_readonly',mode:'PAPER_ONLY',observedAt:new Date(now).toISOString(),
          account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},
          positions:[],openOrders:[],
        }
      },
      fetchHistoricalOrders:async()=>({historicalOrders:[]}),
      submitOrder:async({lifecycleStore})=>{
        lifecycleStore.transition('ENTER_SUBMITTING',{enterClientOrderId:'m8-client'})
        const next=lifecycleStore.transition('ENTER_UNKNOWN')
        return {ok:true,status:'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED',blockers:['ambiguous_submission_requires_reconciliation'],lifecycle:next}
      },
      degradedBrokerMode:{
        evaluateAction:()=>({allowed:true,status:'BROKER_MODE_NORMAL'}),
        recordFailure:e=>{failures.push(e);return{}},
        recordSuccess:()=>({}),
        diagnostics:()=>({enabled:true}),
      },
    })
    const out=await runner.runOnce()
    assert.equal(failures.some(x=>x.kind==='AMBIGUOUS_SUBMISSION'),true)
    assert.ok(accountReads>=2)
    assert.ok(out.reconciliations>=1)
    assert.notEqual(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED')
  } finally { fs.rmSync(d,{recursive:true,force:true}) }
})
// Module 8 ENTER broker failure recording coverage


test('diagnostics expose ENTER runner cycle heartbeat timestamps',async()=>{
  const nowMs=Date.parse('2026-08-19T22:10:00.000Z')
  const runner=createPaperAutoExecutionContinuityEnterRunner({
    env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'0'},
    now:()=>nowMs
  })
  const out=await runner.runOnce()
  const d=runner.diagnostics()
  assert.equal(out.lastCycleStartedAt,'2026-08-19T22:10:00.000Z')
  assert.equal(out.lastCycleCompletedAt,null)
  assert.equal(d.lastCycleStartedAt,'2026-08-19T22:10:00.000Z')
  assert.equal(d.lastCycleCompletedAt,'2026-08-19T22:10:00.000Z')
})

test('Module 13 ENTER records gate submission reconciliation evidence with stable correlation', async () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'life.json')
    const store = new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => 'life-m13-evidence' })
    const now = Date.now()
    store.create({selectedSymbol:'EV13',scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',observedAt:new Date(now).toISOString(),originScanId:'scan-m13-evidence',symbol:'EV13',state:'ENTER',score:99,paperOnly:true}})
    let submitted=0
    const writes=[]
    const runner=createPaperAutoExecutionContinuityEnterRunner({
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      getPremarketBaseline:async()=>currentBaseline(),
      getScanSnapshot:async()=>freshCandidateSnapshot('EV13',now,10),
      now:()=>now,
      accountCredentialResolver:readyCredentials,
      fetchClock:clockOpen,
      fetchAccount:async()=>({ok:true,status:'connected_readonly',mode:'PAPER_ONLY',observedAt:new Date(now).toISOString(),runtime:{readOnly:true,allowedMethods:['GET']},account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:submitted?[{symbol:'EV13',qty:10,averageEntryPrice:10}]:[],openOrders:[]}),
      fetchHistoricalOrders:async()=>({historicalOrders:submitted?[{id:'order-m13-evidence',client_order_id:store.load()?.enterClientOrderId,symbol:'EV13',side:'buy',status:'filled',filled_qty:'10',filled_avg_price:'10'}]:[]}),
      createAdapter:()=>({submitPaperOrder:async order=>{submitted+=1;return{ok:true,orderSubmitted:true,brokerOrderId:'order-m13-evidence',orderId:'order-m13-evidence',clientOrderId:order.clientOrderId}}}),
      appendEntryValidation:input=>{writes.push(input);return{record:input}},
    })
    const out=await runner.runOnce()
    assert.equal(out.lastStatus,'CONTINUITY_ENTER_MONITORING_CONFIRMED')
    assert.equal(submitted,1)
    const gate=writes.find(x=>x.eventType==='gate_snapshot')
    const submission=writes.find(x=>x.eventType==='submission')
    const reconciliation=writes.find(x=>x.eventType==='reconciliation')
    assert.ok(gate); assert.ok(submission); assert.ok(reconciliation)
    assert.equal(gate.correlationId,submission.correlationId)
    assert.equal(gate.correlationId,reconciliation.correlationId)
    assert.equal(gate.gateSnapshot.marketOpen,true)
    assert.equal(gate.gateSnapshot.accountFresh,true)
    assert.equal(gate.gateSnapshot.allocationPercent,10)
    assert.equal(gate.gateSnapshot.quantity,10)
    assert.equal(gate.gateSnapshot.wholeSharesOnly,true)
    assert.equal(gate.gateSnapshot.hardCapVerified,true)
    assert.equal(gate.gateSnapshot.capitalProtectionAllowed,null)
    assert.equal(submission.submission.requestedQuantity,10)
    assert.equal(submission.submission.brokerOrderId,'order-m13-evidence')
    assert.equal(reconciliation.fill.filledQuantity,10)
    assert.equal(reconciliation.fill.averageFillPrice,10)
    assert.equal(reconciliation.fill.brokerPositionIdentity,'EV13:10')
    assert.equal(reconciliation.validationStatus,'ENTRY_COMPLETED')
    assert.equal(out.entryValidationWriteFailures,0)
    assert.equal(out.safety.entryValidationObservationalOnly,true)
    assert.equal(out.safety.entryValidationFailureBlocksExecution,false)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('Module 13 ENTER evidence write failure stays fail-open and cannot change authorized PAPER execution result', async () => {
  const dir=tmp()
  try {
    const file=path.join(dir,'life.json')
    const store=new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=> 'life-m13-failopen'})
    const now=Date.now()
    store.create({selectedSymbol:'FO13',scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',observedAt:new Date(now).toISOString(),originScanId:'scan-m13-failopen',symbol:'FO13',state:'ENTER',score:99,paperOnly:true}})
    let submitted=0
    const runner=createPaperAutoExecutionContinuityEnterRunner({
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      getPremarketBaseline:async()=>currentBaseline(),
      getScanSnapshot:async()=>freshCandidateSnapshot('FO13',now,10),
      now:()=>now,
      accountCredentialResolver:readyCredentials,
      fetchClock:clockOpen,
      fetchAccount:async()=>({ok:true,status:'connected_readonly',mode:'PAPER_ONLY',observedAt:new Date(now).toISOString(),runtime:{readOnly:true,allowedMethods:['GET']},account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:submitted?[{symbol:'FO13',qty:10,averageEntryPrice:10}]:[],openOrders:[]}),
      fetchHistoricalOrders:async()=>({historicalOrders:submitted?[{id:'order-m13-failopen',client_order_id:store.load()?.enterClientOrderId,symbol:'FO13',side:'buy',status:'filled',filled_qty:'10',filled_avg_price:'10'}]:[]}),
      createAdapter:()=>({submitPaperOrder:async order=>{submitted+=1;return{ok:true,orderSubmitted:true,brokerOrderId:'order-m13-failopen',orderId:'order-m13-failopen',clientOrderId:order.clientOrderId}}}),
      appendEntryValidation:()=>{throw new Error('forced_enter_evidence_write_failure')},
    })
    const out=await runner.runOnce()
    assert.equal(out.lastStatus,'CONTINUITY_ENTER_MONITORING_CONFIRMED')
    assert.equal(out.lastLifecycle.state,'MONITORING')
    assert.equal(submitted,1)
    assert.equal(out.entryValidationWriteFailures>=3,true)
    assert.equal(out.lastEntryValidationError,'forced_enter_evidence_write_failure')
    assert.equal(out.safety.entryValidationFailureBlocksExecution,false)
    assert.equal(out.safety.liveTradingAllowed,false)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})


test('Module 13 ENTER blocker evidence records fail-closed reasons without submission authority', async () => {
  const cases = [
    {
      name:'stale candidate',
      expected:'FRESH_CANDIDATE_REQUIRED',
      configure:({now,file,writes})=>({
        env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},getLifecycleFile:()=>file,now:()=>now,
        getScanSnapshot:async()=>freshCandidateSnapshot('BLK13',now-31000,10),
        appendEntryValidation:input=>{writes.push(input);return{record:input}},
      }),
    },
    {
      name:'closed market',
      expected:'MARKET_OPEN_REQUIRED',
      configure:({now,file,writes})=>({
        env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},getLifecycleFile:()=>file,now:()=>now,
        getScanSnapshot:async()=>freshCandidateSnapshot('BLK13',now,10),getPremarketBaseline:async()=>currentBaseline(),
        accountCredentialResolver:readyCredentials,
        fetchClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:false,timestamp:new Date(now).toISOString()}}),
        fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(now).toISOString(),account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:[],openOrders:[]}),
        appendEntryValidation:input=>{writes.push(input);return{record:input}},
      }),
    },
    {
      name:'stale account',
      expected:'PAPER_ACCOUNT_SNAPSHOT_STALE',
      configure:({now,file,writes})=>({
        env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},getLifecycleFile:()=>file,now:()=>now,
        getScanSnapshot:async()=>freshCandidateSnapshot('BLK13',now,10),getPremarketBaseline:async()=>currentBaseline(),
        accountCredentialResolver:readyCredentials,fetchClock:clockOpen,
        fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(now-31000).toISOString(),account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:[],openOrders:[]}),
        appendEntryValidation:input=>{writes.push(input);return{record:input}},
      }),
    },
    {
      name:'degraded broker',
      expected:'DEGRADED_BROKER_ENTER_BLOCKED',
      configure:({now,file,writes})=>({
        env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},getLifecycleFile:()=>file,now:()=>now,
        getScanSnapshot:async()=>freshCandidateSnapshot('BLK13',now,10),
        degradedBrokerMode:{evaluateAction:()=>({allowed:false,status:'DEGRADED_BROKER_ENTER_BLOCKED'}),diagnostics:()=>({degraded:true})},
        appendEntryValidation:input=>{writes.push(input);return{record:input}},
      }),
    },
  ]
  for (const c of cases) {
    const dir=tmp()
    try {
      const file=path.join(dir,'life.json')
      const now=Date.now()
      new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=>`life-${c.name.replaceAll(' ','-')}`}).create({
        selectedSymbol:'BLK13',
        scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',observedAt:new Date(now).toISOString(),originScanId:`scan-${c.name}`,symbol:'BLK13',state:'ENTER',score:90,paperOnly:true},
      })
      const writes=[]
      const runner=createPaperAutoExecutionContinuityEnterRunner(c.configure({now,file,writes}))
      const out=await runner.runOnce()
      assert.equal(out.lastStatus,c.expected,c.name)
      assert.equal(out.submissions,0,c.name)
      const failure=writes.find(x=>x.eventType==='validation_error'&&x.blocker===c.expected)
      assert.ok(failure,c.name)
      assert.equal(failure.validationStatus,'WAITING_FOR_ELIGIBLE_ENTRY',c.name)
      assert.equal(failure.gateSnapshot.authorized,false,c.name)
      assert.equal(out.safety.entryValidationFailureBlocksExecution,false,c.name)
      assert.equal(out.safety.liveTradingAllowed,false,c.name)
    } finally { fs.rmSync(dir,{recursive:true,force:true}) }
  }
})


test('Module 13 ordinary safety blockers do not surface as FAILED_NEEDS_REVIEW', async () => {
  const dir=tmp()
  try {
    const file=path.join(dir,'life.json')
    const now=Date.now()
    new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=>`life-waiting`}).create({
      selectedSymbol:'WAIT13',
      scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',observedAt:new Date(now).toISOString(),originScanId:'scan-waiting',symbol:'WAIT13',state:'ENTER',score:90,paperOnly:true},
    })
    const writes=[]
    const runner=createPaperAutoExecutionContinuityEnterRunner({
      env:{PAPER_AUTO_CONTINUITY_ENTER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      now:()=>now,
      getScanSnapshot:async()=>freshCandidateSnapshot('WAIT13',now,10),
      getPremarketBaseline:async()=>currentBaseline(),
      accountCredentialResolver:readyCredentials,
      fetchClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:false,timestamp:new Date(now).toISOString()}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(now).toISOString(),account:{accountIdentity:PAPER_ACCOUNT_IDENTITY,tradingBlocked:false,accountBlocked:false,equity:1000,buyingPower:1000},positions:[],openOrders:[]}),
      appendEntryValidation:input=>{writes.push(input);return{record:input}},
    })
    const out=await runner.runOnce()
    assert.equal(out.lastStatus,'MARKET_OPEN_REQUIRED')
    const failure=writes.find(x=>x.eventType==='validation_error'&&x.blocker==='MARKET_OPEN_REQUIRED')
    assert.ok(failure)
    assert.equal(failure.validationStatus,'WAITING_FOR_ELIGIBLE_ENTRY')
    assert.equal(failure.gateSnapshot.authorized,false)
    assert.equal(out.submissions,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})
