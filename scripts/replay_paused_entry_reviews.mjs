import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { priceReviewedEntry } from '../src/scanner/paused_entry_review_store.mjs'
import { calculateAutomaticPositionSize } from '../src/scanner/automatic_position_sizing_policy.mjs'
import { fetchCustomerOwnedPositionMonitorSource } from '../src/scanner/customer_owned_position_monitor_source.mjs'
import { buildAuthoritativePaperExitDecision } from '../src/scanner/paper_auto_execution_exit_decision.mjs'
import { HARD_LOSS_EXIT_REASON, SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS } from '../src/scanner/paper_auto_execution_same_symbol_hard_loss_cooldown.mjs'

// Replay only. All prices and market inputs are taken from the recorder.
export function createPausedReplay({ initialCash, estimatedFeePerSide }) {
  if (!Number.isFinite(initialCash) || initialCash <= 0 || !Number.isFinite(estimatedFeePerSide) || estimatedFeePerSide < 0) throw Error('positive initial cash and explicit nonnegative fee estimate required')
  let cash = initialCash, fees = 0, fills = 0, closed = 0, gaps = 0, scanCount = 0, approved = 0
  let lastTick = null, lastEvent = -Infinity
  const positions = new Map(), attempted = new Set(), cooldown = new Map()
  const equity = () => cash + [...positions.values()].reduce((value, p) => value + p.qty * p.mark, 0)
  function enter(d, at) {
    if (!d.wouldSubmit || d.status !== 'PAUSED_ENTRY_WOULD_SUBMIT' || attempted.has(d.lifecycleId)) return
    if (!d.lifecycleId || !d.symbol || !Number.isSafeInteger(d.quantity) || d.quantity < 1) { gaps++; return }
    attempted.add(d.lifecycleId); approved++
    if (positions.has(d.symbol) || at < (cooldown.get(d.symbol) ?? 0)) return
    const q = priceReviewedEntry(d.quote, d.decisionAt)
    if (!q || d.evidence?.strategyAuthorization?.authorized !== true) { gaps++; return }
    const size = calculateAutomaticPositionSize({accountEquity: equity(), buyingPower: cash - estimatedFeePerSide, candidatePrice: q.ask, candidateScore: d.evidence.score})
    if (!size.ok) return
    const qty = Math.min(d.quantity, size.quantity)
    if (qty*q.ask + estimatedFeePerSide > cash) return
    cash -= qty*q.ask + estimatedFeePerSide; fees += estimatedFeePerSide; fills++
    positions.set(d.symbol, {symbol: d.symbol, qty, averageEntryPrice: q.ask, mark: q.bid, id: d.lifecycleId, pendingExit: null})
  }
  async function mark(m, at) {
    if (m?.scaleRunnerEnabled !== false) throw Error('replay requires recorded scale runner disabled')
    if (m.marketClock?.isOpen !== true || !Array.isArray(m.candidates)) throw Error('missing open market scan')
    if (positions.size && lastTick !== null && new Date(lastTick).toISOString().slice(0,10) === m.capturedAt.slice(0,10) && at-lastTick > 60000) gaps++
    lastTick = at; scanCount++
    if (!positions.size) return
    const market = new Map(m.candidates.map(c => [c.symbol,c]))
    const quotes = new Map()
    for (const p of positions.values()) {
      const q = priceReviewedEntry(market.get(p.symbol)?.observedQuote, m.capturedAt)
      if (q) { p.mark=q.bid; quotes.set(p.symbol,q) } else { gaps++ }
    }
    const owned = await fetchCustomerOwnedPositionMonitorSource({
      paperAccount: {account: {equity: equity(), buyingPower: cash}, positions: [...positions.values()].map(p=>({symbol:p.symbol,qty:p.qty,averageEntryPrice:p.averageEntryPrice}))},
      capitalProtectionRoot: m.capital, nowMs: at,
      fetchSymbols: async ({symbols}) => ({ok:true,candidates:symbols.map(s=>market.get(s)).filter(Boolean)}),
    })
    for (const c of owned.candidates) {
      const p = positions.get(c.symbol), q = quotes.get(c.symbol)
      if (c.sourceCoverage !== 'owned_position_symbol_fetch' || c.sourceStale !== false) { if (q) gaps++; continue }
      const life = {lifecycleId:p.id,selectedSymbol:p.symbol,state:'MONITORING',filledQuantity:p.qty,brokerPositionIdentity:p.symbol+':'+p.qty,paperOnly:true}
      const decision = buildAuthoritativePaperExitDecision({lifecycle:life,brokerPosition:{symbol:p.symbol,qty:p.qty},candidate:c,observedAt:m.capturedAt})
      if (decision.exitRequired) p.pendingExit ??= decision.reasonCodes[0]
      if (!p.pendingExit) continue
      if (!q) continue
      cash += p.qty*q.bid-estimatedFeePerSide; fees += estimatedFeePerSide; fills++; closed++
      if (p.pendingExit === HARD_LOSS_EXIT_REASON) cooldown.set(p.symbol,at+SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS)
      positions.delete(p.symbol)
    }
  }
  async function session(records) {
    const events=[]
    for (const r of records) {
      if (r.version!==1 || r.orderSubmitted!==false || !r.market || !Array.isArray(r.decisions)) throw Error('invalid review record')
      events.push({at:Date.parse(r.market.capturedAt),market:r.market})
      for (const d of r.decisions) events.push({at:Date.parse(d.decisionAt),decision:d})
    }
    events.sort((a,b)=>a.at-b.at || Number(!!b.market)-Number(!!a.market))
    for (const e of events) {
      if (!Number.isFinite(e.at) || e.at<lastEvent) throw Error('invalid event order')
      lastEvent=e.at
      if (e.market) await mark(e.market,e.at); else enter(e.decision,e.at)
    }
  }
  const summary = () => ({scanCount,approvedLifecycles:approved,fills,completedRoundTrips:closed,openPositions:positions.size,coverageGaps:gaps,initialCash,cash,estimatedFeePerSide,estimatedFees:fees,estimatedNetVersusCash:closed && !gaps && !positions.size ? cash-initialCash:null})
  return {session, summary}
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [directory, capital, fee] = process.argv.slice(2)
  if (!directory || !capital || !fee) throw Error('usage: node scripts/replay_paused_entry_reviews.mjs DIRECTORY INITIAL_CASH ESTIMATED_FEE_PER_SIDE')
  const replay = createPausedReplay({ initialCash:Number(capital), estimatedFeePerSide:Number(fee) })
  const days=(await fs.readdir(directory)).filter(d=>/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)).sort()
  for (const day of days) {
    const folder=path.join(directory,day), records=[]
    for (const file of (await fs.readdir(folder)).filter(f=>/^[0-9]+[.]json$/.test(f)).sort()) records.push(JSON.parse(await fs.readFile(path.join(folder,file),'utf8')))
    await replay.session(records)
  }
  console.log(JSON.stringify(replay.summary()))
}
