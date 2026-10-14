import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPaperAutoExecutionStrategyEvidence } from '../src/scanner/paper_auto_execution_strategy_evidence.mjs'

test('records canonical scanner liquidity and spread units without fabricating quotes',()=>{
 const {entryObservations:o}=buildPaperAutoExecutionStrategyEvidence({candidate:{
  dailyVolume:2000000,dollarVolume:5000000,previousClose:2.4,price:2.5,
  changePct:4.1667,spreadPct:.2,relativeVolume:1.3,
 }})
 assert.equal(o.dailyVolume,2000000)
 assert.equal(o.dollarVolume,5000000)
 assert.equal(o.spreadPct,.2)
 assert.equal(o.spreadBps,null)
 assert.equal(o.bidPrice,null)
 assert.equal(o.askPrice,null)
 assert.equal(o.previousClose,2.4)
 assert.equal(o.volume,null)
})

test('research observations preserve missing values and cannot alter authorization', () => {
  const candidate = { symbol: 'ABC', state: 'ENTER', score: 94, rankingConfidence: .94,
    changePct:-2, momentumPct:0, volume:12345, spreadBps:'25', bidPrice:null,
    askPrice:'', relativeVolume:false, readonlyPotentialFlags:Array(100).fill('negative_momentum') }
  const baseline = buildPaperAutoExecutionStrategyEvidence({candidate})
  const enriched = buildPaperAutoExecutionStrategyEvidence({candidate:{...candidate,
    changePct:-2, momentumPct:0, volume:12345, spreadBps:'25', bidPrice:null,
    askPrice:'', relativeVolume:false, readonlyPotentialFlags:Array(100).fill('negative_momentum'),
    privateKey:'must_not_be_recorded'}})
  assert.deepEqual(enriched.strategyAuthorization,baseline.strategyAuthorization)
  assert.equal(enriched.entryObservations.bidPrice,null)
  assert.equal(enriched.entryObservations.askPrice,null)
  assert.equal(enriched.entryObservations.relativeVolume,null)
  assert.equal(enriched.entryObservations.momentumPct,0)
  assert.equal(enriched.entryObservations.spreadBps,25)
  assert.deepEqual(enriched.entryObservations.readonlyPotentialFlags,['negative_momentum'])
  assert.equal(enriched.entryObservations.confidenceIsCalibratedProbability,false)
  assert.equal(JSON.stringify(enriched).includes('must_not_be_recorded'),false)
})

test('strategy evidence is bounded audit-only and preserves canonical authorization result', () => {
  const evidence = buildPaperAutoExecutionStrategyEvidence({
    phase: 'candidate_selection',
    snapshotObservedAt: '2026-08-18T20:00:00Z',
    recordedAt: '2026-08-18T20:00:01Z',
    candidate: {
      symbol: 'abc',
      state: 'ENTER',
      decision: 'ENTER',
      buyRecommendation: true,
      blocked: false,
      blockers: [],
      blockingFlags: [],
      staleReasons: [],
      sourceStale: false,
      score: 91,
      price: 4.25,
      momentumPct: 5,
      rankingConnected: true,
      rankingP3GateOk: true,
      rankingSetupScore: 91,
      rankingConfidence: 0.8,
      rankingQuality: 0.9,
    },
  })
  assert.equal(evidence.symbol, 'ABC')
  assert.equal(evidence.phase, 'candidate_selection')
  assert.equal(evidence.strategyAuthorization.authorized, true)
  assert.equal(evidence.strategyAuthorization.aiOverrideAllowed, false)
  assert.equal(evidence.safety.executionEligibilityMutationAllowed, false)
  assert.equal(evidence.safety.orderPlacementAllowed, false)
  assert.equal(evidence.safety.liveTradingAllowed, false)
})

test('strategy evidence records canonical blockers without enforcing them', () => {
  const evidence = buildPaperAutoExecutionStrategyEvidence({
    phase: 'enter_revalidation',
    candidate: {
      symbol: 'ABC',
      state: 'ENTER',
      buyRecommendation: true,
      blocked: false,
      blockers: [],
      score: 99,
    },
  })
  assert.equal(evidence.strategyAuthorization.authorized, false)
  assert.ok(evidence.strategyAuthorization.blockers.length > 0)
  assert.equal(evidence.buyRecommendation, true)
  assert.equal(evidence.safety.auditOnly, true)
})
