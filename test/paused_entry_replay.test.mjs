import test from 'node:test'
import assert from 'node:assert/strict'
import { createPausedReplay } from '../scripts/replay_paused_entry_reviews.mjs'
const start = Date.parse('2026-11-13T17:00:00Z')
const iso = delta => new Date(start + delta).toISOString()
const quote = (bid, ask, delta) => ({bid,ask,at:iso(delta),feed:'iex'})
const entry = (id='first',delta=1) => ({lifecycleId:id,symbol:'ABC',wouldSubmit:true,status:'PAUSED_ENTRY_WOULD_SUBMIT',quantity:10,decisionAt:iso(delta),evidence:{score:99,strategyAuthorization:{authorized:true}},quote:quote(1.99,2,delta)})
function row(delta, bid, decisions=[]) {
  const at=iso(delta)
  return { version:1, orderSubmitted:false, decisions, market:{capturedAt:at,scaleRunnerEnabled:false,marketClock:{isOpen:true,timestamp:at},capital:{stale:false,sourceAgeSec:0,maxAgeSec:60},candidates:[{symbol:'ABC',price:bid,observedQuote:quote(bid,bid+0.01,delta),decision:'WAIT',changePct:1,readonlyPotentialScore:80,readonlyPotentialFlags:[],sourceAgeSec:0,maxSourceAgeSec:60,sourceStale:false}]}}
}
test('executes at the ask, exits at the bid on the native hard-loss rule, and respects its cooldown',async()=>{
  const r=createPausedReplay({initialCash:873.78,estimatedFeePerSide:0.01})
  await r.session([row(0,1.99,[entry()]),row(15000,1.9,[entry('next',15001)]),row(30000,1.95,[entry('next',30001)])])
  const s=r.summary();assert.equal(s.completedRoundTrips,1);assert.equal(s.fills,2);assert.equal(s.openPositions,0);assert.equal(s.coverageGaps,0);assert.ok(Math.abs(s.estimatedNetVersusCash+1.02)<1e-9)
})
test('withholds the result for stale or missing data and for any open position',async()=>{
  const r=createPausedReplay({initialCash:873.78,estimatedFeePerSide:0.01});await r.session([row(0,1.99,[entry()])]);assert.equal(r.summary().estimatedNetVersusCash,null)
  const missing=row(15000,1.9);missing.market.candidates=[];await r.session([missing,row(30000,1.9)]);assert.equal(r.summary().coverageGaps,1);assert.equal(r.summary().estimatedNetVersusCash,null)
})
test('refuses scale-enabled sessions and never treats an empty sample as a zero return',async()=>{
  const r=createPausedReplay({initialCash:873.78,estimatedFeePerSide:0});assert.equal(r.summary().estimatedNetVersusCash,null)
  const m=row(0,1.99);m.market.scaleRunnerEnabled=true;await assert.rejects(r.session([m]),/scale runner disabled/)
})
