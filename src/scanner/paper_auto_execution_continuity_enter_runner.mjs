import fs from 'node:fs'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { fetchAlpacaMarketClockReadonly } from './alpaca_market_clock_readonly.mjs'
import { fetchAlpacaPaperHistoricalOrdersReadonly } from './paper_auto_execution_reporting_history_fetch.mjs'
import { createPaperAutoExecutionAlpacaPaperAdapter } from './paper_auto_execution_alpaca_paper_adapter.mjs'
import { submitPaperAutoOrder } from './paper_auto_execution_submission_boundary.mjs'
import { runPaperAutoExecutionReconciliation } from './paper_auto_execution_reconciliation_runner.mjs'
import { resolveInternalOwnerAlpacaReadonlyCredentials } from './internal_owner_alpaca_readonly_credentials.mjs'
import { calculateAutomaticPositionSize } from './automatic_position_sizing_policy.mjs'
import { easternDateKey } from './alpaca_premarket_shared_scan_cache.mjs'
import { arbitratePaperAutomaticAction } from './paper_auto_execution_action_arbitration.mjs'
import { evaluatePaperPortfolioCapitalGovernor } from './paper_auto_execution_portfolio_capital_governor.mjs'

export const VERSION = 'paper_auto_execution_continuity_enter_runner_v1'
const clean = v => String(v ?? '').trim()
const upper = v => clean(v).toUpperCase()
const on = (env, key) => clean(env?.[key]) === '1'
const ENTER_RECONCILE_STATES = new Set([S.ENTER_OPEN, S.ENTER_UNKNOWN, S.ENTER_PARTIALLY_FILLED])
const CANDIDATE_FRESHNESS_MS = 30000
const strictFinite = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function evaluateReentryControl(snapshot = {}) {
  const r = snapshot?.reentryControl ?? null
  const age = strictFinite(r?.sourceAgeSec)
  const max = strictFinite(r?.maxAgeSec)
  const fresh = Boolean(r && r.connected === true && r.fresh === true && r.stale === false && age !== null && max !== null && age >= 0 && max > 0 && age <= max)
  if (!fresh) return { allowed:false, status:'FRESH_REENTRY_CONTROL_REQUIRED' }
  if (clean(r?.cooldownState) !== 'cooldown_clear') return { allowed:false, status:'REENTRY_COOLDOWN_NOT_CLEAR' }
  if (clean(r?.resetPermission) !== 'allowed') return { allowed:false, status:'REENTRY_RESET_NOT_ALLOWED' }
  if (clean(r?.reentryPermission) !== 'allowed') return { allowed:false, status:'REENTRY_PERMISSION_NOT_ALLOWED' }
  if (clean(r?.continuationPermission) !== 'allowed') return { allowed:false, status:'REENTRY_CONTINUATION_NOT_ALLOWED' }
  return { allowed:true, status:'REENTRY_ALLOWED' }
}
const isEligibleCandidate = (candidate, symbol) => upper(candidate?.symbol) === upper(symbol)
  && upper(candidate?.state ?? candidate?.resultState ?? candidate?.decision) === 'ENTER'
  && candidate?.buyRecommendation === true
  && candidate?.blocked !== true
  && (!Array.isArray(candidate?.blockers) || candidate.blockers.length === 0)

