import { adaptPaperAutoExecutionSnapshot } from './paper_auto_execution_snapshot_adapter.mjs'
import { reconcilePaperAutoExecution } from './paper_auto_execution_reconciliation.mjs'

export const VERSION = 'paper_auto_execution_reconciliation_runner_v1'

function normalizeSafety(safety = {}) {
  return Object.freeze({
    ...safety,
    paperOnly: true,
    readOnlyBrokerInput: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
  })
}

export async function runPaperAutoExecutionReconciliation({
  lifecycleStore,
  accountSnapshot,
  historicalOrders = [],
  nowMs = Date.now(),
  maxAgeMs = 120_000,
} = {}) {
  if (!lifecycleStore || typeof lifecycleStore.load !== 'function' || typeof lifecycleStore.transition !== 'function') {
    throw new Error('paper_auto_reconciliation_store_required')
  }

  const lifecycle = lifecycleStore.load()
  if (!lifecycle) {
    return Object.freeze({
      ok: true,
      version: VERSION,
      status: 'NO_ACTIVE_LIFECYCLE',
      changed: false,
      lifecycle: null,
      blockers: Object.freeze([]),
      safety: Object.freeze({
        paperOnly: true,
        readOnlyBrokerInput: true,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
        liveTradingAllowed: false,
      }),
    })
  }

  const snapshot = adaptPaperAutoExecutionSnapshot({
    accountSnapshot,
    historicalOrders,
    nowMs,
    maxAgeMs,
  })

  if (!snapshot.ready) {
    return Object.freeze({
      ok: true,
      version: VERSION,
      status: 'BLOCKED_SNAPSHOT_NOT_READY',
      changed: false,
      lifecycle,
      blockers: snapshot.blockers,
      snapshot,
      safety: normalizeSafety(snapshot.safety),
    })
  }

  const reconciliation = reconcilePaperAutoExecution({
    lifecycle,
    orders: snapshot.orders,
    positions: snapshot.positions,
  })

  if (reconciliation.nextState === lifecycle.state) {
    return Object.freeze({
      ok: true,
      version: VERSION,
      status: reconciliation.resolved ? 'RECONCILED_NO_STATE_CHANGE' : 'UNRESOLVED_NEEDS_RECONCILIATION',
      changed: false,
      lifecycle,
      blockers: reconciliation.blockers,
      snapshot,
      reconciliation,
      safety: normalizeSafety(snapshot.safety),
    })
  }

  const nextLifecycle = lifecycleStore.transition(
    reconciliation.nextState,
    reconciliation.patch,
  )

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: reconciliation.resolved ? 'RECONCILED_STATE_UPDATED' : 'UNRESOLVED_NEEDS_RECONCILIATION',
    changed: true,
    lifecycle: nextLifecycle,
    blockers: reconciliation.blockers,
    snapshot,
    reconciliation,
    safety: normalizeSafety(snapshot.safety),
  })
}

export default { VERSION, runPaperAutoExecutionReconciliation }
