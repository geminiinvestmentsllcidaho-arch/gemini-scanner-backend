import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPaperAutoExecutionStrategyEvidence } from '../src/scanner/paper_auto_execution_strategy_evidence.mjs'

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
