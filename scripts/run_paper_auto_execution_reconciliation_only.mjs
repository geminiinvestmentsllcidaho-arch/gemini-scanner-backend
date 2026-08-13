import { pathToFileURL } from 'node:url'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { fetchAlpacaPaperAccountReadonly } from '../src/scanner/alpaca_paper_account_readonly_fetch.mjs'
import { resolveInternalOwnerAlpacaReadonlyCredentials } from '../src/scanner/internal_owner_alpaca_readonly_credentials.mjs'
import { runPaperAutoExecutionReconciliation } from '../src/scanner/paper_auto_execution_reconciliation_runner.mjs'

export const VERSION = 'paper_auto_execution_reconciliation_only_cli_v1'

const clean = (value) => String(value ?? '').trim()

export async function fetchPaperHistoricalOrdersReadonly({
  env = process.env,
  fetchImpl = globalThis.fetch,
  credentialResolver = resolveInternalOwnerAlpacaReadonlyCredentials,
} = {}) {
  const rawBaseUrl = clean(env.APCA_API_BASE_URL) || 'https://paper-api.alpaca.markets'
  const parsed = new URL(rawBaseUrl)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'paper-api.alpaca.markets') {
    throw new Error('paper_reconciliation_only_paper_host_required')
  }

  const directKey = clean(env.APCA_API_KEY_ID)
  const directSecret = clean(env.APCA_API_SECRET_KEY)
  const resolved = typeof credentialResolver === 'function'
    ? await credentialResolver({
        masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY,
        purpose: 'paper_reconciliation_only_historical_orders_readonly',
      })
    : null

  const key = clean(
    resolved?.readyForReadonlyBrokerRead === true
      ? resolved?.env?.ALPACA_KEY
      : directKey,
  )
  const secret = clean(
    resolved?.readyForReadonlyBrokerRead === true
      ? resolved?.env?.ALPACA_SECRET
      : directSecret,
  )
  if (!key || !secret) {
    throw new Error('paper_reconciliation_only_order_history_credentials_required')
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('paper_reconciliation_only_fetch_required')
  }

  const response = await fetchImpl(
    new URL('/v2/orders?status=all&limit=500&direction=desc', parsed),
    {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret,
        Accept: 'application/json',
      },
    },
  )
  const body = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(body)) {
    throw new Error(`paper_reconciliation_only_order_history_failed:${response.status}`)
  }
  return body
}

export async function runPaperAutoExecutionReconciliationOnly(options = {}) {
  const env = options.env ?? process.env
  const lifecyclePath = clean(
    options.lifecyclePath
      ?? env.PAPER_AUTO_RECONCILIATION_LIFECYCLE_PATH
      ?? process.argv[2],
  )
  if (!lifecyclePath) {
    throw new Error('paper_reconciliation_only_lifecycle_path_required')
  }

  const lifecycleStore = options.lifecycleStore
    ?? new PaperAutoExecutionLifecycleStore({ filePath: lifecyclePath })
  const lifecycle = lifecycleStore.load()
  if (!lifecycle) {
    throw new Error('paper_reconciliation_only_lifecycle_missing')
  }
  if (lifecycle.state !== 'EXIT_UNKNOWN') {
    throw new Error(
      `paper_reconciliation_only_exit_unknown_required:${clean(lifecycle.state) || 'unknown'}`,
    )
  }
  if (!clean(lifecycle.exitClientOrderId) || !clean(lifecycle.exitBrokerOrderId)) {
    throw new Error('paper_reconciliation_only_exit_identity_required')
  }

  const credentialResolver = options.credentialResolver
    ?? resolveInternalOwnerAlpacaReadonlyCredentials
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  const accountSnapshot = options.accountSnapshot
    ?? await fetchAlpacaPaperAccountReadonly({
      env,
      fetchImpl,
      credentialResolver,
    })
  const historicalOrders = options.historicalOrders
    ?? await fetchPaperHistoricalOrdersReadonly({
      env,
      fetchImpl,
      credentialResolver,
    })

  const result = await runPaperAutoExecutionReconciliation({
    lifecycleStore,
    accountSnapshot,
    historicalOrders,
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }),
    ...(options.maxAgeMs === undefined ? {} : { maxAgeMs: options.maxAgeMs }),
    ...(options.incidentEmitter === undefined
      ? {}
      : { incidentEmitter: options.incidentEmitter }),
  })

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: result.status,
    changed: result.changed,
    lifecycle: result.lifecycle,
    blockers: result.blockers,
    safety: Object.freeze({
      paperOnly: true,
      brokerReadsOnly: true,
      allowedMethods: Object.freeze(['GET']),
      orderPlacementAllowed: false,
      cancelAllowed: false,
      accountMutationAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

async function main() {
  const result = await runPaperAutoExecutionReconciliationOnly()
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${clean(error?.message) || 'paper_reconciliation_only_failed'}\n`)
    process.exitCode = 1
  })
}
