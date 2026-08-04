import { PAPER_EXECUTION_STAGES, evaluatePaperExecutionStageAccess } from './paper_execution_stage_promotion_lock.mjs'
import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { buildPaperAutoOrderIdentity } from './paper_auto_execution_order_identity.mjs'
import { runPaperAutoExecutionReconciliation } from './paper_auto_execution_reconciliation_runner.mjs'
import { submitPaperAutoOrder } from './paper_auto_execution_submission_boundary.mjs'

export const VERSION = 'paper_auto_execution_orchestrator_v1'

const clean = (value) => String(value ?? '').trim()
const enabled = (env, name) => clean(env?.[name]) === '1'
const upper = (value) => clean(value).toUpperCase()

function safety(extra = {}) {
  return Object.freeze({
    paperOnly: true,
    disabledByDefault: true,
    serverIntegrated: false,
    automaticStartAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
    cancellationAllowed: false,
    ...extra,
  })
}

function chooseCandidate(snapshot = {}) {
  const candidates = Array.isArray(snapshot?.candidates) ? snapshot.candidates : []
  return candidates
    .filter((candidate) => upper(candidate.state ?? candidate.resultState ?? candidate.decision) === 'ENTER')
    .filter((candidate) => candidate.buyRecommendation === true)
    .filter((candidate) => candidate.blocked !== true)
    .filter((candidate) => !Array.isArray(candidate.blockers) || candidate.blockers.length === 0)
    .sort((a, b) => {
      const scoreA = Number(a.score ?? a.readonlyPotentialScore)
      const scoreB = Number(b.score ?? b.readonlyPotentialScore)
      if (Number.isFinite(scoreA) || Number.isFinite(scoreB)) {
        const delta = (Number.isFinite(scoreB) ? scoreB : -Infinity) - (Number.isFinite(scoreA) ? scoreA : -Infinity)
        if (delta) return delta
      }
      return upper(a.symbol).localeCompare(upper(b.symbol))
    })[0] ?? null
}

