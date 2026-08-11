export const VERSION = 'paper_auto_execution_alpaca_paper_adapter_v1'

const clean = (value) => String(value ?? '').trim()
const enabled = (env, key) => clean(env?.[key]) === '1'
const timestamp = (value) => { const ms = Date.parse(clean(value)); return Number.isFinite(ms) ? new Date(ms).toISOString() : null }

function pick(env, names) {
  for (const name of names) {
    const value = clean(env?.[name])
    if (value) return value
  }
  return ''
}

function blocked(blockers) {
  return Object.freeze({
    ok: true,
    version: VERSION,
    status: 'PAPER_AUTO_ADAPTER_BLOCKED',
    blockers: Object.freeze([...new Set(blockers)]),
    networkAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    brokerOrderId: null,
    orderId: null,
    clientOrderId: null,
    httpStatus: null,
    submittedAt: null,
    filledAt: null,
  })
}

export function createPaperAutoExecutionAlpacaPaperAdapter({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const diagnostics = () => Object.freeze({
    version: VERSION,
    enabled: enabled(env, 'PAPER_AUTO_ALPACA_ADAPTER_ENABLED'),
    fetchPresent: typeof fetchImpl === 'function',
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      disabledByDefault: true,
      serverIntegrated: false,
      automaticStartAllowed: false,
      retryAllowed: false,
      exactClientOrderIdentityRequired: true,
      injectedFetchOnlyTestable: true,
    }),
  })

  const submitPaperOrder = async (order = {}) => {
    const blockers = []
    const symbol = clean(order.symbol).toUpperCase()
    const quantity = Number(order.quantity ?? order.qty)
    const side = clean(order.side).toLowerCase()
    const type = clean(order.type || 'market').toLowerCase()
    const timeInForce = clean(order.timeInForce ?? order.time_in_force ?? 'day').toLowerCase()
    const clientOrderId = clean(order.clientOrderId ?? order.client_order_id)

    if (!enabled(env, 'PAPER_AUTO_ALPACA_ADAPTER_ENABLED')) blockers.push('paper_auto_alpaca_adapter_disabled')
    if (order.paperOnly !== true) blockers.push('paper_only_order_required')
    if (!symbol) blockers.push('symbol_required')
    if (!Number.isFinite(quantity) || quantity <= 0) blockers.push('positive_quantity_required')
    if (!['buy', 'sell'].includes(side)) blockers.push('buy_or_sell_side_required')
    if (type !== 'market') blockers.push('market_order_required')
    if (timeInForce !== 'day') blockers.push('day_time_in_force_required')
    if (!clientOrderId) blockers.push('client_order_id_required')
    if (typeof fetchImpl !== 'function') blockers.push('fetch_required')

    const baseUrl = pick(env, ['PAPER_AUTO_ALPACA_PAPER_BASE_URL', 'ALPACA_PAPER_TRADING_BASE_URL', 'APCA_API_BASE_URL', 'ALPACA_PAPER_BASE_URL'])
    const apiKey = pick(env, ['PAPER_AUTO_ALPACA_PAPER_KEY', 'ALPACA_KEY', 'ALPACA_API_KEY_ID', 'ALPACA_KEY_ID', 'APCA_API_KEY_ID'])
    const apiSecret = pick(env, ['PAPER_AUTO_ALPACA_PAPER_SECRET', 'ALPACA_SECRET', 'ALPACA_API_SECRET_KEY', 'ALPACA_SECRET_KEY', 'APCA_API_SECRET_KEY'])

    let parsedBase = null
    try {
      parsedBase = new URL(baseUrl)
    } catch {
      blockers.push('paper_base_url_invalid')
    }
    if (parsedBase?.protocol !== 'https:' || parsedBase?.hostname !== 'paper-api.alpaca.markets') {
      blockers.push('alpaca_paper_host_required')
    }
    if (!apiKey || !apiSecret) blockers.push('paper_credentials_required')
    if (blockers.length) return blocked(blockers)

    const payload = Object.freeze({
      symbol,
      qty: String(quantity),
      side,
      type: 'market',
      time_in_force: 'day',
      client_order_id: clientOrderId,
    })

    let response
    let bodyText = ''
    try {
      response = await fetchImpl(new URL('/v2/orders', parsedBase).toString(), {
        method: 'POST',
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      bodyText = await response.text()
    } catch (error) {
      const failure = new Error('paper_auto_alpaca_adapter_ambiguous_failure')
      failure.cause = error
      throw failure
    }

    let body = null
    try {
      body = bodyText ? JSON.parse(bodyText) : null
    } catch {}

    const brokerOrderId = clean(body?.id) || null
    const submittedAt = timestamp(body?.submitted_at ?? body?.submittedAt)
    const filledAt = timestamp(body?.filled_at ?? body?.filledAt)
    const submitted = response.ok === true && Boolean(brokerOrderId)
    return Object.freeze({
      ok: response.ok === true,
      version: VERSION,
      status: submitted ? 'PAPER_AUTO_ORDER_SUBMITTED' : 'PAPER_AUTO_ORDER_REJECTED',
      blockers: Object.freeze(submitted ? [] : ['alpaca_paper_order_not_confirmed']),
      networkAttempted: true,
      orderSubmitAttempted: true,
      orderSubmitted: submitted,
      rejected: response.ok !== true,
      brokerOrderId,
      orderId: brokerOrderId,
      clientOrderId,
      httpStatus: Number(response.status),
      submittedAt,
      filledAt,
    })
  }

  return Object.freeze({ submitPaperOrder, diagnostics })
}

export default { VERSION, createPaperAutoExecutionAlpacaPaperAdapter }
