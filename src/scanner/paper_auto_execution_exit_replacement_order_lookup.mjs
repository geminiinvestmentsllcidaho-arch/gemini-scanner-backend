import { buildAlpacaPaperReadonlyRuntime } from './alpaca_paper_account_readonly_fetch.mjs'
import { resolveInternalOwnerAlpacaReadonlyCredentials } from './internal_owner_alpaca_readonly_credentials.mjs'

export const VERSION = 'paper_auto_execution_exit_replacement_order_lookup_v1'
const PAPER_BASE_URL = 'https://paper-api.alpaca.markets'
const clean = value => String(value ?? '').trim()

export async function fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly({
  clientOrderId,
  env = process.env,
  fetchImpl = globalThis.fetch,
  credentialResolver = resolveInternalOwnerAlpacaReadonlyCredentials,
  credentialOptions = {},
} = {}) {
  const id = clean(clientOrderId)
  if (!id) throw new Error('paper_exit_replacement_order_lookup_client_order_id_required')

  let effectiveEnv = env
  let credentialSource = 'runtime_env'
  if (typeof credentialResolver === 'function') {
    const resolved = await credentialResolver({
      masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY,
      ...credentialOptions,
    })
    if (resolved?.readyForReadonlyBrokerRead === true) {
      effectiveEnv = { ...env, ...resolved.env }
      credentialSource = 'encrypted_tenant_store'
    } else {
      return Object.freeze({
        ok: true, version: VERSION, status: 'not_connected_readonly',
        clientOrderId: id, order: null,
        credentialSource: resolved?.accessSwitchEnabled === false
          ? 'master_access_switch_off'
          : 'readonly_credential_resolver_not_ready',
        paperOnly: true, readOnly: true, brokerContactType: 'none',
        orderPlacementAllowed: false, accountMutationAllowed: false,
      })
    }
  }

  const { baseUrl, apiKey, apiSecret } = buildAlpacaPaperReadonlyRuntime(effectiveEnv)
  if (baseUrl !== PAPER_BASE_URL) throw new Error('paper_exit_replacement_order_lookup_paper_host_required')
  if (!apiKey || !apiSecret) throw new Error('paper_exit_replacement_order_lookup_credentials_required')
  if (typeof fetchImpl !== 'function') throw new Error('paper_exit_replacement_order_lookup_fetch_required')

  const url = new URL('/v2/orders:by_client_order_id', baseUrl)
  url.searchParams.set('client_order_id', id)
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      Accept: 'application/json',
    },
  })
  const body = await response.json().catch(() => null)
  if (response.status === 404) return Object.freeze({
    ok: true, version: VERSION, status: 'order_not_found',
    clientOrderId: id, order: null, credentialSource,
    paperOnly: true, readOnly: true, brokerContactType: 'readonly_get',
    orderPlacementAllowed: false, accountMutationAllowed: false,
  })
  if (!response.ok || !body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`paper_exit_replacement_order_lookup_fetch_failed:${response.status}`)
  }
  if (clean(body.client_order_id) !== id) throw new Error('paper_exit_replacement_order_lookup_identity_mismatch')

  return Object.freeze({
    ok: true, version: VERSION, status: 'order_found',
    clientOrderId: id, order: Object.freeze(body), credentialSource,
    paperOnly: true, readOnly: true, brokerContactType: 'readonly_get',
    orderPlacementAllowed: false, accountMutationAllowed: false,
  })
}

export default { VERSION, fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly }
