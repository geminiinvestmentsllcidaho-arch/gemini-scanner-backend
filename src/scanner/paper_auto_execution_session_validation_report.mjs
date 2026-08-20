export const VERSION = 'paper_auto_execution_session_validation_report_v1'

const freeze = value => Object.freeze(value)
const arr = value => Array.isArray(value) ? value : []
const clean = (value, max = 256) => String(value ?? '').trim().slice(0, max)

function deriveEntryOutcome(entryValidation = {}) {
  const status = clean(entryValidation?.status, 64) || 'WAITING_FOR_ELIGIBLE_ENTRY'
  if (status === 'ENTRY_COMPLETED') return freeze({ status, legitimate: true, orderSubmitted: true })
  if (status === 'NO_ELIGIBLE_ENTRY') return freeze({ status, legitimate: true, orderSubmitted: false })
  if (status === 'FAILED_NEEDS_REVIEW') return freeze({ status, legitimate: false, orderSubmitted: Boolean(entryValidation?.lastEntry?.brokerOrderId) })
  return freeze({ status: 'WAITING_FOR_ELIGIBLE_ENTRY', legitimate: true, orderSubmitted: false })
}

export function buildPaperAutoExecutionSessionValidationReport(input = {}, options = {}) {
  const generatedAt = new Date(options.now ?? Date.now())
  if (!Number.isFinite(generatedAt.getTime())) throw new TypeError('now must be valid')

  const continuity = input.continuity ?? {}
  const enter = input.enter ?? {}
  const scale = input.scale ?? {}
  const exit = input.exit ?? {}
  const degradedBroker = input.degradedBroker ?? {}
  const readiness = input.readiness ?? {}
  const assurance = input.assurance ?? {}
  const entryValidation = input.entryValidation ?? {}
  const lifecycle = input.lifecycle ?? null
  const outcome = deriveEntryOutcome(entryValidation)

  const scannerHealthy = input.scannerHealth?.ok === true
    || input.scannerHealth?.status === 'ok'
    || input.scannerHealth?.healthy === true
  const marketDataFresh = input.marketDataFresh === true
    ? true
    : input.marketDataFresh === false
      ? false
      : continuity?.lastSnapshotFresh === true
  const readinessOk = readiness?.infrastructureReady === true
  const assuranceOk = assurance?.report?.healthy === true
  const brokerHealthy = degradedBroker?.degraded !== true

  const blockers = []
  if (!scannerHealthy) blockers.push('scanner_health_not_confirmed')
  if (!marketDataFresh) blockers.push('market_data_freshness_not_confirmed')
  if (!readinessOk) blockers.push(...arr(readiness?.blockers).map(x => clean(x, 128)).filter(Boolean))
  if (!assuranceOk) blockers.push('execution_assurance_not_healthy')
  if (!brokerHealthy) blockers.push(clean(degradedBroker?.reason, 128) || 'degraded_broker_active')
  if (outcome.status === 'FAILED_NEEDS_REVIEW') blockers.push(clean(entryValidation?.lastCandidate?.blocker, 160) || 'entry_validation_failed')

  const healthy = blockers.length === 0 && outcome.legitimate === true

  return freeze({
    version: VERSION,
    generatedAt: generatedAt.toISOString(),
    status: healthy ? 'VALIDATED' : 'FAILED_NEEDS_REVIEW',
    healthy,
    scanner: freeze({
      healthy: scannerHealthy,
      sourceStatus: input.scannerHealth?.status ?? null,
    }),
    marketData: freeze({
      fresh: marketDataFresh,
      observedAt: continuity?.lastSnapshotObservedAt ?? null,
      candidateCount: continuity?.lastSnapshotCandidateCount ?? null,
      eligibleCandidateCount: continuity?.lastEligibleCandidateCount ?? null,
      strongestEligibleSymbol: continuity?.lastEligibleCandidateSymbol ?? null,
    }),
    execution: freeze({
      continuity: freeze({ enabled: continuity?.enabled === true, status: continuity?.lastStatus ?? null }),
      enter: freeze({ enabled: enter?.enabled === true, status: enter?.lastStatus ?? null }),
      scale: freeze({ enabled: scale?.enabled === true, status: scale?.lastStatus ?? null }),
      exit: freeze({ enabled: exit?.enabled === true, running: exit?.running === true, status: exit?.lastStatus ?? null }),
      degradedBroker: freeze({ healthy: brokerHealthy, degraded: degradedBroker?.degraded === true, reason: degradedBroker?.reason ?? null }),
      readiness: freeze({ ready: readinessOk, status: readiness?.status ?? null, blockers: freeze([...arr(readiness?.blockers)]) }),
      assurance: freeze({ healthy: assuranceOk, incidentOpen: Boolean(assurance?.incident) }),
    }),
    eligibleEntryOutcome: freeze({
      ...outcome,
      correlationId: entryValidation?.correlationId ?? null,
      lastCandidate: entryValidation?.lastCandidate ?? null,
      noTrade: entryValidation?.noTrade ?? null,
      allocationPercent: entryValidation?.allocationPercent ?? null,
      proposedQuantity: entryValidation?.proposedQuantity ?? null,
      executedQuantity: entryValidation?.executedQuantity ?? null,
    }),
    reconciliation: freeze({
      lifecycleId: entryValidation?.lastEntry?.lifecycleId ?? lifecycle?.lifecycleId ?? null,
      lifecycleState: entryValidation?.lastEntry?.lifecycleState ?? lifecycle?.state ?? null,
      brokerOrderId: entryValidation?.lastEntry?.brokerOrderId ?? null,
      filledQuantity: entryValidation?.lastEntry?.filledQuantity ?? lifecycle?.filledQuantity ?? null,
      averageFillPrice: entryValidation?.lastEntry?.averageFillPrice ?? lifecycle?.averageFillPrice ?? null,
      reconciliationStatus: entryValidation?.lastEntry?.reconciliationStatus ?? enter?.lastReconciliation?.status ?? null,
      brokerPositionIdentity: entryValidation?.lastEntry?.brokerPositionIdentity ?? lifecycle?.brokerPositionIdentity ?? null,
    }),
    blockers: freeze([...new Set(blockers)]),
    readOnly: true,
    localEvidenceOnly: true,
    safety: freeze({
      observationalOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      strategyMutationAllowed: false,
      thresholdMutationAllowed: false,
      sizingMutationAllowed: false,
      aiAuthorityMutationAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export default freeze({ VERSION, buildPaperAutoExecutionSessionValidationReport })
