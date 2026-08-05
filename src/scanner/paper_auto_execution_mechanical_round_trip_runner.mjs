import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { createPaperAutoExecutionComposition } from './paper_auto_execution_composition.mjs'

export const VERSION = 'paper_auto_execution_mechanical_round_trip_runner_v1'

const terminal = new Set([S.ROUND_TRIP_COMPLETED, S.FAILED_NEEDS_REVIEW])
const bounded = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback))

export function createPaperAutoExecutionMechanicalRoundTripRunner(options = {}) {
  const { lifecycleStore, wait = async () => {}, maxCycles = 40, pollIntervalMs = 2000 } = options
  if (!lifecycleStore?.load) throw new Error('paper_auto_mechanical_runner_lifecycle_store_required')
  if (typeof wait !== 'function') throw new Error('paper_auto_mechanical_runner_wait_required')
  const composition = createPaperAutoExecutionComposition(options)
  const cycleLimit = bounded(maxCycles, 40, 2, 120)
  const intervalMs = bounded(pollIntervalMs, 2000, 250, 30000)

  const run = async () => {
    const timeline = []
    for (let cycle = 1; cycle <= cycleLimit; cycle += 1) {
      const result = await composition.runOnce()
      const lifecycle = lifecycleStore.load()
      timeline.push(Object.freeze({
        cycle,
        at: new Date().toISOString(),
        status: result.lastResult?.status ?? null,
        phase: result.lastResult?.phase ?? null,
        state: lifecycle?.state ?? null,
        symbol: lifecycle?.selectedSymbol ?? null,
        filledQuantity: lifecycle?.filledQuantity ?? null,
        enterClientOrderId: lifecycle?.enterClientOrderId ?? null,
        exitClientOrderId: lifecycle?.exitClientOrderId ?? null,
      }))
      if (lifecycle?.state === S.ROUND_TRIP_COMPLETED) {
        return Object.freeze({
          ok: true, version: VERSION, status: 'MECHANICAL_ROUND_TRIP_COMPLETED',
          completed: true, cycles: cycle, lifecycle,
          timeline: Object.freeze(timeline),
          safety: Object.freeze({
            paperOnly: true, topEligibleCandidateOnly: true,
            strategyExitCriteriaRequired: false, exactPositionExitRequired: true,
            oneLifecycleOnly: true, blindRetryAllowed: false,
            automaticStartAllowed: false, scheduledExecutionAllowed: false,
            liveTradingAllowed: false,
          }),
        })
      }
      if (terminal.has(lifecycle?.state)) break
      if (cycle < cycleLimit) await wait(intervalMs)
    }
    const lifecycle = lifecycleStore.load()
    return Object.freeze({
      ok: false, version: VERSION,
      status: lifecycle?.state === S.FAILED_NEEDS_REVIEW
        ? 'MECHANICAL_ROUND_TRIP_FAILED_NEEDS_REVIEW'
        : 'MECHANICAL_ROUND_TRIP_INCOMPLETE_FAIL_CLOSED',
      completed: false, cycles: timeline.length, lifecycle,
      timeline: Object.freeze(timeline),
      blockers: Object.freeze([
        lifecycle?.state === S.FAILED_NEEDS_REVIEW
          ? 'lifecycle_failed_needs_review'
          : 'bounded_round_trip_not_completed',
      ]),
      safety: Object.freeze({
        paperOnly: true, failClosed: true, oneLifecycleOnly: true,
        blindRetryAllowed: false, additionalEntryAllowed: false,
        automaticStartAllowed: false, scheduledExecutionAllowed: false,
        liveTradingAllowed: false,
      }),
    })
  }

  return Object.freeze({ run })
}

export default { VERSION, createPaperAutoExecutionMechanicalRoundTripRunner }
