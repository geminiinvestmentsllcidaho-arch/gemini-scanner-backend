export const VERSION = 'paper_auto_execution_reporting_history_v1'

const clean = (value) => String(value ?? '').trim()
const upper = (value) => clean(value).toUpperCase()
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null

function timestamp(value) {
  const parsed = Date.parse(clean(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function normalizeFilledPaperOrder(order = {}, index = 0) {
  const brokerOrderId = clean(order.id)
  const clientOrderId = clean(order.client_order_id ?? order.clientOrderId)
  const symbol = upper(order.symbol)
  const side = clean(order.side).toLowerCase()
  const status = clean(order.status).toLowerCase()
  const qty = finite(order.filled_qty ?? order.filledQty)
  const fillPrice = finite(order.filled_avg_price ?? order.filledAvgPrice)
  const filledAt = timestamp(order.filled_at ?? order.filledAt)

  if (
    !brokerOrderId
    || !symbol
    || !['buy', 'sell'].includes(side)
    || status !== 'filled'
    || !(qty > 0)
    || !(fillPrice > 0)
    || !filledAt
  ) {
    return null
  }

  return Object.freeze({
    fillId: brokerOrderId,
    brokerOrderId,
    clientOrderId: clientOrderId || null,
    symbol,
    side,
    qty,
    fillPrice,
    filledAt,
    createdAt: filledAt,
    source: 'alpaca_paper_order_history',
    paperOnly: true,
    brokerConfirmed: true,
    index,
  })
}

export function adaptAlpacaPaperFilledOrderHistory({ historicalOrders = [] } = {}) {
  const records = Array.isArray(historicalOrders) ? historicalOrders : []
  const byBrokerOrderId = new Map()
  let invalidOrUnfilledRecordCount = 0

  records.forEach((order, index) => {
    const normalized = normalizeFilledPaperOrder(order, index)
    if (!normalized) {
      invalidOrUnfilledRecordCount += 1
      return
    }
    if (!byBrokerOrderId.has(normalized.brokerOrderId)) {
      byBrokerOrderId.set(normalized.brokerOrderId, normalized)
    }
  })

  const fillRecords = [...byBrokerOrderId.values()]
    .sort((a, b) =>
      Date.parse(a.filledAt) - Date.parse(b.filledAt)
      || a.index - b.index
      || a.brokerOrderId.localeCompare(b.brokerOrderId)
    )
    .map(({ index, ...record }) => Object.freeze(record))

  return Object.freeze({
    version: VERSION,
    sourceRecordCount: records.length,
    fillRecordCount: fillRecords.length,
    invalidOrUnfilledRecordCount,
    duplicateBrokerOrderCount: records.length - invalidOrUnfilledRecordCount - fillRecords.length,
    fillRecords: Object.freeze(fillRecords),
    readOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAlowed: false,
    accountMutationAllowed: false,
    legacySourceIntentSemanticsFabricated: false,
  })
}

export default { VERSION, adaptAlpacaPaperFilledOrderHistory }
