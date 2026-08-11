import { emitAdminPaperOperationalIncident } from './admin_paper_operational_incident_emitter.mjs'
import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { buildPaperAutoOrderIdentity } from './paper_auto_execution_order_identity.mjs'

export const VERSION = 'paper_auto_execution_submission_boundary_v1'
const clean = (v) => String(v ?? '').trim()
const enabled = (env, name) => clean(env?.[name]) === '1'
const safety = (extra = {}) => Object.freeze({
  paperOnly: true,
  disabledByDefault: true,
  injectedAdapterOnly: true,
  directBrokerImplementation: false,
  liveTradingAllowed: false,
  automaticStartAllowed: false,
  ...extra,
})

function classify(result = {}) {
  const brokerOrderId = clean(result.brokerOrderId ?? result.orderId ?? result.id) || null
  const submitted = result.orderSubmitted === true || result.submitted === true
  const rejected = result.rejected === true || clean(result.status).toLowerCase() === 'rejected'
  const ambiguous = result.ambiguous === true || result.unknown === true || (result.orderSubmitAttempted === true && !submitted && !rejected)
  if (submitted && brokerOrderId) return { kind: 'confirmed', brokerOrderId }
  if (rejected) return { kind: 'rejected', brokerOrderId: null }
  if (ambiguous || submitted) return { kind: 'ambiguous', brokerOrderId }
  return { kind: 'blocked', brokerOrderId: null }
}

async function emitIncidentFailOpen(incidentEmitter, incident) {
  try {
    if (typeof incidentEmitter === 'function') await incidentEmitter(incident)
  } catch {}
}

