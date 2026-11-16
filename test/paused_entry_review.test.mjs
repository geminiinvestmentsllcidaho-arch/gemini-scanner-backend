import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { reviewPausedPaperEntry } from '../src/scanner/paper_auto_execution_continuity_enter_runner.mjs'
import { captureReviewMarket, recordPausedEntryReviews, priceReviewedEntry } from '../src/scanner/paused_entry_review_store.mjs'

const at = '2026-11-13T16:00:00.000Z'
const now = () => Date.parse(at)
const quote = { bid: 2.99, ask: 3.01, at, feed: 'sip' }
const unexpected = () => { throw Error('unexpected operation') }

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-shadow-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'life.json')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: file, clock: now })
  const life = store.create({ selectedSymbol: 'TEST' })
  const row = { file, lifecycleId: life.lifecycleId, symbol: life.selectedSymbol, state: life.state }
  const getPortfolio = async () => ({ rows: [row] })
  const options = {
    env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '0', PAPER_AUTO_EXIT_MONITOR_ENABLED: '1' },
    getScanSnapshot: () => ({ observedAt: at, candidates: [{
      symbol: 'TEST', state: 'ENTER', price: 3, score: 99, buyRecommendation: true, blocked: false, blockers: [],
      observedQuote: quote, rankingConnected: true, rankingP3GateOk: true, rankingSetupScore: 90, rankingQuality: 0.9, rankingConfidence: 0.8,
    }] }),
    now, getLifecyclePortfolio: getPortfolio, getPortfolioWindDownState: () => ({ resolved: true, active: false }),
    getPremarketBaseline: () => ({ ok: true, paperOnly: true, readOnly: true, sessionDate: '2026-11-13', accountIdentity: 'account' }),
    fetchClock: () => ({ ok: true, status: 'connected_readonly', marketClock: { isOpen: true, timestamp: at } }),
    fetchAccount: () => ({ ok: true, status: 'connected_readonly', observedAt: at, account: { accountIdentity: 'account', equity: 873.78, buyingPower: 873.78 }, positions: [], openOrders: [] }),
    accountCredentialResolver: () => ({ readyForReadonlyBrokerRead: true, env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets' } }),
    createAdapter: unexpected, submitOrder: unexpected, reconcile: unexpected, fetchHistoricalOrders: unexpected, executionNotifier: unexpected,
    degradedBrokerMode: { evaluateAction: () => ({ allowed: true }), recordFailure: unexpected },
  }
  return { options, file, store, directory, row, getPortfolio }
}

test('review reaches the same final sizing gate without writing the lifecycle or a submission', async t => {
  const { options, file, directory } = setup(t)
  const before = fs.readFileSync(file, 'utf8')
  const result = await reviewPausedPaperEntry(options, file)
  assert.equal(result.status, 'PAUSED_ENTRY_WOULD_SUBMIT')
  assert.equal(result.wouldSubmit, true)
  assert.ok(Number.isSafeInteger(result.quantity) && result.quantity > 0)
  assert.equal(result.decisionAt, at)
  assert.deepEqual(result.quote, quote)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
  assert.deepEqual(fs.readdirSync(directory), ['life.json'])
})

test('second account read, reentry cooldown, conflicts, and entry enablement still block observations', async t => {
  const { options, file } = setup(t)
  let reads = 0
  const account = options.fetchAccount()
  const scenarios = [
    [{ fetchAccount: () => ++reads === 1 ? account : { ...account, openOrders: [{ side: 'buy', symbol: 'TEST' }] } }, 'PRE_SUBMIT_CONFLICTING_OPEN_ORDER'],
    [{ evaluateSameSymbolHardLossCooldown: () => ({ allowed: false, status: 'COOLDOWN' }) }, 'COOLDOWN'],
    [{ capitalGrowthCoordinator: { run: () => ({ allowed: false, status: 'CAPITAL_GROWTH_CONFLICT_UNRESOLVED' }) } }, 'CAPITAL_GROWTH_CONFLICT_UNRESOLVED'],
    [{ env: { PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' }, fetchClock: unexpected }, 'EXPLICIT_ENTRY_PAUSE_REQUIRED'],
    [{ getPremarketBaseline: () => null }, 'PREMARKET_CAPITAL_BASELINE_REQUIRED'],
  ]
  for (const [overrides, status] of scenarios) {
    const result = await reviewPausedPaperEntry({ ...options, ...overrides }, file)
    assert.equal(result.status, status)
    assert.equal(result.wouldSubmit, false)
    assert.equal(result.quantity, null)
  }
})

test('reconciliation states cannot enter the observer, and broker errors leave shared health untouched', async t => {
  const { options, file, store } = setup(t)
  const error = await reviewPausedPaperEntry({ ...options, fetchClock: () => ({ ok: false, status: 'clock_fetch_failed' }) }, file)
  assert.equal(error.status, 'MARKET_OPEN_REQUIRED')
  store.transition('ENTER_SUBMITTING', { enterClientOrderId: 'x' })
  store.transition('ENTER_OPEN', { enterBrokerOrderId: 'y' })
  const before = fs.readFileSync(file, 'utf8')
  assert.equal((await reviewPausedPaperEntry(options, file)).status, 'SELECTED_CANDIDATE_REQUIRED')
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('quote age and crossed markets never produce simulated prices', () => {
  assert.equal(priceReviewedEntry(quote, at).ask, quote.ask)
  for (const changes of [{ at: '2026-11-13T15:59:44Z' }, { at: '2026-11-13T16:00:01Z' }, { at: null }, { bid: 3.02 }, { ask: 0 }, { feed: null }]) {
    assert.equal(priceReviewedEntry({ ...quote, ...changes }, at), null)
  }
})

test('publishes private complete scans once, including empty scans, and retries failed observations', async t => {
  const { options, file, directory, getPortfolio } = setup(t)
  let calls = 0
  const config = { now, directory: path.join(directory, 'reviews'), getPortfolio, review: async () => {
    if (++calls === 1) throw Error('temporary failure')
    return reviewPausedPaperEntry(options, file)
  } }
  const record = recordPausedEntryReviews(config)
  await assert.rejects(record(at), /temporary failure/)
  await Promise.all([record(at), record(at)])
  await recordPausedEntryReviews(config)(at)
  assert.equal(calls, 2)
  const folder = path.join(config.directory, '2026-11-13')
  const stored = JSON.parse(fs.readFileSync(path.join(folder, now() + '.json')))
  assert.equal(stored.decisions[0].indicativeEntryAsk, 3.01)
  assert.equal(stored.orderSubmitted, false)
  const earlier = '2026-11-13T15:59:59.000Z'
  await recordPausedEntryReviews({ ...config, getPortfolio: () => ({ rows: [] }) })(earlier)
  const empty = JSON.parse(fs.readFileSync(path.join(folder, Date.parse(earlier) + '.json')))
  assert.deepEqual(empty.decisions, [])
  assert.equal(fs.readdirSync(folder).length, 2)
})


test('captures dated quote and exit evidence without copying unrelated data', () => {
  const record = captureReviewMarket({ marketClock: { isOpen: true, timestamp: at }, candidates: [
    { symbol: 'TEST', observedQuote: quote, sourceStale: false, changePct: 1.5, debug: 'private' },
  ] }, { sourceTs: at, stale: false, invalidationState: 'hard_stop', debug: 'private' })
  assert.equal(record.capital.invalidationState, 'hard_stop')
  assert.equal(record.candidates[0].sourceStale, false)
  assert.deepEqual(record.candidates[0].observedQuote, quote)
  assert.equal(record.candidates[0].readonlyPotentialScore, null)
  assert.equal(JSON.stringify(record).includes('private'), false)
})
