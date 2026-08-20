export const VERSION = 'paper_auto_execution_execution_assurance_v3'

const asMs = value => {
  const ms = Date.parse(String(value ?? ''))
  return Number.isFinite(ms) ? ms : null
}

const ageMs = (value, nowMs) => {
  const ms = asMs(value)
  if (ms === null) return null
  return nowMs - ms
}

const positiveThreshold = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const nonnegativeFinite = value => Number.isFinite(value) && value >= 0
const upper = value => String(value ?? '').trim().toUpperCase()

const TERMINAL_STATES = new Set([
  'ROUND_TRIP_COMPLETED',
  'FAILED_NEEDS_REVIEW',
  'CANDIDATE_EXPIRED',
])

const ENTER_RECONCILIATION_STATES = new Set([
  'ENTER_SUBMITTING',
  'ENTER_UNKNOWN',
  'ENTER_OPEN',
  'ENTER_PARTIALLY_FILLED',
  'UNRESOLVED_NEEDS_RECONCILIATION',
])

const CONTINUITY_FAILURE_STATUSES = new Set([
  'SCAN_SNAPSHOT_REQUIRED',
  'FRESH_SCAN_REQUIRED_FOR_EXPIRATION',
  'FRESH_SCAN_REQUIRED_FOR_LIFECYCLE_CREATION',
  'LIFECYCLE_FILE_COLLISION',
])

const ENTER_FAILURE_STATUSES = new Set([
  'ACTIVE_LIFECYCLE_PATH_REQUIRED',
  'ACTIVE_LIFECYCLE_FILE_MISSING',
  'ACTIVE_LIFECYCLE_REQUIRED',
  'FRESH_CANDIDATE_REVALIDATION_REQUIRED',
  'FRESH_CANDIDATE_REQUIRED',
  'PAPER_CREDENTIALS_NOT_READY',
  'PAPER_HOST_REQUIRED',
  'PREMARKET_CAPITAL_BASELINE_REQUIRED',
  'PREMARKET_CAPITAL_BASELINE_SESSION_MISMATCH',
  'PAPER_MARKET_CLOCK_STALE',
  'FRESH_PAPER_ACCOUNT_REQUIRED',
  'PREMARKET_CAPITAL_BASELINE_ACCOUNT_IDENTITY_MISMATCH',
  'PAPER_ACCOUNT_SNAPSHOT_STALE',
  'PAPER_ACCOUNT_BLOCKED',
  'PRE_SUBMIT_MARKET_CLOCK_REQUIRED',
  'PRE_SUBMIT_MARKET_CLOCK_STALE',
  'CONTINUITY_ENTER_SUBMISSION_REJECTED',
  'FRESH_PAPER_ACCOUNT_REQUIRED_FOR_RECONCILIATION',
  'CONTINUITY_ENTER_FAILED_CLOSED',
  'CONTINUITY_ENTER_ERROR_FAIL_CLOSED',
])

const hasEnterEvidence = lifecycle => Boolean(
  lifecycle?.enterClientOrderId ||
  lifecycle?.enterBrokerOrderId ||
  Number(lifecycle?.filledQuantity) > 0 ||
  [
    'ENTER_SUBMITTING',
    'ENTER_UNKNOWN',
    'ENTER_OPEN',
    'ENTER_PARTIALLY_FILLED',
    'POSITION_CONFIRMED',
    'MONITORING',
    'EXIT_TRIGGERED',
    'EXIT_SUBMITTING',
    'EXIT_UNKNOWN',
    'EXIT_PARTIALLY_FILLED',
    'ROUND_TRIP_COMPLETED',
    'UNRESOLVED_NEEDS_RECONCILIATION',
  ].includes(upper(lifecycle?.state))
)

