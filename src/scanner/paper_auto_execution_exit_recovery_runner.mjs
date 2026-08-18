import fs from 'node:fs'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { fetchAlpacaPaperHistoricalOrdersReadonly } from './paper_auto_execution_reporting_history_fetch.mjs'
import { runPaperAutoExecutionReconciliation } from './paper_auto_execution_reconciliation_runner.mjs'
import { resolveInternalOwnerAlpacaReadonlyCredentials } from './internal_owner_alpaca_readonly_credentials.mjs'

export const VERSION = 'paper_auto_execution_exit_recovery_runner_v1'
const clean = v => String(v ?? '').trim()
const RECOVERY_STATES = new Set([S.EXIT_SUBMITTING, S.EXIT_UNKNOWN, S.EXIT_PARTIALLY_FILLED])

export function createPaperAutoExecutionExitRecoveryRunner(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const getLifecycleFile = options.getLifecycleFile ?? (() => clean(env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH ?? env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH))
  const credentialResolver = options.accountCredentialResolver ?? resolveInternalOwnerAlpacaReadonlyCredentials
  const fetchAccount = options.fetchAccount ?? (args => fetchAlpacaPaperAccountReadonly(args))
  const fetchHistory = options.fetchHistoricalOrders ?? (args => fetchAlpacaPaperHistoricalOrdersReadonly(args))
  const reconcile = options.reconcile ?? runPaperAutoExecutionReconciliation
  const degradedBrokerMode = options.degradedBrokerMode ?? null
  const now = options.now ?? Date.now
  let inFlight = null
  let cycles = 0
  let reconciliations = 0
  let lastStatus = 'NOT_RUN'
  let lastError = null
  let lastLifecycleFile = null
  let lastLifecycle = null
  let lastReconciliation = null

  const diagnostics = () => Object.freeze({
    ok: true,
    version: VERSION,
    cycles,
    reconciliations,
    lastStatus,
    lastError,
    lastLifecycleFile,
    lastLifecycle,
    lastReconciliation,
    degradedBrokerMode: degradedBrokerMode?.diagnostics?.() ?? null,
    safety: Object.freeze({
      paperOnly: true,
      exactActiveLifecycleOnly: true,
      readOnlyBrokerRecovery: true,
      allowedBrokerMethods: Object.freeze(['GET']),
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      replacementAllowed: false,
      liveTradingAllowed: false,
    }),
  })

  const finish = (status, lifecycle = null) => {
    lastStatus = status
    lastLifecycle = lifecycle
    return diagnostics()
  }

  async function cycle() {
    cycles += 1
    lastError = null
    const lifecycleFile = clean(await getLifecycleFile?.())
    lastLifecycleFile = lifecycleFile || null
    if (!lifecycleFile) return finish('ACTIVE_LIFECYCLE_PATH_REQUIRED')
    if (!fs.existsSync(lifecycleFile)) return finish('ACTIVE_LIFECYCLE_FILE_MISSING')
    const store = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
    const lifecycle = store.load()
    lastLifecycle = lifecycle
    if (!lifecycle) return finish('ACTIVE_LIFECYCLE_REQUIRED')
    const exitOwnedUnresolved = lifecycle.state === S.UNRESOLVED_NEEDS_RECONCILIATION
      && Boolean(clean(lifecycle.exitClientOrderId) || clean(lifecycle.exitBrokerOrderId))
    if (!RECOVERY_STATES.has(lifecycle.state) && !exitOwnedUnresolved) return finish('EXIT_RECOVERY_NOT_REQUIRED', lifecycle)
    if (lifecycle?.scannerEvidence?.paperOnly !== true) return finish('PAPER_ONLY_LIFECYCLE_REQUIRED', lifecycle)

    if (degradedBrokerMode?.evaluateAction) {
      const brokerModeDecision = degradedBrokerMode.evaluateAction({ action: 'EXIT_RECOVERY' })
      if (brokerModeDecision?.allowed !== true) return finish(brokerModeDecision?.status ?? 'DEGRADED_BROKER_EXIT_RECOVERY_BLOCKED', lifecycle)
    }

    const resolved = typeof credentialResolver === 'function'
      ? await credentialResolver({ env, masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY, purpose: 'paper_exit_recovery_credentials' })
      : null
    if (resolved?.readyForReadonlyBrokerRead !== true) return finish('PAPER_CREDENTIALS_NOT_READY', lifecycle)
    const effectiveEnv = { ...env, ...(resolved.env ?? {}) }
    if (clean(effectiveEnv.APCA_API_BASE_URL) !== 'https://paper-api.alpaca.markets') return finish('PAPER_HOST_REQUIRED', lifecycle)

    let account, history
    try {
      ;[account, history] = await Promise.all([
        fetchAccount({ env: effectiveEnv, fetchImpl, credentialResolver: null }),
        fetchHistory({ env: effectiveEnv, fetchImpl, credentialResolver: null }),
      ])
    } catch (error) {
      const message = clean(error?.message ?? error)
      if (message.startsWith('paper_reporting_history_fetch_failed:')) {
        degradedBrokerMode?.recordFailure?.({ kind: 'HISTORY_READ_FAILED', reason: message })
      }
      throw error
    }
    if (account?.ok !== true || account?.status !== 'connected_readonly') {
      if (account?.status === 'readonly_fetch_failed') {
        degradedBrokerMode?.recordFailure?.({ kind: 'ACCOUNT_READ_FAILED', reason: clean(account?.status) })
      }
      return finish('FRESH_PAPER_ACCOUNT_REQUIRED', lifecycle)
    }
    if (account?.account?.tradingBlocked === true || account?.account?.accountBlocked === true) {
      degradedBrokerMode?.recordFailure?.({ kind: 'BROKER_ACCOUNT_BLOCKED', reason: 'exit_recovery_account_blocked' })
    }
    if (history?.paperOnly !== true || history?.readOnly !== true || history?.brokerContactType !== 'readonly_get' || history?.orderPlacementAllowed !== false || history?.accountMutationAllowed !== false) {
      return finish('READONLY_HISTORY_REQUIRED', lifecycle)
    }
    if (history?.historyLimitReached === true) {
      const exitClientId = clean(lifecycle.exitClientOrderId)
      const exitBrokerId = clean(lifecycle.exitBrokerOrderId)
      const visibleOrders = [...(history?.historicalOrders ?? []), ...(account?.openOrders ?? [])]
      const identityVisible = visibleOrders.some((order = {}) => {
        const clientId = clean(order.client_order_id ?? order.clientOrderId)
        const brokerId = clean(order.id)
        if (exitClientId && clientId !== exitClientId) return false
        if (exitBrokerId && brokerId !== exitBrokerId) return false
        return Boolean(exitClientId || exitBrokerId)
      })
      if (!identityVisible) return finish('EXIT_HISTORY_TRUNCATED_IDENTITY_NOT_FOUND', lifecycle)
    }

    lastReconciliation = await reconcile({
      lifecycleStore: store,
      accountSnapshot: account,
      historicalOrders: history?.historicalOrders ?? [],
      nowMs: Number(now()),
    })
    reconciliations += 1
    lastLifecycle = lastReconciliation?.lifecycle ?? store.load()
    lastStatus = lastReconciliation?.status ?? 'EXIT_RECOVERY_RECONCILIATION_COMPLETED'
    return diagnostics()
  }

  return Object.freeze({
    diagnostics,
    runOnce() {
      if (inFlight) return inFlight
      inFlight = cycle().catch(error => {
        lastError = error?.message ?? String(error)
        lastStatus = 'EXIT_RECOVERY_FAILED_CLOSED'
        return diagnostics()
      }).finally(() => { inFlight = null })
      return inFlight
    },
  })
}

export default { VERSION, createPaperAutoExecutionExitRecoveryRunner }
