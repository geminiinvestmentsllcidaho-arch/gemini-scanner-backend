import { resolveInternalOwnerAlpacaReadonlyCredentials } from '../src/scanner/internal_owner_alpaca_readonly_credentials.mjs'
import { priceReviewedEntry, quoteFreshnessMs } from '../src/scanner/paused_entry_review_store.mjs'

// Research only. Request the last quote on the same feed at or before the recorded decision.
export async function historicalEntryQuote({ symbol, feed, decisionAt }, {
  fetchImpl = fetch, resolveCredentials = resolveInternalOwnerAlpacaReadonlyCredentials,
} = {}) {
  if (!['iex', 'sip'].includes(feed)) return null
  const at = Date.parse(decisionAt)
  if (!Number.isFinite(at) || new Date(at).toISOString() !== decisionAt) throw Error('invalid recorder decision timestamp')
  const auth = await resolveCredentials({ masterKey: process.env.GEMINI_CREDENTIAL_MASTER_KEY })
  if (!auth.readyForReadonlyBrokerRead || auth.env?.APCA_API_BASE_URL !== 'https://paper-api.alpaca.markets') {
    throw Error('historical quote replay requires configured read-only PAPER credentials')
  }
  const url = new URL('https://data.alpaca.markets/v2/stocks/quotes')
  url.search = new URLSearchParams({ symbols: symbol, feed, asof: '-', start: new Date(at - quoteFreshnessMs).toISOString(), end: decisionAt, sort: 'desc', limit: '1' })
  const response = await fetchImpl(url, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'APCA-API-KEY-ID': auth.env.ALPACA_KEY, 'APCA-API-SECRET-KEY': auth.env.ALPACA_SECRET },
  })
  if (!response.ok) throw Error('historical quote request failed (HTTP ' + response.status + ')')
  const { quotes } = await response.json()
  if (!quotes || typeof quotes !== 'object' || Array.isArray(quotes)) throw Error('invalid historical quote response')
  const raw = quotes[symbol]?.[0]
  if (!raw || !Number.isFinite(raw.bs) || raw.bs <= 0 || !Number.isFinite(raw.as) || raw.as <= 0) return null
  // Date.parse truncates nanoseconds. Reject a quote a fraction of a millisecond after the decision.
  const parts = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(raw.t)
  if (!parts || parts[1] + '.' + (parts[2] ?? '').padEnd(9, '0') + 'Z' > decisionAt.slice(0, -1) + '000000Z') return null
  return priceReviewedEntry({ bid: raw.bp, ask: raw.ap, at: raw.t, feed }, decisionAt)
}