export function evaluatePaperAutoExecutionExecutionAssurance(input = {}) {
  const nowCandidate = Number(input.nowMs)
  const nowMs = Number.isFinite(nowCandidate) ? nowCandidate : Date.now()
  const marketOpen = input.marketOpen === true
  const continuity = input.continuity ?? {}
  const enter = input.enter ?? {}
  const lifecycle = input.lifecycle ?? continuity.lastLifecycle ?? null

  const thresholds = Object.freeze({
    continuityHeartbeatStaleMs: positiveThreshold(input.continuityHeartbeatStaleMs, 45_000),
    enterHeartbeatStaleMs: positiveThreshold(input.enterHeartbeatStaleMs, 45_000),
    candidateSelectedStallMs: positiveThreshold(input.candidateSelectedStallMs, 45_000),
    enterReconciliationStallMs: positiveThreshold(input.enterReconciliationStallMs, 45_000),
  })

  const failureCodes = []

  const continuityStartedAgeMs = ageMs(continuity.lastCycleStartedAt, nowMs)
  const continuityCompletedAgeMs = ageMs(continuity.lastCycleCompletedAt, nowMs)
  const enterStartedAgeMs = ageMs(enter.lastCycleStartedAt, nowMs)
  const enterCompletedAgeMs = ageMs(enter.lastCycleCompletedAt, nowMs)

  if (marketOpen && continuity.enabled === true) {
    if (!nonnegativeFinite(continuityCompletedAgeMs) ||
        continuityCompletedAgeMs > thresholds.continuityHeartbeatStaleMs) {
      failureCodes.push('CONTINUITY_HEARTBEAT_STALE')
    }
  }

  if (marketOpen && enter.enabled === true) {
    if (!nonnegativeFinite(enterCompletedAgeMs) ||
        enterCompletedAgeMs > thresholds.enterHeartbeatStaleMs) {
      failureCodes.push('ENTER_HEARTBEAT_STALE')
    }
  }

  const lifecycleState = upper(lifecycle?.state)
  const lifecycleCreatedAt = lifecycle?.createdAt ?? null
  const lifecycleUpdatedAt = lifecycle?.updatedAt ?? lifecycleCreatedAt
  const lifecycleCreatedAgeMs = ageMs(lifecycleCreatedAt, nowMs)
  const lifecycleUpdatedAgeMs = ageMs(lifecycleUpdatedAt, nowMs)
  const enterEvidence = hasEnterEvidence(lifecycle)

  if (marketOpen && lifecycle && (
    (lifecycleCreatedAgeMs !== null && lifecycleCreatedAgeMs < 0) ||
    (lifecycleUpdatedAgeMs !== null && lifecycleUpdatedAgeMs < 0)
  )) {
    failureCodes.push('LIFECYCLE_TIMESTAMP_FUTURE')
  }

  if (marketOpen &&
      lifecycleState === 'CANDIDATE_SELECTED' &&
      !enterEvidence &&
      nonnegativeFinite(lifecycleUpdatedAgeMs) &&
      lifecycleUpdatedAgeMs > thresholds.candidateSelectedStallMs) {
    failureCodes.push('ELIGIBLE_ENTER_STALLED')
  }

  if (marketOpen &&
      ENTER_RECONCILIATION_STATES.has(lifecycleState) &&
      nonnegativeFinite(lifecycleUpdatedAgeMs) &&
      lifecycleUpdatedAgeMs > thresholds.enterReconciliationStallMs) {
    failureCodes.push('ENTER_RECONCILIATION_STALLED')
  }

  const continuityStatus = upper(continuity.lastStatus)
  const enterStatus = upper(enter.lastStatus)

  if (marketOpen && CONTINUITY_FAILURE_STATUSES.has(continuityStatus)) {
    failureCodes.push(`CONTINUITY_${continuityStatus}`)
  }

  if (marketOpen && continuityStatus === 'NO_ELIGIBLE_CANDIDATE') {
    const snapshotProvenFresh = continuity.lastSnapshotFresh === true
    const eligibleCount = Number(continuity.lastEligibleCandidateCount)
    if (!snapshotProvenFresh || !Number.isFinite(eligibleCount) || eligibleCount < 0) {
      failureCodes.push('NO_ELIGIBLE_CANDIDATE_UNPROVEN')
    } else if (eligibleCount > 0) {
      failureCodes.push('QUALIFIED_CANDIDATE_NOT_SELECTED')
    }
  }

  if (marketOpen && ENTER_FAILURE_STATUSES.has(enterStatus)) {
    failureCodes.push(`ENTER_${enterStatus}`)
  }

  const healthy = failureCodes.length === 0

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    healthy,
    status: healthy ? 'healthy' : 'unhealthy',
    failureCodes: Object.freeze([...new Set(failureCodes)]),
    marketOpen,
    checks: Object.freeze({
      continuity: Object.freeze({
        enabled: continuity.enabled === true,
        lastStatus: continuity.lastStatus ?? null,
        lastCycleStartedAt: continuity.lastCycleStartedAt ?? null,
        lastCycleCompletedAt: continuity.lastCycleCompletedAt ?? null,
        lastCycleStartedAgeMs: continuityStartedAgeMs,
        lastCycleCompletedAgeMs: continuityCompletedAgeMs,
        lastSnapshotObservedAt: continuity.lastSnapshotObservedAt ?? null,
        lastSnapshotFresh: continuity.lastSnapshotFresh === true,
        lastSnapshotCandidateCount: Number.isFinite(Number(continuity.lastSnapshotCandidateCount)) ? Number(continuity.lastSnapshotCandidateCount) : null,
        lastEligibleCandidateCount: Number.isFinite(Number(continuity.lastEligibleCandidateCount)) ? Number(continuity.lastEligibleCandidateCount) : null,
        lastEligibleCandidateSymbol: continuity.lastEligibleCandidateSymbol ?? null,
      }),
      enter: Object.freeze({
        enabled: enter.enabled === true,
        lastStatus: enter.lastStatus ?? null,
        lastCycleStartedAt: enter.lastCycleStartedAt ?? null,
        lastCycleCompletedAt: enter.lastCycleCompletedAt ?? null,
        lastCycleStartedAgeMs: enterStartedAgeMs,
        lastCycleCompletedAgeMs: enterCompletedAgeMs,
      }),
      lifecycle: Object.freeze({
        present: Boolean(lifecycle),
        lifecycleId: lifecycle?.lifecycleId ?? null,
        symbol: lifecycle?.selectedSymbol ?? null,
        state: lifecycleState || null,
        terminal: TERMINAL_STATES.has(lifecycleState),
        createdAt: lifecycleCreatedAt,
        updatedAt: lifecycleUpdatedAt,
        createdAgeMs: lifecycleCreatedAgeMs,
        updatedAgeMs: lifecycleUpdatedAgeMs,
        hasEnterEvidence: enterEvidence,
      }),
    }),
    thresholds,
    safety: Object.freeze({
      readOnly: true,
      paperOnly: true,
      remediationAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      strategyMutationAllowed: false,
      thresholdMutationAllowed: false,
      sizingMutationAllowed: false,
      aiAuthorityMutationAllowed: false,
      blindResubmissionAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export default Object.freeze({
  VERSION,
  evaluatePaperAutoExecutionExecutionAssurance,
})