export function createPaperAutoExecutionContinuityEnterRunner(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const getLifecycleFile = options.getLifecycleFile ?? (() => clean(env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH ?? env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH))
  const credentialResolver = options.accountCredentialResolver ?? resolveInternalOwnerAlpacaReadonlyCredentials
  const getScanSnapshot = options.getScanSnapshot ?? null
  const getPremarketBaseline = options.getPremarketBaseline ?? null
  const fetchAccount = options.fetchAccount ?? ((args) => fetchAlpacaPaperAccountReadonly(args))
  const fetchClock = options.fetchClock ?? ((args) => fetchAlpacaMarketClockReadonly(args))
  const fetchHistory = options.fetchHistoricalOrders ?? ((args) => fetchAlpacaPaperHistoricalOrdersReadonly(args))
  const createAdapter = options.createAdapter ?? ((args) => createPaperAutoExecutionAlpacaPaperAdapter(args))
  const submit = options.submitOrder ?? submitPaperAutoOrder
  const reconcile = options.reconcile ?? runPaperAutoExecutionReconciliation
  const degradedBrokerMode = options.degradedBrokerMode ?? null
  const now = options.now ?? Date.now
  let inFlight = null
  let cycles = 0
  let submissions = 0
  let reconciliations = 0
  let lastStatus = 'NOT_RUN'
  let lastError = null
  let lastLifecycleFile = null
  let lastLifecycle = null
  let lastSubmission = null
  let lastReconciliation = null
  let lastSizing = null
  let lastReentryControl = null
  let lastPortfolioCapitalGovernor = null

  const diagnostics = () => Object.freeze({
    ok: true,
    version: VERSION,
    enabled: on(env, 'PAPER_AUTO_CONTINUITY_ENTER_ENABLED'),
    cycles,
    submissions,
    reconciliations,
    lastStatus,
    lastError,
    lastLifecycleFile,
    lastLifecycle,
    lastSubmission,
    lastReconciliation,
    lastSizing,
    lastReentryControl,
    lastPortfolioCapitalGovernor,
    degradedBrokerMode: degradedBrokerMode?.diagnostics?.() ?? null,
    safety: Object.freeze({
      paperOnly: true,
      disabledByDefault: true,
      exactActiveLifecycleOnly: true,
      liveTradingAllowed: false,
      cancellationAllowed: false,
      brokerContactAllowed: on(env, 'PAPER_AUTO_CONTINUITY_ENTER_ENABLED'),
      orderPlacementAllowed: on(env, 'PAPER_AUTO_CONTINUITY_ENTER_ENABLED'),
      reconciliationRequired: true,
    }),
  })

  const fail = (status, lifecycle = null) => {
    lastStatus = status
    lastLifecycle = lifecycle
    return diagnostics()
  }

  async function cycle() {
    cycles += 1
    lastError = null
    if (!on(env, 'PAPER_AUTO_CONTINUITY_ENTER_ENABLED')) return fail('CONTINUITY_ENTER_DISABLED_BY_ENV')
    const lifecycleFile = clean(await getLifecycleFile?.())
    lastLifecycleFile = lifecycleFile || null
    if (!lifecycleFile) return fail('ACTIVE_LIFECYCLE_PATH_REQUIRED')
    if (!fs.existsSync(lifecycleFile)) return fail('ACTIVE_LIFECYCLE_FILE_MISSING')
    const store = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
    let lifecycle = store.load()
    lastLifecycle = lifecycle
    if (!lifecycle) return fail('ACTIVE_LIFECYCLE_REQUIRED')
    if ([S.MONITORING, S.POSITION_CONFIRMED, S.ROUND_TRIP_COMPLETED, S.FAILED_NEEDS_REVIEW, S.CANDIDATE_EXPIRED].includes(lifecycle.state)) {
      return fail('CONTINUITY_ENTER_NOT_REQUIRED', lifecycle)
    }
    if (lifecycle.state !== S.CANDIDATE_SELECTED && !ENTER_RECONCILE_STATES.has(lifecycle.state)) {
      return fail('CONTINUITY_ENTER_STATE_NOT_ACTIONABLE', lifecycle)
    }
    if (ENTER_RECONCILE_STATES.has(lifecycle.state)) {
      const actionArbitration = arbitratePaperAutomaticAction({ lifecycle })
      if (actionArbitration?.ok !== true || actionArbitration?.action !== 'ENTER_RECONCILE') {
        return fail(actionArbitration?.status ?? 'ENTER_RECONCILIATION_ACTION_ARBITRATION_FAIL_CLOSED', lifecycle)
      }
    }

    let revalidatedCandidate = null
    if (lifecycle.state === S.CANDIDATE_SELECTED) {
      if (typeof getScanSnapshot !== 'function') return fail('FRESH_CANDIDATE_REVALIDATION_REQUIRED', lifecycle)
      const snapshot = await getScanSnapshot()
      const observedAtMs = Date.parse(snapshot?.observedAt ?? '')
      const candidateAgeMs = Number(now()) - observedAtMs
      if (!Number.isFinite(observedAtMs) || !Number.isFinite(candidateAgeMs) || candidateAgeMs < 0 || candidateAgeMs > CANDIDATE_FRESHNESS_MS) {
        return fail('FRESH_CANDIDATE_REQUIRED', lifecycle)
      }
      const candidates = Array.isArray(snapshot?.candidates) ? snapshot.candidates : []
      revalidatedCandidate = candidates.find(candidate => isEligibleCandidate(candidate, lifecycle.selectedSymbol)) ?? null
      if (!revalidatedCandidate) {
        return fail('CANDIDATE_REVALIDATION_FAILED', lifecycle)
      }
      if (on(env, 'PAPER_AUTO_CONTINUITY_REENTRY_CONTROL_ENABLED')) {
        lastReentryControl = Object.freeze(evaluateReentryControl(snapshot))
        if (lastReentryControl.allowed !== true) return fail(lastReentryControl.status, lifecycle)
      } else {
        lastReentryControl = Object.freeze({ allowed:true, status:'REENTRY_CONTROL_DISABLED_BY_ENV' })
      }
      const actionArbitration = arbitratePaperAutomaticAction({
        lifecycle,
        enterQualified: true,
      })
      if (actionArbitration?.ok !== true || actionArbitration?.action !== 'ENTER') {
        return fail(actionArbitration?.status ?? 'ENTER_ACTION_ARBITRATION_FAIL_CLOSED', lifecycle)
      }
    }

    if (lifecycle.state === S.CANDIDATE_SELECTED && degradedBrokerMode?.evaluateAction) {
      const brokerModeDecision = degradedBrokerMode.evaluateAction({ action: 'ENTER' })
      if (brokerModeDecision?.allowed !== true) return fail(brokerModeDecision?.status ?? 'DEGRADED_BROKER_ENTER_BLOCKED', lifecycle)
    }

    const resolved = typeof credentialResolver === 'function'
      ? await credentialResolver({
          env,
          masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY,
          purpose: 'paper_continuity_enter_credentials',
        })
      : null
    if (resolved?.readyForReadonlyBrokerRead !== true) return fail('PAPER_CREDENTIALS_NOT_READY', lifecycle)
    const effectiveEnv = { ...env, ...(resolved.env ?? {}) }
    if (clean(effectiveEnv.APCA_API_BASE_URL) !== 'https://paper-api.alpaca.markets') {
      return fail('PAPER_HOST_REQUIRED', lifecycle)
    }

    if (lifecycle.state === S.CANDIDATE_SELECTED) {
      if (typeof getPremarketBaseline !== 'function') return fail('PREMARKET_CAPITAL_BASELINE_REQUIRED', lifecycle)
      const baseline = await getPremarketBaseline()
      if (baseline?.ok !== true || baseline?.paperOnly !== true || baseline?.readOnly !== true) {
        return fail('PREMARKET_CAPITAL_BASELINE_REQUIRED', lifecycle)
      }
      const currentSessionDate = easternDateKey(Number(now()))
      if (!currentSessionDate || clean(baseline?.sessionDate) !== currentSessionDate) {
        return fail('PREMARKET_CAPITAL_BASELINE_SESSION_MISMATCH', lifecycle)
      }
      const [clock, account] = await Promise.all([
        fetchClock({ env: effectiveEnv, fetchImpl, credentialResolver: null }),
        fetchAccount({ env: effectiveEnv, fetchImpl, credentialResolver: null }),
      ])
      if (clock?.ok !== true || clock?.status !== 'connected_readonly') {
        if (clock?.status === 'clock_fetch_failed') degradedBrokerMode?.recordFailure?.({ kind:'MARKET_CLOCK_READ_FAILED', reason:clean(clock?.status) })
        return fail('MARKET_OPEN_REQUIRED', lifecycle)
      }
      if (clock?.marketClock?.isOpen !== true) return fail('MARKET_OPEN_REQUIRED', lifecycle)
      if (account?.ok !== true || account?.status !== 'connected_readonly') {
        if (account?.status === 'readonly_fetch_failed') degradedBrokerMode?.recordFailure?.({ kind:'ACCOUNT_READ_FAILED', reason:clean(account?.status) })
        return fail('FRESH_PAPER_ACCOUNT_REQUIRED', lifecycle)
      }
      const baselineAccountIdentity = clean(baseline?.accountIdentity)
      const actionAccountIdentity = clean(account?.account?.accountIdentity)
      if (!baselineAccountIdentity || !actionAccountIdentity || baselineAccountIdentity !== actionAccountIdentity) {
        return fail('PREMARKET_CAPITAL_BASELINE_ACCOUNT_IDENTITY_MISMATCH', lifecycle)
      }
      const observedAtMs = Date.parse(account?.observedAt ?? '')
      const accountAgeMs = Number(now()) - observedAtMs
      if (!Number.isFinite(observedAtMs) || !Number.isFinite(accountAgeMs) || accountAgeMs < 0 || accountAgeMs > 30000) return fail('PAPER_ACCOUNT_SNAPSHOT_STALE', lifecycle)
      if (account?.account?.tradingBlocked === true || account?.account?.accountBlocked === true) {
        degradedBrokerMode?.recordFailure?.({ kind:'BROKER_ACCOUNT_BLOCKED', reason:'paper_account_blocked' })
        return fail('PAPER_ACCOUNT_BLOCKED', lifecycle)
      }
      const candidatePrice = Number(revalidatedCandidate?.price)
      const candidateScore = Number(revalidatedCandidate?.score ?? revalidatedCandidate?.readonlyPotentialScore)
      lastSizing = calculateAutomaticPositionSize({
        accountEquity: account?.account?.equity,
        buyingPower: account?.account?.buyingPower,
        candidatePrice,
        candidateScore,
      })
      if (lastSizing?.ok !== true) return fail(`POSITION_SIZING_${lastSizing?.status ?? 'FAILED'}`, lifecycle)
      const enterQuantity = lastSizing.quantity
      const symbol = upper(lifecycle.selectedSymbol)
      const openPositions = (account?.positions ?? []).filter(p => Number(p?.qty ?? p?.quantity) > 0)
      if (openPositions.length > 0) {
        return fail(openPositions.some(p => upper(p?.symbol) === symbol)
          ? 'EXISTING_BROKER_POSITION_CONFLICT'
          : 'GLOBAL_POSITION_CONCURRENCY_LIMIT', lifecycle)
      }
      const conflictingOpenOrders = (account?.openOrders ?? []).filter(o =>
        ['buy', 'sell'].includes(clean(o?.side).toLowerCase())
      )
      if (conflictingOpenOrders.length > 0) {
        return fail(conflictingOpenOrders.some(o => upper(o?.symbol) === symbol)
          ? 'CONFLICTING_OPEN_ORDER'
          : 'GLOBAL_OPEN_ORDER_CONCURRENCY_LIMIT', lifecycle)
      }
      if (on(env, 'PAPER_AUTO_PORTFOLIO_CAPITAL_GOVERNOR_ENABLED')) {
        lastPortfolioCapitalGovernor = evaluatePaperPortfolioCapitalGovernor({
          accountSnapshot: account,
          action: 'enter',
          symbol,
          proposedAdditionalNotional: lastSizing.requiredBuyingPower,
          resultingSymbolNotional: lastSizing.requiredBuyingPower,
        })
        if (lastPortfolioCapitalGovernor?.allowed !== true) return fail(lastPortfolioCapitalGovernor?.status ?? 'PORTFOLIO_CAPITAL_GOVERNOR_FAIL_CLOSED', lifecycle)
      } else {
        lastPortfolioCapitalGovernor = Object.freeze({ allowed:true, status:'PORTFOLIO_CAPITAL_GOVERNOR_DISABLED_BY_ENV' })
      }
      const adapter = createAdapter({
        env: {
          ...effectiveEnv,
          PAPER_AUTO_ALPACA_ADAPTER_ENABLED: '1',
          PAPER_AUTO_ALPACA_PAPER_BASE_URL: 'https://paper-api.alpaca.markets',
        },
        fetchImpl,
      })
      submissions += 1
      lastSubmission = await submit({
        lifecycleStore: store,
        phase: 'enter',
        quantity: enterQuantity,
        submitPaperOrder: adapter.submitPaperOrder,
        env: {
          ...effectiveEnv,
          PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
          PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
          PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '0',
        },
      })
      if (lastSubmission?.status === 'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED') {
        const submissionException = Array.isArray(lastSubmission?.blockers) && lastSubmission.blockers.includes('submission_exception_requires_reconciliation')
        degradedBrokerMode?.recordFailure?.({
          kind: submissionException ? 'SUBMISSION_EXCEPTION' : 'AMBIGUOUS_SUBMISSION',
          reason: submissionException ? 'enter_submission_exception_requires_reconciliation' : 'enter_submission_ambiguous_requires_reconciliation',
        })
      }
      lifecycle = store.load()
      lastLifecycle = lifecycle
      if (lifecycle?.state === S.FAILED_NEEDS_REVIEW) return fail('CONTINUITY_ENTER_SUBMISSION_REJECTED', lifecycle)
    }

    lifecycle = store.load()
    if (ENTER_RECONCILE_STATES.has(lifecycle?.state)) {
      let account, history
      try {
        ;[account, history] = await Promise.all([
          fetchAccount({ env: effectiveEnv, fetchImpl, credentialResolver: null }),
          fetchHistory({ env: effectiveEnv, fetchImpl }),
        ])
      } catch (error) {
        const message = clean(error?.message ?? error)
        if (message.startsWith('paper_reporting_history_fetch_failed:')) {
          degradedBrokerMode?.recordFailure?.({ kind:'HISTORY_READ_FAILED', reason:message })
        }
        throw error
      }
      if (account?.ok !== true || account?.status !== 'connected_readonly') {
        if (account?.status === 'readonly_fetch_failed') degradedBrokerMode?.recordFailure?.({ kind:'ACCOUNT_READ_FAILED', reason:clean(account?.status) })
        return fail('FRESH_PAPER_ACCOUNT_REQUIRED_FOR_RECONCILIATION', lifecycle)
      }
      reconciliations += 1
      lastReconciliation = await reconcile({
        lifecycleStore: store,
        accountSnapshot: account,
        historicalOrders: history?.historicalOrders ?? [],
        nowMs: Number(now()),
      })
      lifecycle = store.load()
      if (lifecycle?.state === S.POSITION_CONFIRMED) lifecycle = store.transition(S.MONITORING)
      lastLifecycle = lifecycle
    }

    if (lifecycle?.state === S.MONITORING) return fail('CONTINUITY_ENTER_MONITORING_CONFIRMED', lifecycle)
    if (lifecycle?.state === S.FAILED_NEEDS_REVIEW || lifecycle?.state === S.UNRESOLVED_NEEDS_RECONCILIATION) {
      return fail('CONTINUITY_ENTER_FAILED_CLOSED', lifecycle)
    }
    return fail('CONTINUITY_ENTER_RECONCILIATION_PENDING', lifecycle)
  }

  const runOnce = () => inFlight ?? (inFlight = Promise.resolve().then(cycle).catch((error) => {
    lastError = error?.message ?? String(error)
    lastStatus = 'CONTINUITY_ENTER_ERROR_FAIL_CLOSED'
    return diagnostics()
  }).finally(() => { inFlight = null }))

  return Object.freeze({ runOnce, diagnostics })
}

export default { VERSION, createPaperAutoExecutionContinuityEnterRunner }
