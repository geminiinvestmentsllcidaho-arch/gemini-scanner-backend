import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { createPaperAutoExecutionComposition } from './paper_auto_execution_composition.mjs'
import { runPaperAutoExecutionReconciliation } from './paper_auto_execution_reconciliation_runner.mjs'

export const VERSION = 'paper_auto_execution_mechanical_enter_only_runner_v1'
const success = new Set([S.POSITION_CONFIRMED, S.MONITORING])
const failure = new Set([S.FAILED_NEEDS_REVIEW, S.UNRESOLVED_NEEDS_RECONCILIATION])
const bounded = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback))

export function createPaperAutoExecutionMechanicalEnterOnlyRunner(options = {}) {
  const {
    lifecycleStore,
    wait = async () => {},
    maxCycles = 40,
    pollIntervalMs = 2000,
    getAccountSnapshot,
    getHistoricalOrders = async () => [],
    now = () => Date.now(),
  } = options
  if (!lifecycleStore?.load) throw new Error('paper_auto_enter_only_runner_lifecycle_store_required')
  if (typeof wait !== 'function') throw new Error('paper_auto_enter_only_runner_wait_required')
  const composition = createPaperAutoExecutionComposition(options)
  const cycleLimit = bounded(maxCycles, 40, 2, 120)
  const intervalMs = bounded(pollIntervalMs, 2000, 250, 30000)

  const run = async () => {
    const timeline = []
    for (let cycle = 1; cycle <= cycleLimit; cycle += 1) {
      const result = await composition.runOnce()
      let lifecycle = lifecycleStore.load()
      let reconciliation = null
      if ([S.ENTER_OPEN, S.ENTER_UNKNOWN, S.ENTER_PARTIALLY_FILLED].includes(lifecycle?.state) &&
          typeof getAccountSnapshot === 'function') {
        const [accountSnapshot, historicalOrders] = await Promise.all([
          getAccountSnapshot(),
          typeof getHistoricalOrders === 'function' ? getHistoricalOrders() : [],
        ])
        reconciliation = await runPaperAutoExecutionReconciliation({
          lifecycleStore,
          accountSnapshot,
          historicalOrders,
          nowMs: Number(now()),
        })
        lifecycle = reconciliation.lifecycle
        if (lifecycle?.state === S.POSITION_CONFIRMED) {
          lifecycle = lifecycleStore.transition(S.MONITORING)
        }
      }
      timeline.push(Object.freeze({ cycle, status: reconciliation?.status ?? result.lastResult?.status ?? null, state: lifecycle?.state ?? null, symbol: lifecycle?.selectedSymbol ?? null, enterClientOrderId: lifecycle?.enterClientOrderId ?? null, exitClientOrderId: lifecycle?.exitClientOrderId ?? null }))
      if (success.has(lifecycle?.state)) return Object.freeze({ ok: true, version: VERSION, status: 'MECHANICAL_ENTER_ONLY_COMPLETED', completed: true, cycles: cycle, lifecycle, timeline: Object.freeze(timeline), safety: Object.freeze({ paperOnly: true, enterOnly: true, exitAuthorized: false, exitSubmissionEnabled: false, oneLifecycleOnly: true, additionalEntryAllowed: false, automaticStartAllowed: false, scheduledExecutionAllowed: false, liveTradingAllowed: false }) })
      if (failure.has(lifecycle?.state)) break
      if (cycle < cycleLimit) await wait(intervalMs)
    }
    const lifecycle = lifecycleStore.load()
    return Object.freeze({ ok: false, version: VERSION, status: 'MECHANICAL_ENTER_ONLY_INCOMPLETE_FAIL_CLOSED', completed: false, cycles: timeline.length, lifecycle, timeline: Object.freeze(timeline), blockers: Object.freeze([failure.has(lifecycle?.state) ? 'lifecycle_failed_needs_review' : 'bounded_enter_only_not_completed']), safety: Object.freeze({ paperOnly: true, enterOnly: true, exitAuthorized: false, exitSubmissionEnabled: false, failClosed: true, blindRetryAllowed: false, additionalEntryAllowed: false, automaticStartAllowed: false, scheduledExecutionAllowed: false, liveTradingAllowed: false }) })
  }
  return Object.freeze({ run })
}

export default { VERSION, createPaperAutoExecutionMechanicalEnterOnlyRunner }
