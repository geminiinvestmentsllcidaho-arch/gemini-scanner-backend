import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionContinuityEnterRunner } from '../src/scanner/paper_auto_execution_continuity_enter_runner.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-enter-'))
const readyCredentials = async () => ({ readyForReadonlyBrokerRead: true, env: { ALPACA_KEY: 'paper-key', ALPACA_SECRET: 'paper-secret', APCA_API_BASE_URL: 'https://paper-api.alpaca.markets', ALPACA_PAPER_TRADING: 'true' } })
const freshCandidateSnapshot = (symbol, now = Date.now()) => ({ observedAt: new Date(now).toISOString(), candidates: [{ symbol, state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 99 }] })

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
const clockOpen = async () => ({ ok: true, status: 'connected_readonly', marketClock: { isOpen: true } })

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
      getScanSnapshot: async () => freshCandidateSnapshot('FRESH', now),
      now: () => now,
      accountCredentialResolver: async () => { resolverCalls += 1; return readyCredentials() },
      fetchClock: async () => ({ ok: true, status: 'connected_readonly', marketClock: { isOpen: false } }),
      fetchAccount: async () => ({ ok: true, status: 'connected_readonly', observedAt: new Date(now).toISOString(), account: {}, positions: [], openOrders: [] }),
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
    const now = Date.now()
    const runner = createPaperAutoExecutionContinuityEnterRunner({
      env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' },
      getLifecycleFile: () => file,
      getScanSnapshot: async () => freshCandidateSnapshot('ABC', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
        account: { tradingBlocked: false, accountBlocked: false },
        positions: submitted ? [{ symbol: 'ABC', qty: 1, averageEntryPrice: 10 }] : [],
        openOrders: [],
      }),
      fetchHistoricalOrders: async () => ({
        historicalOrders: submitted ? [{ id: 'order-1', client_order_id: store.load()?.enterClientOrderId, symbol: 'ABC', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '10' }] : [],
      }),
      createAdapter: () => ({
        submitPaperOrder: async order => {
          submitted += 1
          assert.equal(order.symbol, 'ABC')
          assert.equal(order.side, 'buy')
          assert.equal(order.paperOnly, true)
          return { ok: true, orderSubmitted: true, brokerOrderId: 'order-1', orderId: 'order-1', clientOrderId: order.clientOrderId }
        },
      }),
    })
    const out = await runner.runOnce()
    assert.equal(submitted, 1)
    assert.equal(out.lastStatus, 'CONTINUITY_ENTER_MONITORING_CONFIRMED')
    assert.equal(out.lastLifecycle.state, 'MONITORING')
    assert.equal(out.lastLifecycle.filledQuantity, 1)
    assert.equal(out.lastLifecycle.brokerPositionIdentity, 'ABC:1')
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
      getScanSnapshot: async () => freshCandidateSnapshot('ACCT', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', observedAt: new Date(now + 1).toISOString(),
        account: { tradingBlocked: false, accountBlocked: false }, positions: [], openOrders: [],
      }),
      createAdapter: () => ({ submitPaperOrder: async () => { submitted += 1 } }),
    })
    const out = await runner.runOnce()
    assert.equal(out.lastStatus, 'PAPER_ACCOUNT_SNAPSHOT_STALE')
    assert.equal(submitted, 0)
    assert.equal(out.submissions, 0)
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
        getScanSnapshot: async () => freshCandidateSnapshot('XYZ', now),
        now: () => now,
        accountCredentialResolver: readyCredentials,
        fetchClock: clockOpen,
        fetchAccount: async () => ({
          ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
          account: { tradingBlocked: false, accountBlocked: false },
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
      getScanSnapshot: async () => freshCandidateSnapshot('NEW', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
        account: { tradingBlocked: false, accountBlocked: false },
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
      getScanSnapshot: async () => freshCandidateSnapshot('ONE', now),
      now: () => now,
      accountCredentialResolver: readyCredentials,
      fetchClock: clockOpen,
      fetchAccount: async () => ({
        ok: true, status: 'connected_readonly', mode: 'PAPER_ONLY', observedAt: new Date(now).toISOString(), runtime: { readOnly: true, allowedMethods: ['GET'] },
        account: { tradingBlocked: false, accountBlocked: false },
        positions: submitted ? [{ symbol: 'ONE', qty: 1, averageEntryPrice: 5 }] : [],
        openOrders: [],
      }),
      fetchHistoricalOrders: async () => ({ historicalOrders: submitted ? [{ id: 'o1', client_order_id: new PaperAutoExecutionLifecycleStore({ filePath: file }).load()?.enterClientOrderId, symbol: 'ONE', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '5' }] : [] }),
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
          account: { tradingBlocked: false, accountBlocked: false },
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
            filled_qty: '1',
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
