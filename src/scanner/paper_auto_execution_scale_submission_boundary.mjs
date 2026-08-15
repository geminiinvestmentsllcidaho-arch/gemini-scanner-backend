import { STATES as S } from './paper_auto_execution_scale_action_store.mjs'

export const VERSION = 'paper_auto_execution_scale_submission_boundary_v1'
const clean = v => String(v ?? '').trim()
const enabled = (env, key) => clean(env?.[key]) === '1'
const safety = extra => Object.freeze({
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
  const ambiguous = result.ambiguous === true || result.unknown === true ||
    (result.orderSubmitAttempted === true && !submitted && !rejected)
  if (submitted && brokerOrderId) return { kind: 'confirmed', brokerOrderId }
  if (rejected) return { kind: 'rejected', brokerOrderId: null }
  if (ambiguous || submitted) return { kind: 'ambiguous', brokerOrderId }
  return { kind: 'blocked', brokerOrderId: null }
}

const move = (store, current, nextState, patch = {}) => store.transition({
  expectedActionSequence: current.actionSequence,
  expectedClientOrderId: current.clientOrderId,
  expectedState: current.state,
  nextState,
  patch,
})

export async function submitPaperScaleOrder({
  scaleActionStore,
  submitPaperOrder,
  env = process.env,
} = {}) {
  if (!scaleActionStore || typeof scaleActionStore.load !== 'function' || typeof scaleActionStore.transition !== 'function') {
    throw new Error('paper_scale_submission_store_required')
  }
  let action = scaleActionStore.load()?.current
  if (!action) throw new Error('paper_scale_submission_action_missing')
  if (action.state !== S.PREPARED) throw new Error(`paper_scale_submission_invalid_state:${action.state}`)

  const directionEnabled = action.action === 'scale_in'
    ? enabled(env, 'PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED')
    : action.action === 'scale_out'
      ? enabled(env, 'PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED')
      : false
  const boundaryEnabled = enabled(env, 'PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED')

  if (!boundaryEnabled || !directionEnabled) return Object.freeze({
    ok: true, version: VERSION, status: 'SCALE_SUBMISSION_DISABLED_BY_ENV',
    adapterInvoked: false, action,
    blockers: Object.freeze(['paper_scale_submission_not_enabled']),
    safety: safety({ brokerContactAllowed: false, orderPlacementAllowed: false, accountMutationAllowed: false }),
  })

  if (typeof submitPaperOrder !== 'function') return Object.freeze({
    ok: true, version: VERSION, status: 'SCALE_SUBMISSION_ADAPTER_REQUIRED',
    adapterInvoked: false, action,
    blockers: Object.freeze(['injected_paper_order_adapter_required']),
    safety: safety({ brokerContactAllowed: false, orderPlacementAllowed: false, accountMutationAllowed: false }),
  })

  action = move(scaleActionStore, action, S.SUBMITTING)

  let result
  try {
    result = await submitPaperOrder(Object.freeze({
      symbol: action.symbol,
      qty: action.quantity,
      side: action.side,
      type: 'market',
      timeInForce: 'day',
      clientOrderId: action.clientOrderId,
      paperOnly: true,
    }), Object.freeze({
      lifecycleId: action.lifecycleId,
      phase: action.action,
      deterministicIdentity: action,
      liveTradingAllowed: false,
    }))
  } catch (error) {
    action = move(scaleActionStore, action, S.UNKNOWN, {
      submissionError: error?.message ?? String(error),
    })
    return Object.freeze({
      ok: true,
      version: VERSION,
      status: 'SCALE_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED',
      adapterInvoked: true,
      action,
      result: null,
      blockers: Object.freeze(['submission_exception_requires_reconciliation']),
      safety: safety({
        brokerContactAllowed: true,
        orderPlacementAllowed: true,
        accountMutationAllowed: true,
        reconciliationRequired: true,
      }),
    })
  }

  const classification = classify(result)
  if (classification.kind === 'confirmed') {
    action = move(scaleActionStore, action, S.OPEN, {
      brokerOrderId: classification.brokerOrderId,
      brokerOrderStatus: clean(result?.status) || null,
    })
  } else if (classification.kind === 'rejected') {
    action = move(scaleActionStore, action, S.FAILED_NEEDS_REVIEW, {
      submissionRejected: true,
      brokerOrderStatus: clean(result?.status) || 'rejected',
    })
  } else {
    action = move(scaleActionStore, action, S.UNKNOWN, {
      brokerOrderId: classification.brokerOrderId,
      brokerOrderStatus: clean(result?.status) || null,
    })
  }

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: classification.kind === 'confirmed'
      ? 'SCALE_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED'
      : classification.kind === 'rejected'
        ? 'SCALE_SUBMISSION_REJECTED'
        : 'SCALE_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED',
    adapterInvoked: true,
    action,
    result: result ?? null,
    blockers: Object.freeze(
      classification.kind === 'confirmed'
        ? ['broker_authoritative_reconciliation_required']
        : classification.kind === 'rejected'
          ? ['submission_rejected_requires_review']
          : ['ambiguous_submission_requires_reconciliation']
    ),
    safety: safety({
      brokerContactAllowed: true,
      orderPlacementAllowed: true,
      accountMutationAllowed: true,
      reconciliationRequired: classification.kind !== 'rejected',
    }),
  })
}

export default { VERSION, submitPaperScaleOrder }
