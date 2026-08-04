export const VERSION = 'paper_auto_execution_snapshot_adapter_v1'

const clean = (value) => String(value ?? '').trim()
const upper = (value) => clean(value).toUpperCase()
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null

function normalizeOrder(order = {}) {
  return Object.freeze({
    id: clean(order.id) || null,
    clientOrderId: clean(order.clientOrderId ?? order.client_order_id) || null,
    symbol: upper(order.symbol),
    side: clean(order.side).toLowerCase(),
    status: clean(order.status).toLowerCase(),
    filledQty: finite(order.filledQty ?? order.filled_qty),
    filledAvgPrice: finite(order.filledAvgPrice ?? order.filled_avg_price),
  })
}

function normalizePosition(position = {}) {
  return Object.freeze({
    assetId: clean(position.assetId ?? position.asset_id) || null,
    symbol: upper(position.symbol),
    qty: finite(position.qty),
    avgEntryPrice: finite(position.averageEntryPrice ?? position.avgEntryPrice ?? position.avg_entry_price),
  })
}

export function adaptPaperAutoExecutionSnapshot({
  accountSnapshot,
  historicalOrders = [],
  nowMs = Date.now(),
  maxAgeMs = 120_000,
} = {}) {
  const blockers = []
  if (!accountSnapshot || typeof accountSnapshot !== 'object') blockers.push('account_snapshot_required')
  if (accountSnapshot?.status !== 'connected_readonly') blockers.push('connected_readonly_snapshot_required')
  if (accountSnapshot?.mode !== 'PAPER_ONLY') blockers.push('paper_only_snapshot_required')
  if (accountSnapshot?.runtime?.readOnly !== true) blockers.push('readonly_runtime_required')
  if (accountSnapshot?.runtime?.allowedMethods?.some((method) => method !== 'GET')) blockers.push('get_only_runtime_required')

  const observedMs = Date.parse(accountSnapshot?.observedAt ?? '')
  if (!Number.isFinite(observedMs)) blockers.push('snapshot_observed_at_required')
  else {
    const ageMs = Number(nowMs) - observedMs
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > Number(maxAgeMs)) blockers.push('account_snapshot_stale')
  }

  const positions = Array.isArray(accountSnapshot?.positions)
    ? accountSnapshot.positions.map(normalizePosition)
    : []
  const openOrders = Array.isArray(accountSnapshot?.openOrders)
    ? accountSnapshot.openOrders.map(normalizeOrder)
    : []
  const completedOrders = Array.isArray(historicalOrders)
    ? historicalOrders.map(normalizeOrder)
    : []

  const byIdentity = new Map()
  for (const order of [...completedOrders, ...openOrders]) {
    const key = order.clientOrderId || order.id
    if (key) byIdentity.set(key, order)
  }

  return Object.freeze({
    ok: blockers.length === 0,
    version: VERSION,
    ready: blockers.length === 0,
    blockers: Object.freeze([...new Set(blockers)]),
    orders: Object.freeze([...byIdentity.values()]),
    positions: Object.freeze(positions),
    observedAt: accountSnapshot?.observedAt ?? null,
    safety: Object.freeze({
      paperOnly: true,
      readOnly: true,
      allowedMethods: Object.freeze(['GET']),
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export default { VERSION, adaptPaperAutoExecutionSnapshot }
