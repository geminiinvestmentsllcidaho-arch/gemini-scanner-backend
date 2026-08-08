import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { createPaperAutoExecutionOrchestrator } from './paper_auto_execution_orchestrator.mjs'
import { submitPaperAutoOrder } from './paper_auto_execution_submission_boundary.mjs'

export const VERSION = 'paper_auto_execution_composition_v1'
const on = (env, key) => String(env?.[key] ?? '').trim() === '1'
const safe = (extra = {}) => Object.freeze({
  paperOnly: true, disabledByDefault: true, serverIntegrated: false,
  automaticStartAllowed: false, directBrokerImplementation: false,
  liveTradingAllowed: false, ...extra,
})

export function createPaperAutoExecutionComposition(options = {}) {
  const { lifecycleStore, submitPaperOrder, env = process.env } = options
  if (!lifecycleStore?.load) throw new Error('paper_auto_composition_lifecycle_store_required')
  const orchestrator = createPaperAutoExecutionOrchestrator(options)
  let cycles = 0
  let lastResult = null

  const diagnostics = () => Object.freeze({
    ok: true, version: VERSION, cycles, lifecycle: lifecycleStore.load(), lastResult,
    safety: safe({ brokerContactAllowed: false, orderPlacementAllowed: false, accountMutationAllowed: false }),
  })

  const runOnce = async () => {
    cycles += 1
    if (!on(env, 'PAPER_AUTO_COMPOSITION_ENABLED')) {
      lastResult = Object.freeze({ status: 'COMPOSITION_DISABLED_BY_ENV', adapterInvoked: false })
      return diagnostics()
    }
    const orchestration = await orchestrator.runOnce()
    const orchestratorSubmission = orchestration.lastResult?.submission ?? null
    if (orchestratorSubmission) {
      lastResult = Object.freeze({ status: `COMPOSITION_${orchestratorSubmission.status}`, adapterInvoked: orchestratorSubmission.adapterInvoked === true, phase: orchestratorSubmission.identity?.phase ?? null, orchestration, submission: orchestratorSubmission })
      return diagnostics()
    }
    const lifecycle = lifecycleStore.load()
    let phase = null
    let quantity
    if (lifecycle?.state === S.CANDIDATE_SELECTED &&
        orchestration.lastResult?.status === 'LIFECYCLE_CREATED_ORDER_SUBMISSION_LOCKED' &&
        on(env, 'PAPER_AUTO_ENTER_ENABLED')) {
      phase = 'enter'
      quantity = 1
    } else if (lifecycle?.state === S.MONITORING &&
               orchestration.lastResult?.status === 'MONITORING_EXIT_IDENTITY_PREPARED_SUBMISSION_LOCKED' &&
               on(env, 'PAPER_AUTO_EXIT_ENABLED')) {
      phase = 'exit'
      quantity = lifecycle.filledQuantity
    }

    if (!phase) {
      lastResult = Object.freeze({ status: 'COMPOSITION_NO_SUBMISSION_ELIGIBLE', adapterInvoked: false, orchestration })
      return diagnostics()
    }

    const submission = await submitPaperAutoOrder({
      lifecycleStore, phase, quantity, submitPaperOrder, env,
    })
    lastResult = Object.freeze({
      status: `COMPOSITION_${submission.status}`,
      adapterInvoked: submission.adapterInvoked === true,
      phase, orchestration, submission,
    })
    return diagnostics()
  }

  const start = () => {
    lastResult = Object.freeze({ status: 'COMPOSITION_AUTOMATIC_START_PROHIBITED', adapterInvoked: false })
    return diagnostics()
  }

  return Object.freeze({ runOnce, start, diagnostics })
}

export default { VERSION, createPaperAutoExecutionComposition }
