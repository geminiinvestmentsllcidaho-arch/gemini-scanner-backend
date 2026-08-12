import fs from 'node:fs'
import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { fetchCustomerOwnedPositionMonitorSource } from './customer_owned_position_monitor_source.mjs'
import { fetchAlpacaUnderFiveUniverseReadonly } from './alpaca_under_five_universe_readonly.mjs'
import { fetchAlpacaMarketClockReadonly } from './alpaca_market_clock_readonly.mjs'
import { runPaperAutoExecutionExitOnly } from './paper_auto_execution_exit_only_runner.mjs'
import { emitAdminPaperOperationalIncident } from './admin_paper_operational_incident_emitter.mjs'

export const VERSION = 'paper_auto_exit_monitor_worker_v1'
export const DEFAULT_INTERVAL_MS = 15000
const clean = v => String(v ?? '').trim()
const upper = v => clean(v).toUpperCase()
const enabled = env => clean(env?.PAPER_AUTO_EXIT_MONITOR_ENABLED) === '1'

export function readConfiguredMonitoringLifecycle({ lifecycleFile } = {}) {
  const file = clean(lifecycleFile)
  if (!file) return { status: 'LIFECYCLE_PATH_REQUIRED', file: null, lifecycle: null }
  if (!fs.existsSync(file)) return { status: 'LIFECYCLE_FILE_MISSING', file, lifecycle: null }
  let lifecycle
  try {
    lifecycle = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return { status: 'LIFECYCLE_FILE_CORRUPT', file, lifecycle: null }
  }
  if (lifecycle?.state !== 'MONITORING') return { status: 'LIFECYCLE_NOT_MONITORING', file, lifecycle }
  if (!lifecycle?.lifecycleId || !lifecycle?.selectedSymbol || !(Number(lifecycle?.filledQuantity) > 0) || !lifecycle?.brokerPositionIdentity) {
    return { status: 'LIFECYCLE_MONITORING_INVALID', file, lifecycle }
  }
  return { status: 'MONITORING', file, lifecycle }
}

