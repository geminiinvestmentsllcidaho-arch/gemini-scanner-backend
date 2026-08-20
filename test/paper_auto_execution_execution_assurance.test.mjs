import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluatePaperAutoExecutionExecutionAssurance as evaluate,
  VERSION,
} from '../src/scanner/paper_auto_execution_execution_assurance.mjs'

const NOW = Date.parse('2026-08-19T23:30:00.000Z')
const isoAgo = ms => new Date(NOW - ms).toISOString()
const isoAhead = ms => new Date(NOW + ms).toISOString()
const fresh = {
  continuity: {
    enabled: true,
    lastStatus: 'NO_ELIGIBLE_CANDIDATE',
    lastCycleCompletedAt: isoAgo(1_000),
    lastSnapshotObservedAt: isoAgo(1_000),
    lastSnapshotFresh: true,
    lastSnapshotCandidateCount: 4,
    lastEligibleCandidateCount: 0,
    lastEligibleCandidateSymbol: null,
  },
  enter: { enabled: true, lastStatus: 'CONTINUITY_ENTER_NOT_REQUIRED', lastCycleCompletedAt: isoAgo(1_000) },
}

test('healthy closed market does not treat idle heartbeats as execution failure', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: false,
    continuity: { enabled: true, lastStatus: 'NO_ELIGIBLE_CANDIDATE' },
    enter: { enabled: true, lastStatus: 'CONTINUITY_ENTER_NOT_REQUIRED' },
  })
  assert.equal(out.version, VERSION)
  assert.equal(out.healthy, true)
  assert.deepEqual(out.failureCodes, [])
  assert.equal(out.safety.readOnly, true)
  assert.equal(out.safety.orderPlacementAllowed, false)
  assert.equal(out.safety.strategyMutationAllowed, false)
  assert.equal(out.safety.thresholdMutationAllowed, false)
  assert.equal(out.safety.sizingMutationAllowed, false)
  assert.equal(out.safety.aiAuthorityMutationAllowed, false)
  assert.equal(out.safety.blindResubmissionAllowed, false)
  assert.equal(out.safety.liveTradingAllowed, false)
})

test('open market requires fresh continuity and ENTER completion heartbeats', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuity: { enabled: true, lastCycleCompletedAt: isoAgo(50_000) },
    enter: { enabled: true, lastCycleCompletedAt: isoAgo(50_001) },
  })
  assert.deepEqual(out.failureCodes, ['CONTINUITY_HEARTBEAT_STALE', 'ENTER_HEARTBEAT_STALE'])
})

test('future completion heartbeats fail stale instead of appearing healthy', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuity: { enabled: true, lastCycleCompletedAt: isoAhead(1_000) },
    enter: { enabled: true, lastCycleCompletedAt: isoAhead(1_000) },
  })
  assert.deepEqual(out.failureCodes, ['CONTINUITY_HEARTBEAT_STALE', 'ENTER_HEARTBEAT_STALE'])
})

test('fresh open-market heartbeats with no eligible candidate are healthy', () => {
  const out = evaluate({ nowMs: NOW, marketOpen: true, ...fresh })
  assert.equal(out.healthy, true)
  assert.deepEqual(out.failureCodes, [])
})

test('candidate-selected lifecycle stalls from authoritative updatedAt without ENTER evidence', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    ...fresh,
    lifecycle: {
      lifecycleId: 'life-1',
      selectedSymbol: 'TEST',
      state: 'CANDIDATE_SELECTED',
      createdAt: isoAgo(90_000),
      updatedAt: isoAgo(46_000),
    },
  })
  assert.ok(out.failureCodes.includes('ELIGIBLE_ENTER_STALLED'))
  assert.equal(out.checks.lifecycle.updatedAgeMs, 46_000)
  assert.equal(out.checks.lifecycle.hasEnterEvidence, false)
})

test('recent candidate strategy-evidence patch resets bounded progress age via updatedAt', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    ...fresh,
    lifecycle: {
      lifecycleId: 'life-2',
      selectedSymbol: 'FAST',
      state: 'CANDIDATE_SELECTED',
      createdAt: isoAgo(90_000),
      updatedAt: isoAgo(5_000),
    },
  })
  assert.equal(out.healthy, true)
  assert.ok(!out.failureCodes.includes('ELIGIBLE_ENTER_STALLED'))
})

test('ENTER_SUBMITTING counts as ENTER evidence but becomes reconciliation-stalled after SLA', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    ...fresh,
    lifecycle: {
      lifecycleId: 'life-3',
      selectedSymbol: 'SAFE',
      state: 'ENTER_SUBMITTING',
      createdAt: isoAgo(90_000),
      updatedAt: isoAgo(46_000),
      enterClientOrderId: 'client-1',
    },
  })
  assert.equal(out.checks.lifecycle.hasEnterEvidence, true)
  assert.ok(!out.failureCodes.includes('ELIGIBLE_ENTER_STALLED'))
  assert.ok(out.failureCodes.includes('ENTER_RECONCILIATION_STALLED'))
})

test('ENTER_UNKNOWN inside reconciliation SLA is not falsely stalled', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    ...fresh,
    lifecycle: {
      lifecycleId: 'life-4',
      selectedSymbol: 'SAFE',
      state: 'ENTER_UNKNOWN',
      createdAt: isoAgo(40_000),
      updatedAt: isoAgo(10_000),
      enterClientOrderId: 'client-2',
    },
  })
  assert.equal(out.healthy, true)
})

