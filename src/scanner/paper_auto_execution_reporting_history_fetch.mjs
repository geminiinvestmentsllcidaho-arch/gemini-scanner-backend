export const VERSION = 'paper_auto_execution_reporting_history_fetch_v1'
export const HISTORICAL_ORDER_LIMIT = 500

const clean = (value) => String(value ?? '').trim()
const pick = (env, keys) => keys.map((key) => clean(env?.[key])).find(Boolean) ?? ''

export async function fetchAlpacaPaperHistoricalOrdersReadonly(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const credentialResolver = options.credentialResolver
  let effectiveEnv = env
  if (typeof credentialResolver === 'function') {
    const resolved = await credentialResolver({
      masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY,
      ...(options.credentialOptions ?? {}),
    })
    if (resolved?.readyForReadonlyBrokerRead !== true) throw new Error('paper_reporting_history_credentials_required')
    effectiveEnv = { ...env, ...resolved.env }
  }
  const baseUrl = pick(effectiveEnv, ['ALPACA_PAPER_TRADING_BASE_URL', 'APCA_API_BASE_URL', 'ALPACA_PAPER_BASE_URL', 'ALPACA_BASE_URL'])
  const apiKey = pick(effectiveEnv, ['ALPACA_KEY', 'ALPACA_API_KEY_ID', 'ALPACA_KEY_ID', 'APCA_API_KEY_ID', 'ALPACA_PAPER_API_KEY', 'ALPACA_API_KEY'])
  const apiSecret = pick(effectiveEnv, ['ALPACA_SECRET', 'ALPACA_API_SECRET_KEY', 'ALPACA_SECRET_KEY', 'APCA_API_SECRET_KEY', 'ALPACA_PAPER_API_SECRET', 'ALPACA_API_SECRET'])
  if (baseUrl !== 'https://paper-api.alpaca.markets') throw new Error('paper_reporting_history_paper_host_required')
  if (!apiKey || !apiSecret) throw new Error('paper_reporting_history_credentials_required')
  if (typeof fetchImpl !== 'function') throw new Error('paper_reporting_history_fetch_required')
  const historicalOrders = new Map()
  let cursor = null
  let historyComplete = false
  let historyLimitReached = false
  const seenCursors = new Set()
  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const query = new URLSearchParams({ status: 'all', limit: String(HISTORICAL_ORDER_LIMIT), direction: 'desc' })
    if (cursor) query.set('before_order_id', cursor)
    const response = await fetchImpl(new URL(`/v2/orders?${query}`, baseUrl), {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        Accept: 'application/json',
      },
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !Array.isArray(body)) throw new Error(`paper_reporting_history_fetch_failed:${response.status}`)
    for (const order of body) {
      if (!clean(order?.id)) throw new Error('paper_reporting_history_order_identity_required')
      historicalOrders.set(order.id, order)
    }
    if (body.length < HISTORICAL_ORDER_LIMIT) { historyComplete = true; break }
    historyLimitReached = true
    cursor = clean(body.at(-1)?.id)
    if (seenCursors.has(cursor)) throw new Error('paper_reporting_history_cursor_stalled')
    seenCursors.add(cursor)
  }
  if (!historyComplete) throw new Error('paper_reporting_history_pagination_incomplete')
  const sourceRecordCount = historicalOrders.size
  return Object.freeze({
    version: VERSION,
    historicalOrders: Object.freeze([...historicalOrders.values()]),
    historyLimit: HISTORICAL_ORDER_LIMIT,
    sourceRecordCount,
    historyLimitReached,
    historyComplete,
    historyPossiblyTruncated: !historyComplete,
    readOnly: true,
    paperOnly: true,
    brokerContactType: 'readonly_get',
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  })
}

export default { VERSION, fetchAlpacaPaperHistoricalOrdersReadonly }
