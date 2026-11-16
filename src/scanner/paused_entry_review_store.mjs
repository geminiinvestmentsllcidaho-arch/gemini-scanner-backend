import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const freshnessMs = 30000
const quoteFreshnessMs = 15000

// Only display an indicative fill when the exact quote has its own timestamp.
export function priceReviewedEntry(quote, decisionAt) {
  const ageMs = Date.parse(decisionAt) - Date.parse(quote?.at)
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > quoteFreshnessMs) return null
  const bid = quote?.bid
  const ask = quote?.ask
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid || !quote.feed) return null
  return { bid, ask, at: quote.at, feed: quote.feed, ageMs }
}

// Preserve the market inputs used by the existing exit and scale policies so a
// later replay can distinguish missing coverage from an observed hold.
export function captureReviewMarket(source, rankings, scaleRunnerEnabled = null) {
  const select = (object, fields) => Object.fromEntries(fields.map(field => [field, object?.[field] ?? null]))
  const capital = select(rankings, ['sourceTs', 'sourceAgeSec', 'maxAgeSec', 'stale', 'invalidationState',
    'drawdownBrakeState', 'exitRouteState', 'routeUrgency', 'protectionCommandState', 'protectionPermission'])
  const candidates = (source?.candidates ?? []).map(candidate => select(candidate, ['symbol', 'price',
    'observedQuote', 'decision', 'changePct', 'readonlyPotentialScore', 'readonlyPotentialFlags',
    'sourceTs', 'sourceAgeSec', 'maxSourceAgeSec', 'sourceStale']))
  return { capturedAt: new Date().toISOString(), scaleRunnerEnabled, marketClock: select(source?.marketClock, ['timestamp', 'isOpen']), capital, candidates }
}

// One complete record per scan. A hard link publishes it once, even after a
// restart or an overlapping worker. An interrupted write never becomes evidence.
export function recordPausedEntryReviews({ getPortfolio, review, directory = 'runs/paused_entry_reviews', now = Date.now }) {
  let active = false
  let lastScan = null
  return async function record(observedAt, captureMarket = () => null, getScanSnapshot) {
    const stamp = Date.parse(observedAt)
    const age = now() - stamp
    if (active || observedAt === lastScan || !Number.isFinite(age) || age < 0 || age > freshnessMs) return
    active = true
    let temporary = null
    try {
      const day = new Date(stamp).toISOString().slice(0, 10)
      const folder = path.join(directory, day)
      const file = path.join(folder, String(stamp) + '.json')
      try {
        await fs.access(file)
        lastScan = observedAt
        return
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      const market = captureMarket()
      const portfolio = await getPortfolio()
      if (!Array.isArray(portfolio?.rows)) throw new Error('paused_review_portfolio_unavailable')
      const decisions = []
      for (const row of portfolio.rows.filter(row => row.state === 'CANDIDATE_SELECTED')) {
        const decision = await review(row.file, getScanSnapshot)
        const quote = priceReviewedEntry(decision.quote, decision.decisionAt)
        decisions.push({
          lifecycleId: row.lifecycleId, symbol: row.symbol, status: decision.status,
          decisionAt: decision.decisionAt, wouldSubmit: decision.wouldSubmit, quantity: decision.quantity,
          evidence: decision.evidence, quote, indicativeEntryAsk: decision.wouldSubmit && quote ? quote.ask : null,
        })
      }
      await fs.mkdir(folder, { recursive: true, mode: 0o700 })
      temporary = path.join(folder, '.' + randomUUID() + '.tmp')
      await fs.writeFile(temporary, JSON.stringify({ version: 1, observedAt, market, decisions, orderSubmitted: false }) + '\n', { flag: 'wx', mode: 0o600 })
      try { await fs.link(temporary, file) } catch (error) { if (error.code !== 'EEXIST') throw error }
      lastScan = observedAt
    } finally {
      active = false
      if (temporary) await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
    }
  }
}
