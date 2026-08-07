import { consumePaperAutoEnterOnlyRunOnceAuthorization } from './paper_auto_execution_enter_only_run_once_authorization.mjs'
import { consumePaperAutoExitOnlyRunOnceAuthorization } from './paper_auto_execution_exit_only_run_once_authorization.mjs'
import { submitPaperAutoOrder } from './paper_auto_execution_submission_boundary.mjs'

export const VERSION = 'customer_paper_mock_execution_boundary_v1'

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
  return Object.freeze({
    ok: true,
    version: VERSION,
    status: 'MOCK_EXECUTION_BOUNDARY_EXERCISED_NO_BROKER',
    authorization: consumed.record,
    submission,
    lifecycle: lifecycleStore.load(),
    safety: Object.freeze({ paperOnly: true, mockOnly: true, brokerContactAllowed: false, realOrderPlacementAllowed: false, accountMutationAllowed: false }),
  })
}

export default { VERSION, exerciseCustomerPaperMockExecutionBoundary }