export async function submitPaperAutoOrder({ lifecycleStore, phase, quantity, submitPaperOrder, env = process.env, incidentEmitter = emitAdminPaperOperationalIncident } = {}) {
  if (!lifecycleStore || typeof lifecycleStore.load !== 'function' || typeof lifecycleStore.transition !== 'function') throw new Error('paper_auto_submission_store_required')
  const lifecycle = lifecycleStore.load()
  if (!lifecycle) throw new Error('paper_auto_submission_lifecycle_missing')
  const normalizedPhase = clean(phase).toLowerCase()
  if (!['enter', 'exit'].includes(normalizedPhase)) throw new Error('paper_auto_submission_phase_invalid')

  const boundaryEnabled = enabled(env, 'PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED')
  const phaseEnabled = normalizedPhase === 'enter'
    ? enabled(env, 'PAPER_AUTO_ENTER_SUBMISSION_ENABLED')
    : enabled(env, 'PAPER_AUTO_EXIT_SUBMISSION_ENABLED')
  if (!boundaryEnabled || !phaseEnabled) return Object.freeze({
    ok: true, version: VERSION, status: 'SUBMISSION_DISABLED_BY_ENV', adapterInvoked: false,
    lifecycle, blockers: Object.freeze(['paper_auto_submission_not_enabled']),
    safety: safety({ brokerContactAllowed: false, orderPlacementAllowed: false, accountMutationAllowed: false }),
  })
  if (typeof submitPaperOrder !== 'function') return Object.freeze({
    ok: true, version: VERSION, status: 'SUBMISSION_ADAPTER_REQUIRED', adapterInvoked: false,
    lifecycle, blockers: Object.freeze(['injected_paper_order_adapter_required']),
    safety: safety({ brokerContactAllowed: false, orderPlacementAllowed: false, accountMutationAllowed: false }),
  })

  if (normalizedPhase === 'enter' && lifecycle.state !== S.CANDIDATE_SELECTED) throw new Error(`paper_auto_enter_submission_invalid_state:${lifecycle.state}`)
  if (normalizedPhase === 'exit') {
    if (![S.MONITORING, S.EXIT_TRIGGERED].includes(lifecycle.state)) throw new Error(`paper_auto_exit_submission_invalid_state:${lifecycle.state}`)
    lifecycleStore.assertExitTarget({ symbol: lifecycle.selectedSymbol, quantity: Number(quantity ?? lifecycle.filledQuantity) })
  }

  const side = normalizedPhase === 'enter' ? 'buy' : 'sell'
  const requestedQuantity = normalizedPhase === 'enter' ? Number(quantity ?? 1) : Number(quantity ?? lifecycle.filledQuantity)
  const identity = buildPaperAutoOrderIdentity({ lifecycleId: lifecycle.lifecycleId, phase: normalizedPhase, symbol: lifecycle.selectedSymbol, quantity: requestedQuantity, side })
  if (normalizedPhase === 'exit' && lifecycle.state === S.MONITORING) lifecycleStore.transition(S.EXIT_TRIGGERED)
  const submittingState = normalizedPhase === 'enter' ? S.ENTER_SUBMITTING : S.EXIT_SUBMITTING
  let next = lifecycleStore.transition(submittingState, normalizedPhase === 'enter' ? { enterClientOrderId: identity.clientOrderId } : { exitClientOrderId: identity.clientOrderId })

  let result
  try {
    result = await submitPaperOrder(Object.freeze({ symbol: identity.symbol, qty: identity.quantity, side: identity.side, type: 'market', timeInForce: 'day', clientOrderId: identity.clientOrderId, paperOnly: true }), Object.freeze({ lifecycleId: identity.lifecycleId, phase: identity.phase, deterministicIdentity: identity, liveTradingAllowed: false }))
  } catch (error) {
    next = lifecycleStore.transition(normalizedPhase === 'enter' ? S.ENTER_UNKNOWN : S.EXIT_UNKNOWN, { reconciliation: [...(next.reconciliation ?? []), { kind: 'submission_exception', phase: normalizedPhase, clientOrderId: identity.clientOrderId, message: error?.message ?? String(error) }] })
    await emitIncidentFailOpen(incidentEmitter, { source: 'paper_execution', severity: 'critical', failureCode: 'submission_exception_requires_reconciliation', summary: 'PAPER order submission raised an exception and requires broker-authoritative reconciliation.', phase: normalizedPhase, process: 'paper_auto_execution_submission_boundary' })
    return Object.freeze({ ok: true, version: VERSION, status: 'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED', adapterInvoked: true, identity, lifecycle: next, result: null, blockers: Object.freeze(['submission_exception_requires_reconciliation']), safety: safety({ brokerContactAllowed: true, orderPlacementAllowed: true, accountMutationAllowed: true, reconciliationRequired: true }) })
  }

  const classification = classify(result)
  if (classification.kind === 'confirmed') next = lifecycleStore.transition(normalizedPhase === 'enter' ? S.ENTER_OPEN : S.EXIT_UNKNOWN, normalizedPhase === 'enter' ? { enterBrokerOrderId: classification.brokerOrderId } : { exitBrokerOrderId: classification.brokerOrderId })
  else if (classification.kind === 'ambiguous') next = lifecycleStore.transition(normalizedPhase === 'enter' ? S.ENTER_UNKNOWN : S.EXIT_UNKNOWN, normalizedPhase === 'enter' ? { enterBrokerOrderId: classification.brokerOrderId } : { exitBrokerOrderId: classification.brokerOrderId })
  else if (classification.kind === 'rejected') next = lifecycleStore.transition(S.FAILED_NEEDS_REVIEW, { reconciliation: [...(next.reconciliation ?? []), { kind: 'submission_rejected', phase: normalizedPhase, clientOrderId: identity.clientOrderId }] })
  else next = lifecycleStore.transition(normalizedPhase === 'enter' ? S.ENTER_UNKNOWN : S.EXIT_UNKNOWN, { reconciliation: [...(next.reconciliation ?? []), { kind: 'submission_unclassified', phase: normalizedPhase, clientOrderId: identity.clientOrderId }] })

  if (classification.kind !== 'confirmed') {
    const failureCode = classification.kind === 'rejected' ? 'submission_rejected_requires_review' : classification.kind === 'ambiguous' ? 'ambiguous_submission_requires_reconciliation' : 'submission_unclassified_requires_reconciliation'
    await emitIncidentFailOpen(incidentEmitter, { source: 'paper_execution', severity: 'critical', failureCode, summary: classification.kind === 'rejected' ? 'PAPER order submission was rejected and requires review.' : 'PAPER order submission outcome is ambiguous and requires broker-authoritative reconciliation.', phase: normalizedPhase, process: 'paper_auto_execution_submission_boundary' })
  }

  return Object.freeze({
    ok: true, version: VERSION,
    status: classification.kind === 'confirmed' ? 'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED' : classification.kind === 'rejected' ? 'SUBMISSION_REJECTED' : 'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED',
    adapterInvoked: true, identity, lifecycle: next, result: result ?? null,
    blockers: Object.freeze(classification.kind === 'confirmed' ? ['broker_authoritative_reconciliation_required'] : classification.kind === 'rejected' ? ['submission_rejected_requires_review'] : ['ambiguous_submission_requires_reconciliation']),
    safety: safety({ brokerContactAllowed: true, orderPlacementAllowed: true, accountMutationAllowed: true, reconciliationRequired: classification.kind !== 'rejected' }),
  })
}

export default { VERSION, submitPaperAutoOrder }
