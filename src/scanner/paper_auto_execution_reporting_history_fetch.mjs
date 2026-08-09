export const VERSION = 'paper_auto_execution_reporting_history_fetch_v1'

const clean = (value) => String(value ?? '').trim()
const pick = (env, keys) => keys.map((key) => clean(env?.[key])).find(Boolean) ?? ''

export async function fetchAlpacaPaperHistoricalOrdersReadonly(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const baseUrl = pick(env, ['ALPACA_PAPER_TRADING_BASE_URL', 'APCA_API_BASE_URL', 'ALPACA_PAPER_BASE_URL', 'ALPACA_BASE_URL'])
  const apiKey = pick(env, ['ALPACA_KEY', 'ALPACA_API_KEY_ID', 'ALPACA_KEY_ID', 'APCA_API_KEY_ID', 'ALPACA_PAPER_API_KEY', 'ALPACA_API_KEY'])
  const apiSecret = pick(env, ['ALPACA_SECRET', 'ALPACA_API_SECRET_KEY', 'ALPACA_SECRET_KEY', 'APCA_API_SECRET_KEY', 'ALPACA_PAPER_API_SECRET', 'ALPACA_API_SECRET'])
  if (baseUrl !== 'https://paper-api.alpaca.markets') throw new Error('paper_reporting_history_paper_host_required')
  if (!apiKey || !apiSecret) throw new Error('paper_reporting_history_credentials_required')
  if (typeof fetchImpl !== 'function') throw new Error('paper_reporting_history_fetch_required')
  const response = await fetchImpl(new URL('/v2/orders?status=all&limit=500&direction=desc', baseUrl), {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      Accept: 'application/json',
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(body)) throw new Error(`paper_reporting_history_fetch_failed:${response.status}`)
  return Object.freeze({
    version: VERSION,
    historicalOrders: Object.freeze(body),
    readOnly: true,
    paperOnly: true,
    brokerContactType: 'readonly_get',
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  })
}

export default { VERSION, fetchAlpacaPaperHistoricalOrdersReadonly }
