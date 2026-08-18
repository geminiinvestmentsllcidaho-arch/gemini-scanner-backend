import fs from 'node:fs'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { preflightPaperScaleAction } from './paper_auto_execution_scale_action_model.mjs'
import { PaperAutoExecutionScaleActionStore } from './paper_auto_execution_scale_action_store.mjs'
import { arbitratePaperPositionMutation } from './paper_auto_execution_position_mutation_arbiter.mjs'
import { arbitratePaperAutomaticAction } from './paper_auto_execution_action_arbitration.mjs'
import { submitPaperScaleOrder } from './paper_auto_execution_scale_submission_boundary.mjs'
import { reconcilePaperScaleAction } from './paper_auto_execution_scale_reconciliation_service.mjs'
import { derivePaperPositionMutationLockFile, acquirePaperPositionMutationLock, releasePaperPositionMutationLock } from './paper_auto_execution_position_mutation_lock.mjs'
import { easternDateKey } from './alpaca_premarket_shared_scan_cache.mjs'
import { evaluatePaperPortfolioCapitalGovernor } from './paper_auto_execution_portfolio_capital_governor.mjs'

export const VERSION = 'paper_auto_execution_scale_runner_v1'
const clean = v => String(v ?? '').trim()
const upper = v => clean(v).toUpperCase()
const on = (env, key) => clean(env?.[key]) === '1'
const whole = v => {
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export function derivePaperScaleActionFile(lifecycleFile) {
  const file = clean(lifecycleFile)
  if (!file) throw new Error('paper_scale_runner_lifecycle_file_required')
  const resolved = path.resolve(file)
  const base = path.basename(resolved)
  if (!base.endsWith('.json')) throw new Error('paper_scale_runner_lifecycle_json_required')
  return path.join(path.dirname(resolved), `${base.slice(0, -5)}.scale_action.json`)
}
const nextScaleActionSequence = scaleActionStore => {
  const last = scaleActionStore.load()?.lastSequence ?? 0
  if (!Number.isSafeInteger(last) || last < 0) throw new Error('paper_scale_runner_sidecar_sequence_invalid')
  return last + 1
}

export function createPaperAutoExecutionScaleRunner(options = {}) {
  const env = options.env ?? process.env
  const getLifecycleFile = options.getLifecycleFile ?? (() => clean(env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH ?? env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH))
  const fetchAccount = options.fetchAccount
  const fetchOrderByClientOrderId = options.fetchOrderByClientOrderId
  const fetchOwnedMonitor = options.fetchOwnedMonitor
  const fetchMarketClock = options.fetchMarketClock
  const getPremarketBaseline = options.getPremarketBaseline
  const submitPaperOrder = options.submitPaperOrder
  const getScaleActionFile = options.getScaleActionFile ?? derivePaperScaleActionFile
  const now = options.now ?? Date.now
  let inFlight = null
  let cycles = 0
  let submissions = 0
  let reconciliations = 0
  let lastStatus = 'NOT_RUN'
  let lastError = null
  let lastIdentity = null
  let lastLifecycle = null
  let lastSubmission = null
  let lastReconciliation = null
  let lastPortfolioCapitalGovernor = null

  const diagnostics = () => Object.freeze({
    ok: true, version: VERSION,
    enabled: on(env, 'PAPER_AUTO_SCALE_RUNNER_ENABLED'),
    scaleInEnabled: on(env, 'PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED'),
    scaleOutEnabled: on(env, 'PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED'),
    cycles, submissions, reconciliations, lastStatus, lastError,
    lastIdentity, lastLifecycle, lastSubmission, lastReconciliation, lastPortfolioCapitalGovernor,
    safety: Object.freeze({
      paperOnly: true, disabledByDefault: true, exactActiveLifecycleOnly: true,
      injectedBrokerInterfacesOnly: true, canonicalLifecycleStateMachineUnchanged: true,
      monitoringPatchOnlyAfterExactFill: true, blindRetryAllowed: false,
      cancellationAllowed: false,
      serverIntegrated: options.serverIntegrated === true, automaticStartAllowed: options.automaticStartAllowed === true, liveTradingAllowed: false,
    }),
  })
  const finish = (status, lifecycle = null) => {
    lastStatus = status
    lastLifecycle = lifecycle
    return diagnostics()
  }

  async function cycle({ action, targetQuantity } = {}) {
    cycles += 1
    lastError = null
    lastSubmission = null
    lastReconciliation = null
    if (!on(env, 'PAPER_AUTO_SCALE_RUNNER_ENABLED')) return finish('PAPER_SCALE_RUNNER_DISABLED_BY_ENV')
    const file = clean(await getLifecycleFile?.())
    if (!file) return finish('ACTIVE_LIFECYCLE_PATH_REQUIRED')
    if (!fs.existsSync(file)) return finish('ACTIVE_LIFECYCLE_FILE_MISSING')
    const store = new PaperAutoExecutionLifecycleStore({ filePath: file })
    let lifecycle = store.load()
    if (!lifecycle || lifecycle.state !== 'MONITORING') return finish('MONITORING_LIFECYCLE_REQUIRED', lifecycle)
    const scaleActionFile = clean(await getScaleActionFile?.(file))
    if (!scaleActionFile) return finish('SCALE_ACTION_FILE_REQUIRED', lifecycle)
    const scaleActionStore = new PaperAutoExecutionScaleActionStore({ filePath: scaleActionFile, clock: now })
    if (scaleActionStore.mutationLocked()) {
      if (typeof fetchOrderByClientOrderId !== 'function') return finish('EXACT_SCALE_ORDER_READER_REQUIRED', lifecycle)
      if (typeof fetchAccount !== 'function') return finish('FRESH_PAPER_ACCOUNT_READER_REQUIRED', lifecycle)
      reconciliations += 1
      const recovery = await reconcilePaperScaleAction({
        lifecycleStore: store,
        scaleActionStore,
        fetchOrderByClientOrderId,
        fetchAccount,
        now,
      })
      lastReconciliation = recovery
      lifecycle = recovery?.lifecycle ?? store.load()
      return finish(recovery?.status ?? 'PAPER_SCALE_RECOVERY_UNRESOLVED', lifecycle)
    }
    const a = clean(action).toLowerCase()
    if (!['scale_in', 'scale_out'].includes(a)) return finish('PAPER_SCALE_ACTION_REQUIRED', lifecycle)
    const directionEnabled = a === 'scale_in'
      ? on(env, 'PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED')
      : on(env, 'PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED')
    if (!directionEnabled) return finish('PAPER_SCALE_DIRECTION_DISABLED_BY_ENV', lifecycle)
    const target = whole(targetQuantity)
    if (target === null) return finish('WHOLE_TARGET_QUANTITY_REQUIRED', lifecycle)
    if (typeof fetchAccount !== 'function') return finish('FRESH_PAPER_ACCOUNT_READER_REQUIRED', lifecycle)
    if (typeof fetchMarketClock !== 'function') return finish('PAPER_MARKET_CLOCK_READER_REQUIRED', lifecycle)
    if (typeof fetchOwnedMonitor !== 'function') return finish('FRESH_OWNED_MONITOR_READER_REQUIRED', lifecycle)
    const clock = await fetchMarketClock()
    if (clock?.ok !== true || clock?.status !== 'connected_readonly') return finish('PAPER_MARKET_CLOCK_REQUIRED', lifecycle)
    if (clock?.marketClock?.isOpen !== true) return finish('PAPER_MARKET_OPEN_REQUIRED', lifecycle)
    const clockObserved = Date.parse(clock?.marketClock?.timestamp ?? '')
    const clockAge = Number(now()) - clockObserved
    if (!Number.isFinite(clockObserved) || !Number.isFinite(clockAge) || clockAge < 0 || clockAge > 30000) {
      return finish('PAPER_MARKET_CLOCK_STALE', lifecycle)
    }
    const before = await fetchAccount()
    if (before?.ok !== true || before?.status !== 'connected_readonly') return finish('FRESH_PAPER_ACCOUNT_REQUIRED', lifecycle)
    const observed = Date.parse(before?.observedAt ?? '')
    const age = Number(now()) - observed
    if (!Number.isFinite(observed) || !Number.isFinite(age) || age < 0 || age > 30000) return finish('FRESH_PAPER_ACCOUNT_STALE', lifecycle)
    if (before?.account?.tradingBlocked === true || before?.account?.accountBlocked === true) return finish('PAPER_ACCOUNT_BLOCKED', lifecycle)
    const symbol = upper(lifecycle.selectedSymbol)
    const monitor = await fetchOwnedMonitor({ paperAccount: before, nowMs: Number(now()) })
    if (monitor?.ok !== true) return finish('FRESH_OWNED_MONITOR_REQUIRED', lifecycle)
    const assessment = (Array.isArray(monitor?.candidates) ? monitor.candidates : []).find(row => upper(row?.symbol) === symbol) ?? null
    if (!assessment) return finish('FRESH_OWNED_ASSESSMENT_REQUIRED', lifecycle)
    if (clean(assessment?.sourceCoverage) !== 'owned_position_symbol_fetch') return finish('FRESH_OWNED_SYMBOL_COVERAGE_REQUIRED', lifecycle)
    const sourceAgeSec = Number(assessment?.sourceAgeSec)
    const configuredMaxAgeSec = Number(assessment?.maxSourceAgeSec ?? assessment?.sourceMaxAgeSec)
    const maxSourceAgeSec = Number.isFinite(configuredMaxAgeSec) && configuredMaxAgeSec >= 0 ? configuredMaxAgeSec : 180
    if (assessment?.sourceStale !== false || !Number.isFinite(sourceAgeSec) || sourceAgeSec < 0 || sourceAgeSec > maxSourceAgeSec) {
      return finish('FRESH_OWNED_STRATEGY_EVIDENCE_REQUIRED', lifecycle)
    }
    const exitRequired = assessment?.ownedExitReviewTriggered === true || upper(assessment?.resultState ?? assessment?.decision) === 'EXIT'
    const scaleOutQualified = assessment?.ownedScaleOutReviewTriggered === true
    const scaleInQualified = assessment?.ownedScaleInReviewTriggered === true
    const actionArbitration = arbitratePaperAutomaticAction({
      lifecycle,
      exitRequired,
      scaleOutQualified,
      scaleInQualified,
    })
    if (actionArbitration?.ok !== true) return finish(actionArbitration?.status ?? 'ACTION_ARBITRATION_FAIL_CLOSED', lifecycle)
    if (exitRequired && actionArbitration?.action !== 'EXIT') return finish(actionArbitration?.status ?? 'ACTION_ARBITRATION_EXIT_FAIL_CLOSED', lifecycle)
    if (!exitRequired) {
      const expectedAction = a === 'scale_out' ? 'SCALE_OUT' : 'SCALE_IN'
      if (actionArbitration?.action !== expectedAction) return finish(actionArbitration?.status ?? 'ACTION_ARBITRATION_SCALE_FAIL_CLOSED', lifecycle)
    }
    const arbitration = arbitratePaperPositionMutation({ lifecycle, scaleActionStore, requestedAction: a, exitRequired })
    if (arbitration?.allow !== true) return finish(arbitration?.status ?? 'POSITION_MUTATION_BLOCKED', lifecycle)
    if (a === 'scale_in') {
      if (assessment?.ownedScaleInReviewTriggered !== true) return finish('FRESH_SCALE_IN_STRATEGY_NOT_QUALIFIED', lifecycle)
      const strategyTarget = whole(assessment?.ownedScaleInTargetQuantity)
      if (strategyTarget === null || strategyTarget !== target) return finish('FRESH_SCALE_IN_TARGET_MISMATCH', lifecycle)
      if (typeof getPremarketBaseline !== 'function') return finish('PREMARKET_CAPITAL_BASELINE_REQUIRED', lifecycle)
      const baseline = await getPremarketBaseline()
      if (baseline?.ok !== true || baseline?.paperOnly !== true || baseline?.readOnly !== true) {
        return finish('PREMARKET_CAPITAL_BASELINE_REQUIRED', lifecycle)
      }
      const currentSessionDate = easternDateKey(Number(now()))
      if (!currentSessionDate || clean(baseline?.sessionDate) !== currentSessionDate) {
        return finish('PREMARKET_CAPITAL_BASELINE_SESSION_MISMATCH', lifecycle)
      }
      const baselineAccountIdentity = clean(baseline?.accountIdentity)
      const actionAccountIdentity = clean(before?.account?.accountIdentity)
      if (!baselineAccountIdentity || !actionAccountIdentity || baselineAccountIdentity !== actionAccountIdentity) {
        return finish('PREMARKET_CAPITAL_BASELINE_ACCOUNT_IDENTITY_MISMATCH', lifecycle)
      }
    } else {
      if (assessment?.ownedScaleOutReviewTriggered !== true) return finish('FRESH_SCALE_OUT_STRATEGY_NOT_QUALIFIED', lifecycle)
      const strategyTarget = whole(assessment?.ownedScaleOutResultingQuantity)
      if (strategyTarget === null || strategyTarget !== target) return finish('FRESH_SCALE_OUT_TARGET_MISMATCH', lifecycle)
    }

    if (!on(env, 'PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED')) return finish('PAPER_SCALE_SUBMISSION_BOUNDARY_DISABLED_BY_ENV', lifecycle)
    if (typeof submitPaperOrder !== 'function') return finish('INJECTED_PAPER_ORDER_ADAPTER_REQUIRED', lifecycle)
    if (typeof fetchOrderByClientOrderId !== 'function') return finish('EXACT_SCALE_ORDER_READER_REQUIRED', lifecycle)

    const position = (Array.isArray(before?.positions) ? before.positions : []).find(row => upper(row?.symbol) === symbol) ?? null
    const actionSequence = nextScaleActionSequence(scaleActionStore)
    const preflight = preflightPaperScaleAction({
      lifecycle,
      brokerPosition: position,
      openOrders: before?.openOrders ?? [],
      action: a,
      targetQuantity: target,
      actionSequence,
    })
    if (preflight?.ok !== true) return finish(preflight?.status ?? 'PAPER_SCALE_PREFLIGHT_BLOCKED', lifecycle)

    const mutationLock = acquirePaperPositionMutationLock({
      lockFile: derivePaperPositionMutationLockFile(file),
      lifecycleId: lifecycle.lifecycleId,
      symbol,
      action: a,
      now,
    })
    if (mutationLock?.ok !== true) return finish(mutationLock?.status ?? 'POSITION_MUTATION_LOCK_REQUIRED', lifecycle)
    try {
      lifecycle = store.load()
      if (!lifecycle || lifecycle.state !== 'MONITORING' || upper(lifecycle.selectedSymbol) !== symbol) return finish('POST_LOCK_LIFECYCLE_CHANGED', lifecycle)
      if (scaleActionStore.mutationLocked()) return finish('POST_LOCK_SCALE_ACTION_LOCKED', lifecycle)
      const lockedClock = await fetchMarketClock()
      if (lockedClock?.ok !== true || lockedClock?.status !== 'connected_readonly') return finish('POST_LOCK_PAPER_MARKET_CLOCK_REQUIRED', lifecycle)
      if (lockedClock?.marketClock?.isOpen !== true) return finish('POST_LOCK_PAPER_MARKET_OPEN_REQUIRED', lifecycle)
      const lockedClockObserved = Date.parse(lockedClock?.marketClock?.timestamp ?? '')
      const lockedClockAge = Number(now()) - lockedClockObserved
      if (!Number.isFinite(lockedClockObserved) || !Number.isFinite(lockedClockAge) || lockedClockAge < 0 || lockedClockAge > 30000) return finish('POST_LOCK_PAPER_MARKET_CLOCK_STALE', lifecycle)
      const lockedBefore = await fetchAccount()
      if (lockedBefore?.ok !== true || lockedBefore?.status !== 'connected_readonly') return finish('POST_LOCK_FRESH_ACCOUNT_REQUIRED', lifecycle)
      const lockedAt = Date.parse(lockedBefore?.observedAt ?? ''), lockedAge = Number(now()) - lockedAt
      if (!Number.isFinite(lockedAt) || !Number.isFinite(lockedAge) || lockedAge < 0 || lockedAge > 30000) return finish('POST_LOCK_FRESH_ACCOUNT_STALE', lifecycle)
      if (lockedBefore?.account?.tradingBlocked === true || lockedBefore?.account?.accountBlocked === true) return finish('POST_LOCK_ACCOUNT_BLOCKED', lifecycle)
      const lm = await fetchOwnedMonitor({ paperAccount: lockedBefore, nowMs: Number(now()) })
      if (lm?.ok !== true) return finish('POST_LOCK_FRESH_OWNED_MONITOR_REQUIRED', lifecycle)
      const la = (Array.isArray(lm?.candidates) ? lm.candidates : []).find(row => upper(row?.symbol) === symbol) ?? null
      if (!la || clean(la?.sourceCoverage) !== 'owned_position_symbol_fetch') return finish('POST_LOCK_FRESH_OWNED_ASSESSMENT_REQUIRED', lifecycle)
      const age = Number(la?.sourceAgeSec), max = Number(la?.maxSourceAgeSec ?? la?.sourceMaxAgeSec ?? 180)
      if (la?.sourceStale !== false || !Number.isFinite(age) || age < 0 || !Number.isFinite(max) || age > max) return finish('POST_LOCK_FRESH_OWNED_STRATEGY_EVIDENCE_REQUIRED', lifecycle)
      const lx = la?.ownedExitReviewTriggered === true || upper(la?.resultState ?? la?.decision) === 'EXIT'
      const lockedScaleOutQualified = la?.ownedScaleOutReviewTriggered === true
      const lockedScaleInQualified = la?.ownedScaleInReviewTriggered === true
      const lockedActionArbitration = arbitratePaperAutomaticAction({
        lifecycle,
        exitRequired: lx,
        scaleOutQualified: lockedScaleOutQualified,
        scaleInQualified: lockedScaleInQualified,
      })
      if (lockedActionArbitration?.ok !== true) return finish(lockedActionArbitration?.status ?? 'POST_LOCK_ACTION_ARBITRATION_FAIL_CLOSED', lifecycle)
      if (lx && lockedActionArbitration?.action !== 'EXIT') return finish(lockedActionArbitration?.status ?? 'POST_LOCK_ACTION_ARBITRATION_EXIT_FAIL_CLOSED', lifecycle)
      if (!lx) {
        const expectedAction = a === 'scale_out' ? 'SCALE_OUT' : 'SCALE_IN'
        if (lockedActionArbitration?.action !== expectedAction) return finish(lockedActionArbitration?.status ?? 'POST_LOCK_ACTION_ARBITRATION_SCALE_FAIL_CLOSED', lifecycle)
      }
      const ar = arbitratePaperPositionMutation({ lifecycle, scaleActionStore, requestedAction: a, exitRequired: lx })
      if (ar?.allow !== true) return finish(ar?.status ?? 'POST_LOCK_POSITION_MUTATION_BLOCKED', lifecycle)
      if (a === 'scale_in') {
        if (la?.ownedScaleInReviewTriggered !== true) return finish('POST_LOCK_FRESH_SCALE_IN_STRATEGY_NOT_QUALIFIED', lifecycle)
        if (whole(la?.ownedScaleInTargetQuantity) !== target) return finish('POST_LOCK_FRESH_SCALE_IN_TARGET_MISMATCH', lifecycle)
      } else {
        if (la?.ownedScaleOutReviewTriggered !== true) return finish('POST_LOCK_FRESH_SCALE_OUT_STRATEGY_NOT_QUALIFIED', lifecycle)
        if (whole(la?.ownedScaleOutResultingQuantity) !== target) return finish('POST_LOCK_FRESH_SCALE_OUT_TARGET_MISMATCH', lifecycle)
      }
      if (a === 'scale_in') {
        const lockedBaseline = await getPremarketBaseline()
        if (lockedBaseline?.ok !== true || lockedBaseline?.paperOnly !== true || lockedBaseline?.readOnly !== true) return finish('POST_LOCK_PREMARKET_CAPITAL_BASELINE_REQUIRED', lifecycle)
        const lockedSessionDate = easternDateKey(Number(now()))
        if (!lockedSessionDate || clean(lockedBaseline?.sessionDate) !== lockedSessionDate) return finish('POST_LOCK_PREMARKET_CAPITAL_BASELINE_SESSION_MISMATCH', lifecycle)
        const lockedBaselineAccountIdentity = clean(lockedBaseline?.accountIdentity)
        const lockedActionAccountIdentity = clean(lockedBefore?.account?.accountIdentity)
        if (!lockedBaselineAccountIdentity || !lockedActionAccountIdentity || lockedBaselineAccountIdentity !== lockedActionAccountIdentity) {
          return finish('POST_LOCK_PREMARKET_CAPITAL_BASELINE_ACCOUNT_IDENTITY_MISMATCH', lifecycle)
        }
      }
      const lockedPosition = (lockedBefore?.positions ?? []).find(row => upper(row?.symbol) === symbol) ?? null
      if (a === 'scale_in' && on(env, 'PAPER_AUTO_PORTFOLIO_CAPITAL_GOVERNOR_ENABLED')) {
        const lockedCurrentQty = whole(lockedPosition?.qty ?? lockedPosition?.quantity)
        const lockedCurrentPrice = Number(lockedPosition?.currentPrice ?? lockedPosition?.current_price)
        if (lockedCurrentQty === null || !Number.isFinite(lockedCurrentPrice) || lockedCurrentPrice <= 0) return finish('POST_LOCK_PORTFOLIO_POSITION_NOTIONAL_REQUIRED', lifecycle)
        const additionalQty = target - lockedCurrentQty
        if (!Number.isSafeInteger(additionalQty) || additionalQty <= 0) return finish('POST_LOCK_PORTFOLIO_SCALE_IN_ADDITIONAL_QUANTITY_REQUIRED', lifecycle)
        lastPortfolioCapitalGovernor = evaluatePaperPortfolioCapitalGovernor({
          accountSnapshot: lockedBefore,
          action: 'scale_in',
          symbol,
          proposedAdditionalNotional: additionalQty * lockedCurrentPrice,
          resultingSymbolNotional: target * lockedCurrentPrice,
        })
        if (lastPortfolioCapitalGovernor?.allowed !== true) return finish(`POST_LOCK_${lastPortfolioCapitalGovernor?.status ?? 'PORTFOLIO_CAPITAL_GOVERNOR_FAIL_CLOSED'}`, lifecycle)
      } else if (a === 'scale_in') {
        lastPortfolioCapitalGovernor = Object.freeze({ allowed:true, status:'PORTFOLIO_CAPITAL_GOVERNOR_DISABLED_BY_ENV' })
      } else {
        lastPortfolioCapitalGovernor = Object.freeze({ allowed:true, status:'PORTFOLIO_GOVERNOR_NOT_REQUIRED_FOR_REDUCING_ACTION' })
      }
      const lockedPreflight = preflightPaperScaleAction({
        lifecycle, brokerPosition: lockedPosition, openOrders: lockedBefore?.openOrders ?? [],
        action: a, targetQuantity: target, actionSequence: nextScaleActionSequence(scaleActionStore),
      })
      if (lockedPreflight?.ok !== true) return finish(lockedPreflight?.status ?? 'POST_LOCK_PREFLIGHT_BLOCKED', lifecycle)
      const prepared = scaleActionStore.prepare({
        lifecycleId: lifecycle.lifecycleId,
        action: a,
        symbol,
        fromQuantity: lifecycle.filledQuantity,
        targetQuantity: target,
      })
    if (
      prepared?.actionSequence !== lockedPreflight.identity.actionSequence ||
      prepared?.clientOrderId !== lockedPreflight.identity.clientOrderId ||
      prepared?.digest !== lockedPreflight.identity.digest
    ) {
      throw new Error('paper_scale_runner_prepared_identity_changed')
    }
    lastIdentity = prepared
    submissions += 1
    const submission = await submitPaperScaleOrder({
      scaleActionStore,
      submitPaperOrder,
      env,
    })
    lastSubmission = submission
    reconciliations += 1
    const reconciliation = await reconcilePaperScaleAction({
      lifecycleStore: store,
      scaleActionStore,
      fetchOrderByClientOrderId,
      fetchAccount,
      now,
    })
    lastReconciliation = reconciliation
    lifecycle = reconciliation?.lifecycle ?? store.load()
    return finish(reconciliation?.status ?? submission?.status ?? 'PAPER_SCALE_RECONCILIATION_STATUS_REQUIRED', lifecycle)
    } finally {
      releasePaperPositionMutationLock(mutationLock)
    }
  }

  const runOnce = request => inFlight ?? (inFlight = Promise.resolve().then(() => cycle(request)).catch(error => {
    lastError = error?.message ?? String(error)
    lastStatus = 'PAPER_SCALE_RUNNER_ERROR_FAIL_CLOSED'
    return diagnostics()
  }).finally(() => { inFlight = null }))
  return Object.freeze({ runOnce, diagnostics })
}
export default { VERSION, createPaperAutoExecutionScaleRunner }