export function createPaperAutoExitMonitorWorker(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const now = options.now ?? Date.now
  const setIntervalFn = options.setIntervalFn ?? setInterval
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval
  const configuredLifecycleFile = clean(options.lifecycleFile ?? env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH ?? env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH)
  const readLifecycle = options.readConfiguredMonitoringLifecycle ?? (() => readConfiguredMonitoringLifecycle({ lifecycleFile: configuredLifecycleFile }))
  const fetchAccount = options.fetchAccount ?? (args => fetchAlpacaPaperAccountReadonly(args))
  const fetchOwned = options.fetchOwnedMonitor ?? (args => fetchCustomerOwnedPositionMonitorSource(args))
  const fetchSymbols = options.fetchSymbols ?? (args => fetchAlpacaUnderFiveUniverseReadonly(args))
  const fetchMarketClock = options.fetchMarketClock ?? (args => fetchAlpacaMarketClockReadonly(args))
  const exitRunner = options.exitRunner ?? runPaperAutoExecutionExitOnly
  const incidentEmitter = options.incidentEmitter ?? emitAdminPaperOperationalIncident
  const accountCredentialResolver = options.accountCredentialResolver
  const intervalMs = Math.max(250, Number(options.intervalMs ?? env.PAPER_AUTO_EXIT_MONITOR_INTERVAL_MS ?? DEFAULT_INTERVAL_MS) || DEFAULT_INTERVAL_MS)
  let timer = null
  let running = false
  let busy = false
  let cycles = 0
  let eventCycles = 0
  let fallbackCycles = 0
  let exitTriggers = 0
  let exitAttempts = 0
  let lastStatus = 'NOT_STARTED'
  let lastError = null
  let lastResult = null
  let lastTriggerDetectedAt = null
  let lastRunnerCompletedAt = null
  let lastSubmissionConfirmedObservedAt = null
  let lastReconciliationCompletedObservedAt = null
  let lastBrokerOrderId = null
  let lastSubmissionStatus = null
  let lastReconciliationStatus = null
  let lastBrokerSubmittedAt = null
  let lastBrokerFilledAt = null
  let lastIncidentCode = null

  const diagnostics = () => ({
    ok: true, version: VERSION, enabled: enabled(env), running, busy, intervalMs, cycles, eventCycles, fallbackCycles,
    configuredLifecycleFile: configuredLifecycleFile || null,
    exitTriggers, exitAttempts, lastStatus, lastError, lastResult, lastTriggerDetectedAt,
    lastRunnerCompletedAt, lastSubmissionConfirmedObservedAt, lastReconciliationCompletedObservedAt,
    lastBrokerOrderId, lastSubmissionStatus, lastReconciliationStatus, lastBrokerSubmittedAt, lastBrokerFilledAt,
    safety: { paperOnly: true, liveTradingAllowed: false, disabledByDefault: true, exactPositionExitOnly: true, blindRetryAllowed: false }
  })

  async function incident(code) {
    const failureCode = clean(code)
    if (!failureCode || failureCode === lastIncidentCode) return
    lastIncidentCode = failureCode
    try {
      await incidentEmitter?.({ source: 'paper_execution', severity: 'critical', failureCode, summary: 'Continuous PAPER auto-EXIT monitor failed closed.', phase: 'exit', process: 'paper_auto_exit_monitor_worker' })
    } catch {}
  }

  function clearIncidentLatch() {
    lastIncidentCode = null
  }

  async function runOnce({ eventSymbol = null, source = null } = {}) {
    cycles += 1
    const cycleSource = clean(source) || (eventSymbol ? 'market_event' : 'authoritative_fallback')
    if (cycleSource === 'market_event') eventCycles += 1
    else fallbackCycles += 1
    if (!enabled(env)) { lastStatus = 'DISABLED_BY_ENV'; return diagnostics() }
    if (busy) { lastStatus = 'CYCLE_ALREADY_RUNNING'; return diagnostics() }
    busy = true
    lastError = null
    try {
      if (!configuredLifecycleFile) {
        lastStatus = 'ACTIVE_LIFECYCLE_PATH_REQUIRED'
        lastResult = []
        await incident('paper_auto_exit_monitor_lifecycle_path_required')
        return diagnostics()
      }
      const row = await readLifecycle()
      if (!row || row.status === 'LIFECYCLE_FILE_MISSING') {
        lastStatus = 'ACTIVE_LIFECYCLE_FILE_MISSING'
        lastResult = []
        await incident('paper_auto_exit_monitor_lifecycle_file_missing')
        return diagnostics()
      }
      if (row.status === 'LIFECYCLE_FILE_CORRUPT' || row.status === 'LIFECYCLE_MONITORING_INVALID') {
        throw new Error(`paper_auto_exit_monitor_${String(row.status).toLowerCase()}`)
      }
      if (row.status !== 'MONITORING') {
        if (row?.lifecycle?.state === 'ROUND_TRIP_COMPLETED' && row?.lifecycle?.scannerEvidence?.mechanicalAutoExitProof === true) {
          lastStatus = 'CONTROLLED_EXIT_LIFECYCLE_COMPLETED'
          lastResult = []
          clearIncidentLatch()
          return diagnostics()
        }
        lastStatus = 'ACTIVE_LIFECYCLE_NOT_MONITORING'
        lastResult = []
        await incident('paper_auto_exit_monitor_lifecycle_not_monitoring')
        return diagnostics()
      }
      clearIncidentLatch()
      const wanted = upper(eventSymbol)
      if (wanted && upper(row.lifecycle.selectedSymbol) !== wanted) {
        lastStatus = 'EVENT_SYMBOL_NOT_MONITORED'
        lastResult = []
        return diagnostics()
      }
      const scoped = [row]

      const account = await fetchAccount({ env, fetchImpl })
      if (account?.ok !== true || account?.status !== 'connected_readonly') throw new Error('paper_auto_exit_monitor_fresh_account_required')
      const results = []

      for (const row of scoped) {
        const life = row.lifecycle
        const symbol = upper(life.selectedSymbol)
        const quantity = Number(life.filledQuantity)
        const position = (account.positions ?? []).find(p => upper(p?.symbol) === symbol && Number(p?.qty ?? p?.quantity) === quantity)
        if (!position) { results.push({ lifecycleId: life.lifecycleId, symbol, status: 'BROKER_EXACT_POSITION_NOT_PRESENT' }); continue }
        if (clean(life.brokerPositionIdentity) !== `${symbol}:${quantity}`) { results.push({ lifecycleId: life.lifecycleId, symbol, status: 'BROKER_POSITION_IDENTITY_MISMATCH' }); continue }

        const controlledMarketOpenExit = life?.scannerEvidence?.mechanicalAutoExitProof === true
        let exitRequired = controlledMarketOpenExit
        if (controlledMarketOpenExit) {
          const clock = await fetchMarketClock({ env, fetchImpl })
          if (clock?.ok !== true || clock?.status !== 'connected_readonly') throw new Error('paper_auto_exit_monitor_market_clock_required')
          if (clock?.marketClock?.isOpen !== true) {
            results.push({ lifecycleId: life.lifecycleId, symbol, status: 'WAITING_FOR_MARKET_OPEN_AUTO_EXIT_PROOF' })
            continue
          }
        } else {
          const owned = await fetchOwned({
            paperAccount: { positions: [position] },
            fetchSymbols: args => fetchSymbols({ ...args, env, fetchImpl, nowMs: Number(now()) }),
            nowMs: Number(now()), maxAssets: 1
          })
          const candidate = (owned?.candidates ?? []).find(c => upper(c?.symbol) === symbol)
          exitRequired = candidate?.ownedExitReviewTriggered === true && upper(candidate?.resultState ?? candidate?.decision) === 'EXIT' && candidate?.sourceStale !== true
        }
        if (!exitRequired) { results.push({ lifecycleId: life.lifecycleId, symbol, status: 'MONITORING_NO_EXIT' }); continue }

        exitTriggers += 1
        lastTriggerDetectedAt = new Date(now()).toISOString()
        exitAttempts += 1
        const result = await exitRunner({
          args: { execute: 'true', lifecycleFile: row.file, lifecycleId: life.lifecycleId, symbol, quantity: String(quantity) },
          env, fetchImpl, nowMs: Number(now()),
          ...(typeof accountCredentialResolver === 'function' ? { accountCredentialResolver } : {})
        })
        lastRunnerCompletedAt = new Date(now()).toISOString()
        lastSubmissionStatus = clean(result?.submission?.status) || null
        lastReconciliationStatus = clean(result?.reconciliation?.status) || null
        lastBrokerSubmittedAt = clean(result?.brokerTiming?.submittedAt ?? result?.submission?.result?.submittedAt) || null
        lastBrokerFilledAt = clean(result?.brokerTiming?.filledAt ?? result?.lifecycle?.exitBrokerFilledAt) || null
        lastBrokerOrderId = clean(
          result?.submission?.result?.brokerOrderId ??
          result?.submission?.result?.orderId ??
          result?.submission?.result?.id ??
          result?.submission?.lifecycle?.exitBrokerOrderId ??
          result?.lifecycle?.exitBrokerOrderId
        ) || null
        if (lastSubmissionStatus === 'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED' && lastBrokerOrderId) {
          lastSubmissionConfirmedObservedAt = lastRunnerCompletedAt
        }
        if (
          result?.status === 'EXACT_POSITION_PAPER_EXIT_COMPLETED' &&
          result?.lifecycle?.state === 'ROUND_TRIP_COMPLETED'
        ) {
          lastReconciliationCompletedObservedAt = lastRunnerCompletedAt
        }
        results.push({
          lifecycleId: life.lifecycleId,
          symbol,
          status: result?.status ?? 'EXIT_RUNNER_COMPLETED',
          brokerOrderId: lastBrokerOrderId,
          submissionStatus: lastSubmissionStatus,
          reconciliationStatus: lastReconciliationStatus,
          brokerSubmittedAt: lastBrokerSubmittedAt,
          brokerFilledAt: lastBrokerFilledAt,
        })
      }
      lastResult = results
      lastStatus = results.some(r => /^EXACT_POSITION_PAPER_EXIT_/.test(r.status)) ? 'EXIT_TRIGGERED' : 'MONITORING'
    } catch (error) {
      lastError = error?.message ?? String(error)
      lastStatus = 'WORKER_ERROR_FAIL_CLOSED'
      await incident(clean(lastError).split(':')[0] || 'paper_auto_exit_monitor_worker_failed')
    } finally {
      busy = false
    }
    return diagnostics()
  }

  function start() {
    if (running) return diagnostics()
    if (!enabled(env)) { lastStatus = 'DISABLED_BY_ENV'; return diagnostics() }
    running = true
    void runOnce({ source: 'authoritative_fallback' })
    timer = setIntervalFn(() => { void runOnce({ source: 'authoritative_fallback' }) }, intervalMs)
    timer?.unref?.()
    lastStatus = 'RUNNING'
    return diagnostics()
  }

  function stop() {
    if (timer) clearIntervalFn(timer)
    timer = null
    running = false
    lastStatus = 'STOPPED'
    return diagnostics()
  }

  function configuredMonitoringSymbol() {
    if (!configuredLifecycleFile) return null
    const row = readConfiguredMonitoringLifecycle({ lifecycleFile: configuredLifecycleFile })
    return row?.status === 'MONITORING' ? (upper(row?.lifecycle?.selectedSymbol) || null) : null
  }

  function onMarketDataEvent(event = {}) {
    const symbol = upper(event.symbol ?? event.S)
    if (!symbol || !enabled(env)) return diagnostics()
    const monitoredSymbol = configuredMonitoringSymbol()
    if (!monitoredSymbol || symbol !== monitoredSymbol) return diagnostics()
    void runOnce({ eventSymbol: symbol, source: 'market_event' })
    return diagnostics()
  }

  return { start, stop, runOnce, onMarketDataEvent, diagnostics, configuredMonitoringSymbol }
}

export default { VERSION, DEFAULT_INTERVAL_MS, readConfiguredMonitoringLifecycle, createPaperAutoExitMonitorWorker }
