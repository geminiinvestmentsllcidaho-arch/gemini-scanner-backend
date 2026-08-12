import fs from 'node:fs'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionAlpacaPaperAdapter } from './paper_auto_execution_alpaca_paper_adapter.mjs'
import { submitPaperAutoOrder } from './paper_auto_execution_submission_boundary.mjs'
import { runPaperAutoExecutionReconciliation } from './paper_auto_execution_reconciliation_runner.mjs'
import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { fetchAlpacaMarketClockReadonly } from './alpaca_market_clock_readonly.mjs'
import { emitAdminPaperOperationalIncident } from './admin_paper_operational_incident_emitter.mjs'

export const VERSION = 'paper_auto_execution_exit_only_runner_v1'
const clean = (value) => String(value ?? '').trim()
const yes = (value) => ['1', 'true', 'yes', 'on'].includes(clean(value).toLowerCase())

async function fetchPaperClock({ env, fetchImpl, credentialResolver }) {
  const parsed = new URL(clean(env.APCA_API_BASE_URL))
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'paper-api.alpaca.markets') throw new Error('paper_exit_only_paper_host_required')

  const directKey = clean(env.APCA_API_KEY_ID)
  const directSecret = clean(env.APCA_API_SECRET_KEY)
  const directCredentialResult = directKey && directSecret
    ? {
        readyForReadonlyBrokerRead: true,
        credentialSource: 'runtime_env_legacy',
        env: { ALPACA_KEY: directKey, ALPACA_SECRET: directSecret },
      }
    : null
  const effectiveCredentialResolver = typeof credentialResolver === 'function'
    ? async (args) => {
        const resolved = await credentialResolver(args)
        return resolved?.readyForReadonlyBrokerRead === true
          ? resolved
          : (directCredentialResult ?? resolved)
      }
    : directCredentialResult
      ? async () => directCredentialResult
      : undefined
  const result = await fetchAlpacaMarketClockReadonly({
    env,
    fetchImpl,
    ...(typeof effectiveCredentialResolver === 'function'
      ? { credentialResolver: effectiveCredentialResolver }
      : {}),
  })
  if (
    result?.ok !== true ||
    result?.status !== 'connected_readonly' ||
    typeof result?.marketClock?.isOpen !== 'boolean'
  ) {
    throw new Error(`paper_exit_only_clock_failed:${clean(result?.status) || 'unknown'}`)
  }
  return { is_open: result.marketClock.isOpen }
}

async function fetchHistoricalOrders({ env, fetchImpl, credentialResolver }) {
  const parsed = new URL(clean(env.APCA_API_BASE_URL))
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'paper-api.alpaca.markets') {
    throw new Error('paper_exit_only_paper_host_required')
  }
  const directKey = clean(env.APCA_API_KEY_ID)
  const directSecret = clean(env.APCA_API_SECRET_KEY)
  const directCredentialResult = directKey && directSecret
    ? {
        readyForReadonlyBrokerRead: true,
        credentialSource: 'runtime_env_legacy',
        env: { ALPACA_KEY: directKey, ALPACA_SECRET: directSecret },
      }
    : null
  const resolved = typeof credentialResolver === 'function'
    ? await credentialResolver({ env, purpose: 'paper_exit_only_historical_orders_readonly' })
    : null
  const credentials = resolved?.readyForReadonlyBrokerRead === true ? resolved : directCredentialResult
  const key = clean(credentials?.env?.ALPACA_KEY)
  const secret = clean(credentials?.env?.ALPACA_SECRET)
  if (!key || !secret) throw new Error('paper_exit_only_order_history_credentials_required')
  const response = await fetchImpl(new URL('/v2/orders?status=all&limit=500&direction=desc', parsed), {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': key,
      'APCA-API-SECRET-KEY': secret,
      Accept: 'application/json',
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(body)) throw new Error(`paper_exit_only_order_history_failed:${response.status}`)
  return body
}

