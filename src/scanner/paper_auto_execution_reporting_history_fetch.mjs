export const VERSION = 'paper_auto_execution_reporting_history_fetch_v1'

const clean = (value) => String(value ?? '').trim()

export async function fetchAlpacaPaperHistoricalOrdersReadonly(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const baseUrl = clean(env.APCA_API_BASE_URL)
  const apiKey = clean(env.APCA_API_KEY_ID)
  const apiSecret = clean(env.APCA_API_SECRET_KEY)
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
