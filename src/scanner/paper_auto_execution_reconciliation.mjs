import { STATES as S } from './paper_auto_execution_state_machine.mjs'

export const VERSION = 'paper_auto_execution_reconciliation_v1'

const clean = (value) => String(value ?? '').trim()
const upper = (value) => clean(value).toUpperCase()
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null
const unique = (values = []) => [...new Set(values.filter(Boolean))]
const timestamp = (value) => { const ms = Date.parse(clean(value)); return Number.isFinite(ms) ? new Date(ms).toISOString() : null }

function normalizeOrder(order = {}) {
  return Object.freeze({
    id: clean(order.id) || null,
    clientOrderId: clean(order.client_order_id ?? order.clientOrderId) || null,
    symbol: upper(order.symbol),
    side: clean(order.side).toLowerCase(),
    status: clean(order.status).toLowerCase(),
    filledQty: finite(order.filled_qty ?? order.filledQty),
    filledAvgPrice: finite(order.filled_avg_price ?? order.filledAvgPrice),
    submittedAt: timestamp(order.submitted_at ?? order.submittedAt),
    filledAt: timestamp(order.filled_at ?? order.filledAt),
  })
}

function normalizePosition(position = {}) {
  return Object.freeze({
    assetId: clean(position.asset_id ?? position.assetId) || null,
    symbol: upper(position.symbol),
    qty: finite(position.qty),
    avgEntryPrice: finite(position.avg_entry_price ?? position.avgEntryPrice),
  })
}

export function reconcilePaperAutoExecution({ lifecycle, orders = [], positions = [] } = {}) {
  if (!lifecycle || typeof lifecycle !== 'object') throw new Error('paper_auto_reconciliation_lifecycle_required')
  const symbol = upper(lifecycle.selectedSymbol)
  if (!symbol) throw new Error('paper_auto_reconciliation_symbol_required')

  const normalizedOrders = orders.map(normalizeOrder)
  const normalizedPositions = positions.map(normalizePosition)
  const enterOrder = normalizedOrders.find((order) => order.clientOrderId && order.clientOrderId === lifecycle.enterClientOrderId) ?? null
  const exitOrder = normalizedOrders.find((order) => order.clientOrderId && order.clientOrderId === lifecycle.exitClientOrderId) ?? null
  const matchingPositions = normalizedPositions.filter((position) => position.symbol === symbol && Number(position.qty) > 0)
  const blockers = []

  if (matchingPositions.length > 1) blockers.push('multiple_matching_positions')
  const position = matchingPositions[0] ?? null

  let nextState = lifecycle.state
  const patch = { reconciliation: [...(lifecycle.reconciliation ?? [])] }
  if (enterOrder?.submittedAt) patch.enterBrokerSubmittedAt = enterOrder.submittedAt
  if (enterOrder?.filledAt) patch.enterBrokerFilledAt = enterOrder.filledAt
  if (exitOrder?.submittedAt) patch.exitBrokerSubmittedAt = exitOrder.submittedAt
  if (exitOrder?.filledAt) patch.exitBrokerFilledAt = exitOrder.filledAt

  if ([S.ENTER_SUBMITTING, S.ENTER_UNKNOWN, S.ENTER_OPEN, S.ENTER_PARTIALLY_FILLED, S.UNRESOLVED_NEEDS_RECONCILIATION].includes(lifecycle.state)) {
    if (position) {
      patch.filledQuantity = position.qty
      patch.averageFillPrice = position.avgEntryPrice
      patch.brokerPositionIdentity = position.assetId ?? `${position.symbol}:${position.qty}`
      if (enterOrder?.id) patch.enterBrokerOrderId = enterOrder.id
      nextState = S.POSITION_CONFIRMED
    } else if (enterOrder?.status === 'partially_filled' && Number(enterOrder.filledQty) > 0) {
      patch.filledQuantity = enterOrder.filledQty
      patch.averageFillPrice = enterOrder.filledAvgPrice
      if (enterOrder.id) patch.enterBrokerOrderId = enterOrder.id
      nextState = S.ENTER_PARTIALLY_FILLED
    } else if (enterOrder && ['new', 'accepted', 'pending_new', 'open'].includes(enterOrder.status)) {
      if (enterOrder.id) patch.enterBrokerOrderId = enterOrder.id
      nextState = S.ENTER_OPEN
    } else if (!enterOrder && !position) {
      nextState = S.UNRESOLVED_NEEDS_RECONCILIATION
      blockers.push('enter_identity_not_found')
    }
  }

  if ([S.EXIT_SUBMITTING, S.EXIT_UNKNOWN, S.EXIT_PARTIALLY_FILLED, S.UNRESOLVED_NEEDS_RECONCILIATION].includes(lifecycle.state) && lifecycle.exitClientOrderId) {
    if (!position && exitOrder?.status === 'filled') {
      if (exitOrder.id) patch.exitBrokerOrderId = exitOrder.id
      nextState = S.ROUND_TRIP_COMPLETED
    } else if (exitOrder?.status === 'partially_filled') {
      if (exitOrder.id) patch.exitBrokerOrderId = exitOrder.id
      nextState = S.EXIT_PARTIALLY_FILLED
    } else if (position && exitOrder && ['new', 'accepted', 'pending_new', 'open'].includes(exitOrder.status)) {
      if (exitOrder.id) patch.exitBrokerOrderId = exitOrder.id
      nextState = S.EXIT_SUBMITTING
    } else if (!exitOrder) {
      nextState = S.UNRESOLVED_NEEDS_RECONCILIATION
      blockers.push('exit_identity_not_found')
    }
  }

  patch.reconciliation.push(Object.freeze({
    at: new Date().toISOString(),
    fromState: lifecycle.state,
    nextState,
    enterOrderFound: Boolean(enterOrder),
    exitOrderFound: Boolean(exitOrder),
    positionFound: Boolean(position),
    blockers: unique(blockers),
    enterSubmittedAt: enterOrder?.submittedAt ?? null,
    enterFilledAt: enterOrder?.filledAt ?? null,
    exitSubmittedAt: exitOrder?.submittedAt ?? null,
    exitFilledAt: exitOrder?.filledAt ?? null,
  }))

  return Object.freeze({
    ok: true,
    version: VERSION,
    nextState,
    patch: Object.freeze(patch),
    blockers: Object.freeze(unique(blockers)),
    resolved: ![S.UNRESOLVED_NEEDS_RECONCILIATION].includes(nextState),
    safety: Object.freeze({ paperOnly: true, liveTradingAllowed: false, brokerMutationAllowed: false, orderPlacementAllowed: false }),
  })
}

export default { VERSION, reconcilePaperAutoExecution }