export async function runPaperAutoExecutionExitOnly(options = {}) {
  const incidentEmitter = options.incidentEmitter ?? emitAdminPaperOperationalIncident
  const emitFailOpen = async (failureCode, summary) => {
    try {
      if (typeof incidentEmitter === 'function') {
        await incidentEmitter({
          source: 'paper_execution',
          severity: 'critical',
          failureCode,
          summary,
          phase: 'exit',
          process: 'paper_auto_execution_exit_only_runner',
        })
      }
    } catch {}
  }
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const args = options.args ?? {}
  const nowMs = Number(options.nowMs ?? Date.now())
  const lifecycleFile = clean(args.lifecycleFile ?? args['lifecycle-file'])
  const blockers = []
  if (!yes(args.execute)) blockers.push('explicit_execute_true_required')
  if (!lifecycleFile) blockers.push('lifecycle_file_required')
  if (clean(env.APCA_API_BASE_URL) !== 'https://paper-api.alpaca.markets') blockers.push('alpaca_paper_base_url_required')
  if (clean(env.ALPACA_PAPER_TRADING).toLowerCase() !== 'true') blockers.push('alpaca_paper_trading_flag_required')
  if (
    (!clean(env.APCA_API_KEY_ID) || !clean(env.APCA_API_SECRET_KEY)) &&
    typeof options.accountCredentialResolver !== 'function'
  ) blockers.push('paper_credentials_required')
  if (typeof fetchImpl !== 'function') blockers.push('fetch_required')
  if (blockers.length) return { ok: false, version: VERSION, status: 'EXIT_ONLY_BLOCKED', blockers }

  try {
  const store = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
  const lifecycle = store.load()
  const lifecycleId = clean(args.lifecycleId ?? args['lifecycle-id'])
  const symbol = clean(args.symbol).toUpperCase()
  const quantity = Number(args.quantity)
  if (!lifecycleId) throw new Error('paper_exit_only_exact_lifecycle_id_required')
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('paper_exit_only_exact_symbol_required')
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('paper_exit_only_exact_positive_quantity_required')
  if (!lifecycle || lifecycle.state !== 'MONITORING') throw new Error('paper_exit_only_monitoring_lifecycle_required')
  if (lifecycle.lifecycleId !== lifecycleId) throw new Error('paper_exit_only_lifecycle_id_mismatch')
  store.assertExitTarget({ symbol, quantity })

  const clock = await fetchPaperClock({
    env,
    fetchImpl,
    ...(typeof options.accountCredentialResolver === 'function'
      ? { credentialResolver: options.accountCredentialResolver }
      : {}),
  })
  if (clock.is_open !== true) throw new Error('paper_exit_only_market_open_required')

  const accountBefore = await fetchAlpacaPaperAccountReadonly({
    env,
    fetchImpl,
    ...(typeof options.accountCredentialResolver === 'function'
      ? { credentialResolver: options.accountCredentialResolver }
      : {}),
  })
  if (accountBefore.ok !== true || accountBefore.status !== 'connected_readonly') throw new Error('paper_exit_only_fresh_account_snapshot_required')
  const observedAtMs = Date.parse(accountBefore.observedAt ?? '')
  if (!Number.isFinite(observedAtMs) || Math.abs(nowMs - observedAtMs) > 30000) throw new Error('paper_exit_only_account_snapshot_stale')
  if (accountBefore.account?.tradingBlocked === true || accountBefore.account?.accountBlocked === true) throw new Error('paper_exit_only_account_blocked')
  const exactPosition = (accountBefore.positions ?? []).find((position) =>
    clean(position.symbol).toUpperCase() === symbol &&
    Number(position.qty ?? position.quantity) === quantity
  )
  if (!exactPosition) throw new Error('paper_exit_only_exact_broker_position_required')
  const brokerIdentity = `${clean(exactPosition.symbol).toUpperCase()}:${Number(exactPosition.qty ?? exactPosition.quantity)}`
  if (clean(lifecycle.brokerPositionIdentity) !== brokerIdentity) throw new Error('paper_exit_only_broker_position_identity_mismatch')
  const conflictingOrder = (accountBefore.openOrders ?? []).find((order) =>
    clean(order.symbol).toUpperCase() === symbol &&
    ['buy', 'sell'].includes(clean(order.side).toLowerCase())
  )
  if (conflictingOrder) throw new Error('paper_exit_only_conflicting_open_order')

  const directSubmissionKey = clean(env.APCA_API_KEY_ID)
  const directSubmissionSecret = clean(env.APCA_API_SECRET_KEY)
  const directSubmissionCredentials = directSubmissionKey && directSubmissionSecret
    ? {
        readyForReadonlyBrokerRead: true,
        credentialSource: 'runtime_env_legacy',
        env: { ALPACA_KEY: directSubmissionKey, ALPACA_SECRET: directSubmissionSecret },
      }
    : null
  const resolvedSubmissionCredentials = typeof options.accountCredentialResolver === 'function'
    ? await options.accountCredentialResolver({ env, purpose: 'paper_exit_only_submission_credentials' })
    : null
  const submissionCredentials = resolvedSubmissionCredentials?.readyForReadonlyBrokerRead === true
    ? resolvedSubmissionCredentials
    : directSubmissionCredentials
  const submissionKey = clean(submissionCredentials?.env?.ALPACA_KEY)
  const submissionSecret = clean(submissionCredentials?.env?.ALPACA_SECRET)
  if (!submissionKey || !submissionSecret) throw new Error('paper_exit_only_submission_credentials_required')

  const adapter = createPaperAutoExecutionAlpacaPaperAdapter({
    env: {
      ...env,
      ALPACA_KEY: submissionKey,
      ALPACA_SECRET: submissionSecret,
      PAPER_AUTO_ALPACA_ADAPTER_ENABLED: '1',
    },
    fetchImpl,
  })

  const submission = await submitPaperAutoOrder({
    lifecycleStore: store,
    phase: 'exit',
    quantity,
    submitPaperOrder: adapter.submitPaperOrder,
    env: {
      ...env,
      PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
      PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '1',
    },
  })

  const historicalOrders = await fetchHistoricalOrders({
    env,
    fetchImpl,
    ...(typeof options.accountCredentialResolver === 'function'
      ? { credentialResolver: options.accountCredentialResolver }
      : {}),
  })
  const accountAfter = await fetchAlpacaPaperAccountReadonly({
    env,
    fetchImpl,
    ...(typeof options.accountCredentialResolver === 'function'
      ? { credentialResolver: options.accountCredentialResolver }
      : {}),
  })
  const reconciliation = await runPaperAutoExecutionReconciliation({
    lifecycleStore: store,
    accountSnapshot: accountAfter,
    historicalOrders,
    nowMs: Date.now(),
  })
  const finalLifecycle = store.load()
  const brokerTiming = {
    submittedAt: clean(finalLifecycle?.exitBrokerSubmittedAt ?? submission?.result?.submittedAt) || null,
    filledAt: clean(finalLifecycle?.exitBrokerFilledAt ?? submission?.result?.filledAt) || null,
  }
  const result = {
    ok: finalLifecycle?.state === 'ROUND_TRIP_COMPLETED',
    version: VERSION,
    status: finalLifecycle?.state === 'ROUND_TRIP_COMPLETED'
      ? 'EXACT_POSITION_PAPER_EXIT_COMPLETED'
      : 'EXACT_POSITION_PAPER_EXIT_RECONCILIATION_REQUIRED',
    submission,
    reconciliation,
    lifecycle: finalLifecycle,
    brokerTiming,
    safety: {
      paperOnly: true,
      exitOnly: true,
      enterAllowed: false,
      oneLifecycleOnly: true,
      automaticStartAllowed: false,
      scheduledExecutionAllowed: false,
      liveTradingAllowed: false,
      blindRetryAllowed: false,
    },
  }
  if (options.reportFile) {
    fs.mkdirSync(path.dirname(options.reportFile), { recursive: true })
    fs.writeFileSync(options.reportFile, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  }
  return result
  } catch (error) {
    const failureCode = clean(error?.message).split(':')[0] || 'paper_exit_only_runner_failed'
    await emitFailOpen(
      failureCode,
      'Exact-position PAPER EXIT-only runner failed outside the submission boundary or reconciliation runner.',
    )
    throw error
  }
}

export default { VERSION, runPaperAutoExecutionExitOnly }