test('future lifecycle timestamps surface explicit integrity failure', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    ...fresh,
    lifecycle: {
      lifecycleId: 'life-5',
      selectedSymbol: 'TIME',
      state: 'CANDIDATE_SELECTED',
      createdAt: isoAhead(1_000),
      updatedAt: isoAhead(1_000),
    },
  })
  assert.ok(out.failureCodes.includes('LIFECYCLE_TIMESTAMP_FUTURE'))
})

test('continuity freshness failure status is surfaced during open market', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuity: { enabled: true, lastStatus: 'FRESH_SCAN_REQUIRED_FOR_LIFECYCLE_CREATION', lastCycleCompletedAt: isoAgo(1_000) },
    enter: fresh.enter,
  })
  assert.ok(out.failureCodes.includes('CONTINUITY_FRESH_SCAN_REQUIRED_FOR_LIFECYCLE_CREATION'))
})

test('exact ENTER fail-closed and readiness statuses are surfaced during open market', () => {
  for (const status of [
    'PAPER_CREDENTIALS_NOT_READY',
    'PAPER_HOST_REQUIRED',
    'PAPER_MARKET_CLOCK_STALE',
    'FRESH_PAPER_ACCOUNT_REQUIRED',
    'PAPER_ACCOUNT_SNAPSHOT_STALE',
    'PAPER_ACCOUNT_BLOCKED',
    'PRE_SUBMIT_MARKET_CLOCK_REQUIRED',
    'PRE_SUBMIT_MARKET_CLOCK_STALE',
    'CONTINUITY_ENTER_SUBMISSION_REJECTED',
    'FRESH_PAPER_ACCOUNT_REQUIRED_FOR_RECONCILIATION',
    'CONTINUITY_ENTER_FAILED_CLOSED',
    'CONTINUITY_ENTER_ERROR_FAIL_CLOSED',
  ]) {
    const out = evaluate({
      nowMs: NOW,
      marketOpen: true,
      continuity: fresh.continuity,
      enter: { enabled: true, lastStatus: status, lastCycleCompletedAt: isoAgo(1_000) },
    })
    assert.ok(out.failureCodes.includes(`ENTER_${status}`), status)
  }
})

test('healthy market-closed status are never classified as execution failure', () => {
  for (const status of ['MARKET_OPEN_REQUIRED', 'PRE_SUBMIT_MARKET_OPEN_REQUIRED']) {
    const out = evaluate({
      nowMs: NOW,
      marketOpen: true,
      continuity: fresh.continuity,
      enter: { enabled: true, lastStatus: status, lastCycleCompletedAt: isoAgo(1_000) },
    })
    assert.equal(out.healthy, true, status)
  }
})

test('invalid nonpositive thresholds fall back to bounded defaults', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuityHeartbeatStaleMs: -1,
    enterHeartbeatStaleMs: 0,
    candidateSelectedStallMs: Number.NaN,
    enterReconciliationStallMs: -5,
    ...fresh,
  })
  assert.deepEqual(out.thresholds, {
    continuityHeartbeatStaleMs: 45_000,
    enterHeartbeatStaleMs: 45_000,
    candidateSelectedStallMs: 45_000,
    enterReconciliationStallMs: 45_000,
  })
})

test('terminal lifecycle classification exactly matches production terminal states', () => {
  for (const state of ['ROUND_TRIP_COMPLETED', 'FAILED_NEEDS_REVIEW', 'CANDIDATE_EXPIRED']) {
    const out = evaluate({ nowMs: NOW, marketOpen: false, lifecycle: { state } })
    assert.equal(out.checks.lifecycle.terminal, true, state)
  }
  for (const state of ['MONITORING', 'POSITION_CONFIRMED', 'UNRESOLVED_NEEDS_RECONCILIATION']) {
    const out = evaluate({ nowMs: NOW, marketOpen: false, lifecycle: { state } })
    assert.equal(out.checks.lifecycle.terminal, false, state)
  }
})


test('open-market NO_ELIGIBLE_CANDIDATE without authoritative snapshot proof fails assurance', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuity: {
      enabled: true,
      lastStatus: 'NO_ELIGIBLE_CANDIDATE',
      lastCycleCompletedAt: isoAgo(1_000),
    },
    enter: fresh.enter,
  })
  assert.ok(out.failureCodes.includes('NO_ELIGIBLE_CANDIDATE_UNPROVEN'))
})

test('open-market NO_ELIGIBLE_CANDIDATE with null eligible count is unproven', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuity: { ...fresh.continuity, lastEligibleCandidateCount: null },
    enter: fresh.enter,
  })
  assert.ok(out.failureCodes.includes('NO_ELIGIBLE_CANDIDATE_UNPROVEN'))
  assert.equal(out.checks.continuity.lastEligibleCandidateCount, null)
})

test('open-market NO_ELIGIBLE_CANDIDATE with impossible eligible count is unproven', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuity: { ...fresh.continuity, lastSnapshotCandidateCount: 0, lastEligibleCandidateCount: 1 },
    enter: fresh.enter,
  })
  assert.ok(out.failureCodes.includes('NO_ELIGIBLE_CANDIDATE_UNPROVEN'))
})

test('open-market NO_ELIGIBLE_CANDIDATE contradicted by eligible snapshot fails assurance', () => {
  const out = evaluate({
    nowMs: NOW,
    marketOpen: true,
    continuity: {
      ...fresh.continuity,
      lastEligibleCandidateCount: 1,
      lastEligibleCandidateSymbol: 'QUAL',
    },
    enter: fresh.enter,
  })
  assert.ok(out.failureCodes.includes('QUALIFIED_CANDIDATE_NOT_SELECTED'))
  assert.equal(out.checks.continuity.lastEligibleCandidateCount, 1)
  assert.equal(out.checks.continuity.lastEligibleCandidateSymbol, 'QUAL')
})
