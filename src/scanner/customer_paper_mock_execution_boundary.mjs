import { consumePaperAutoEnterOnlyRunOnceAuthorization } from './paper_auto_execution_enter_only_run_once_authorization.mjs'
import { consumePaperAutoExitOnlyRunOnceAuthorization } from './paper_auto_execution_exit_only_run_once_authorization.mjs'
import { submitPaperAutoOrder } from './paper_auto_execution_submission_boundary.mjs'
import { reconcilePaperAutoExecution } from './paper_auto_execution_reconciliation.mjs'

export const VERSION = 'customer_paper_mock_execution_boundary_v2'

export async function exerciseCustomerPaperMockExecutionBoundary({ handoff, lifecycleStore, nowMs = Date.now() } = {}) {
  if (!handoff?.ok || handoff.status !== 'READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY') throw new Error('mock_boundary_handoff_required')
  if (!lifecycleStore?.load || !lifecycleStore?.transition) throw new Error('mock_boundary_lifecycle_store_required')
  const mode = String(handoff.mode ?? '').toUpperCase()
  if (!['ENTER', 'EXIT'].includes(mode)) throw new Error('mock_boundary_mode_invalid')
  const auth = {
    ...handoff.authorization,
    env: mode === 'ENTER'
      ? { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' }
      : { PAPER_AUTO_EXIT_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  }
  const consumed = mode === 'ENTER'
    ? consumePaperAutoEnterOnlyRunOnceAuthorization(auth, Number(nowMs))
    : consumePaperAutoExitOnlyRunOnceAuthorization(auth, Number(nowMs))
  if (!consumed.ok || consumed.consumed !== true) throw new Error('mock_boundary_authorization_consume_failed')

  const mockAdapter = async (order, metadata) => Object.freeze({
    orderSubmitted: true,
    brokerOrderId: `mock-${metadata.phase}-${order.clientOrderId}`,
    status: 'accepted_mock_only',
    mockOnly: true,
  })
  const submission = await submitPaperAutoOrder({
    lifecycleStore,
    phase: mode.toLowerCase(),
    quantity: handoff.order.qty,
    submitPaperOrder: mockAdapter,
    env: {
      PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
      PAPER_AUTO_ENTER_SUBMISSION_ENABLED: mode === 'ENTER' ? '1' : '0',
      PAPER_AUTO_EXIT_SUBMISSION_ENABLED: mode === 'EXIT' ? '1' : '0',
    },
  })

  const submittedLifecycle = lifecycleStore.load()
  const orderId = mode === 'ENTER' ? submittedLifecycle.enterBrokerOrderId : submittedLifecycle.exitBrokerOrderId
  const clientOrderId = mode === 'ENTER' ? submittedLifecycle.enterClientOrderId : submittedLifecycle.exitClientOrderId
  const mockOrders = [Object.freeze({
    id: orderId,
    client_order_id: clientOrderId,
    symbol: submittedLifecycle.selectedSymbol,
    side: mode === 'ENTER' ? 'buy' : 'sell',
    status: 'filled',
    filled_qty: Number(handoff.order.qty),
    filled_avg_price: Number(handoff.mockFillPrice ?? 1),
  })]
  const mockPositions = mode === 'ENTER'
    ? [Object.freeze({
        asset_id: `mock-position-${submittedLifecycle.selectedSymbol}`,
        symbol: submittedLifecycle.selectedSymbol,
        qty: Number(handoff.order.qty),
        avg_entry_price: Number(handoff.mockFillPrice ?? 1),
      })]
    : []

  const reconciliation = reconcilePaperAutoExecution({
    lifecycle: submittedLifecycle,
    orders: mockOrders,
    positions: mockPositions,
  })
  let finalLifecycle = submittedLifecycle
  if (reconciliation.nextState !== submittedLifecycle.state) {
    finalLifecycle = lifecycleStore.transition(reconciliation.nextState, reconciliation.patch)
  }
  if (mode === 'ENTER' && finalLifecycle.state === 'POSITION_CONFIRMED') {
    finalLifecycle = lifecycleStore.transition('MONITORING')
  }
  const expectedState = mode === 'ENTER' ? 'MONITORING' : 'ROUND_TRIP_COMPLETED'
  if (finalLifecycle.state !== expectedState) throw new Error(`mock_boundary_reconciliation_incomplete:${finalLifecycle.state}`)

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: 'MOCK_FULL_LIFECYCLE_COMPLETED_NO_BROKER',
    authorization: consumed.record,
    submission,
    reconciliation,
    mockObservations: Object.freeze({ orders: Object.freeze(mockOrders), positions: Object.freeze(mockPositions) }),
    lifecycle: finalLifecycle,
    safety: Object.freeze({ paperOnly: true, mockOnly: true, syntheticReconciliationOnly: true, brokerContactAllowed: false, realOrderPlacementAllowed: false, accountMutationAllowed: false }),
  })
}

export default { VERSION, exerciseCustomerPaperMockExecutionBoundary }