export function createPaperAutoExecutionOrchestrator({
  lifecycleStore,
  getScanSnapshot,
  getAccountSnapshot,
  getHistoricalOrders = async () => [],
  submitPaperOrder,
  readStageState,
  env = process.env,
  now = () => Date.now(),
} = {}) {
  if (!lifecycleStore || typeof lifecycleStore.load !== 'function' || typeof lifecycleStore.create !== 'function' || typeof lifecycleStore.transition !== 'function') {
    throw new Error('paper_auto_orchestrator_lifecycle_store_required')
  }

  let running = false
  let cycles = 0
  let lastResult = null
  let lastError = null

  const orchestrationEnabled = () => enabled(env, 'PAPER_AUTO_ORCHESTRATOR_ENABLED')
  const automaticEntryEnabled = () => enabled(env, 'PAPER_AUTO_ENTER_ENABLED')
  const automaticExitEnabled = () => enabled(env, 'PAPER_AUTO_EXIT_ENABLED')

  const stageAccess = () => evaluatePaperExecutionStageAccess(PAPER_EXECUTION_STAGES.AUTOMATIC, {
    state: typeof readStageState === 'function' ? readStageState() : undefined,
  })

  const diagnostics = () => Object.freeze({
    ok: true,
    version: VERSION,
    running,
    cycles,
    orchestrationEnabled: orchestrationEnabled(),
    automaticEntryEnabled: automaticEntryEnabled(),
    automaticExitEnabled: automaticExitEnabled(),
    stageAccess: stageAccess(),
    lifecycle: lifecycleStore.load(),
    lastResult,
    lastError,
    safety: safety(),
  })

  const runOnce = async () => {
    cycles += 1
    try {
      const access = stageAccess()
      if (!orchestrationEnabled()) {
        lastResult = Object.freeze({ status: 'DISABLED_BY_ENV', changed: false, blockers: Object.freeze(['paper_auto_orchestrator_not_enabled']), safety: safety() })
        return diagnostics()
      }
      if (!access.allowed) {
        lastResult = Object.freeze({ status: 'BLOCKED_STAGE_LOCKED', changed: false, blockers: access.reasons, safety: safety() })
        return diagnostics()
      }

      let lifecycle = lifecycleStore.load()
      if (!lifecycle) {
        if (!automaticEntryEnabled()) {
          lastResult = Object.freeze({ status: 'BLOCKED_AUTOMATIC_ENTRY_DISABLED', changed: false, blockers: Object.freeze(['paper_auto_enter_not_enabled']), safety: safety() })
          return diagnostics()
        }
        if (typeof getScanSnapshot !== 'function') {
          lastResult = Object.freeze({ status: 'BLOCKED_SCAN_SNAPSHOT_REQUIRED', changed: false, blockers: Object.freeze(['scan_snapshot_dependency_required']), safety: safety() })
          return diagnostics()
        }
        const scanSnapshot = await getScanSnapshot()
        const candidate = chooseCandidate(scanSnapshot)
        if (!candidate?.symbol) {
          lastResult = Object.freeze({ status: 'NO_ELIGIBLE_CANDIDATE', changed: false, blockers: Object.freeze(['eligible_enter_candidate_required']), safety: safety() })
          return diagnostics()
        }
        lifecycle = lifecycleStore.create({
          selectedSymbol: candidate.symbol,
          scannerEvidence: {
            observedAt: scanSnapshot?.observedAt ?? null,
            symbol: upper(candidate.symbol),
            state: upper(candidate.state ?? candidate.resultState ?? candidate.decision),
            score: Number.isFinite(Number(candidate.score ?? candidate.readonlyPotentialScore)) ? Number(candidate.score ?? candidate.readonlyPotentialScore) : null,
          },
        })
        const enterIdentity = buildPaperAutoOrderIdentity({
          lifecycleId: lifecycle.lifecycleId,
          phase: 'enter',
          symbol: lifecycle.selectedSymbol,
          quantity: 1,
          side: 'buy',
        })
        const enterSubmissionEnabled =
          enabled(env, 'PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED') &&
          enabled(env, 'PAPER_AUTO_ENTER_SUBMISSION_ENABLED') &&
          typeof submitPaperOrder === 'function'
        const submission = enterSubmissionEnabled
          ? await submitPaperAutoOrder({ lifecycleStore, phase: 'enter', quantity: 1, submitPaperOrder, env })
          : null
        lastResult = Object.freeze({
          status: submission?.status ?? 'LIFECYCLE_CREATED_ORDER_SUBMISSION_LOCKED',
          changed: true,
          lifecycle: submission?.lifecycle ?? lifecycle,
          enterIdentity,
          submission,
          blockers: Object.freeze(submission ? [...(submission.blockers ?? [])] : ['broker_submission_not_implemented', 'paper_auto_execution_remains_locked']),
          safety: safety({
            deterministicIdentityPrepared: true,
            brokerContactAllowed: submission?.safety?.brokerContactAllowed === true,
            orderPlacementAllowed: submission?.safety?.orderPlacementAllowed === true,
            accountMutationAllowed: submission?.safety?.accountMutationAllowed === true,
            reconciliationRequired: submission?.safety?.reconciliationRequired === true,
          }),
        })
        return diagnostics()
      }

      if (typeof getAccountSnapshot !== 'function') {
        lastResult = Object.freeze({ status: 'BLOCKED_ACCOUNT_SNAPSHOT_REQUIRED', changed: false, blockers: Object.freeze(['account_snapshot_dependency_required']), safety: safety() })
        return diagnostics()
      }

      const [accountSnapshot, historicalOrders] = await Promise.all([
        getAccountSnapshot(),
        typeof getHistoricalOrders === 'function' ? getHistoricalOrders() : [],
      ])
      const reconciliation = await runPaperAutoExecutionReconciliation({
        lifecycleStore,
        accountSnapshot,
        historicalOrders,
        nowMs: Number(now()),
      })
      lifecycle = reconciliation.lifecycle

      if (lifecycle?.state === S.POSITION_CONFIRMED) {
        lifecycle = lifecycleStore.transition(S.MONITORING)
      }

      let exitIdentity = null
      if (lifecycle?.state === S.MONITORING && automaticExitEnabled()) {
        lifecycleStore.assertExitTarget({ symbol: lifecycle.selectedSymbol, quantity: lifecycle.filledQuantity })
        exitIdentity = buildPaperAutoOrderIdentity({
          lifecycleId: lifecycle.lifecycleId,
          phase: 'exit',
          symbol: lifecycle.selectedSymbol,
          quantity: lifecycle.filledQuantity,
          side: 'sell',
        })
      }

      const exitSubmissionEnabled = Boolean(exitIdentity) && enabled(env, 'PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED') && enabled(env, 'PAPER_AUTO_EXIT_SUBMISSION_ENABLED') && typeof submitPaperOrder === 'function'
      let exitSubmission = null
      if (exitSubmissionEnabled) {
        exitSubmission = await submitPaperAutoOrder({
          lifecycleStore,
          phase: 'exit',
          quantity: lifecycle.filledQuantity,
          submitPaperOrder,
          env,
        })
        lifecycle = exitSubmission.lifecycle
      }

      lastResult = Object.freeze({
        status: exitSubmission?.status ?? (exitIdentity ? 'MONITORING_EXIT_IDENTITY_PREPARED_SUBMISSION_LOCKED' : reconciliation.status),
        changed: reconciliation.changed || lifecycle?.state === S.MONITORING || Boolean(exitSubmission),
        lifecycle,
        reconciliation,
        exitIdentity,
        submission: exitSubmission,
        blockers: Object.freeze(exitSubmission ? [...(exitSubmission.blockers ?? [])] : exitIdentity ? ['broker_submission_not_implemented', 'paper_auto_execution_remains_locked'] : [...(reconciliation.blockers ?? [])]),
        safety: safety({
          deterministicExitIdentityPrepared: Boolean(exitIdentity),
          readOnlyReconciliationOnly: !exitSubmission,
          brokerContactAllowed: exitSubmission?.safety?.brokerContactAllowed === true,
          orderPlacementAllowed: exitSubmission?.safety?.orderPlacementAllowed === true,
          accountMutationAllowed: exitSubmission?.safety?.accountMutationAllowed === true,
          reconciliationRequired: exitSubmission?.safety?.reconciliationRequired === true,
        }),
      })
    } catch (error) {
      lastError = error?.message ?? String(error)
      lastResult = Object.freeze({ status: 'ORCHESTRATOR_ERROR_FAIL_CLOSED', changed: false, blockers: Object.freeze([lastError]), safety: safety() })
    }
    return diagnostics()
  }

  const start = () => {
    running = false
    lastResult = Object.freeze({ status: 'AUTOMATIC_START_PROHIBITED', changed: false, blockers: Object.freeze(['automatic_start_not_allowed']), safety: safety() })
    return diagnostics()
  }

  const stop = () => {
    running = false
    return diagnostics()
  }

  return Object.freeze({ start, stop, runOnce, diagnostics })
}

export default { VERSION, createPaperAutoExecutionOrchestrator }
