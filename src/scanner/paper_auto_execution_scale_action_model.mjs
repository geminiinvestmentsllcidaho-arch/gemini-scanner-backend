import crypto from 'node:crypto'

export const VERSION = 'paper_auto_execution_scale_action_model_v1'

const clean = value => String(value ?? '').trim()
const upper = value => clean(value).toUpperCase()
const wholePositive = value => {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
const symbolOf = value => {
  const symbol = upper(value)
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('paper_scale_symbol_invalid')
  return symbol
}
const actionOf = value => {
  const action = clean(value).toLowerCase()
  if (!['scale_in', 'scale_out'].includes(action)) throw new Error('paper_scale_action_invalid')
  return action
}
const brokerQty = position => wholePositive(position?.qty ?? position?.quantity)
const brokerSymbol = position => symbolOf(position?.symbol)

export function buildPaperScaleActionIdentity({
  lifecycleId,
  action,
  symbol,
  fromQuantity,
  targetQuantity,
  actionSequence,
} = {}) {
  const lifecycle = clean(lifecycleId)
  if (!lifecycle) throw new Error('paper_scale_lifecycle_id_required')
  const normalizedAction = actionOf(action)
  const normalizedSymbol = symbolOf(symbol)
  const from = wholePositive(fromQuantity)
  const target = wholePositive(targetQuantity)
  const sequence = wholePositive(actionSequence)
  if (from === null) throw new Error('paper_scale_from_whole_quantity_required')
  if (target === null) throw new Error('paper_scale_target_whole_quantity_required')
  if (sequence === null) throw new Error('paper_scale_action_sequence_required')

  const scaleIn = normalizedAction === 'scale_in'
  if (scaleIn && target <= from) throw new Error('paper_scale_in_target_must_increase')
  if (!scaleIn && target >= from) throw new Error('paper_scale_out_target_must_reduce')

  const quantity = Math.abs(target - from)
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('paper_scale_order_quantity_invalid')
  const side = scaleIn ? 'buy' : 'sell'
  const canonical = [
    VERSION,
    lifecycle,
    normalizedAction,
    normalizedSymbol,
    String(sequence),
    String(from),
    String(target),
    String(quantity),
    side,
  ].join('t')
  const digest = crypto.createHash('sha256').update(canonical).digest('hex')
  const clientOrderId = `gs-pa-${normalizedAction === 'scale_in' ? 'scalein' : 'scaleout'}-${digest.slice(0, 20)}`

  return Object.freeze({
    version: VERSION,
    lifecycleId: lifecycle,
    action: normalizedAction,
    symbol: normalizedSymbol,
    actionSequence: sequence,
    fromQuantity: from,
    targetQuantity: target,
    quantity,
    side,
    canonical,
    digest,
    clientOrderId,
    paperOnly: true,
    liveTradingAllowed: false,
  })
}

export function preflightPaperScaleAction({
  lifecycle,
  brokerPosition,
  openOrders = [],
  action,
  targetQuantity,
  actionSequence,
} = {}) {
  if (!lifecycle || lifecycle.state !== 'MONITORING') {
    return Object.freeze({ ok: false, status: 'MONITORING_LIFECYCLE_REQUIRED' })
  }
  const symbol = symbolOf(lifecycle.selectedSymbol)
  const fromQuantity = wholePositive(lifecycle.filledQuantity)
  if (fromQuantity === null) return Object.freeze({ ok: false, status: 'LIFECYCLE_WHOLE_QUANTITY_REQUIRED' })

  let positionSymbol
  let positionQuantity
  try {
    positionSymbol = brokerSymbol(brokerPosition)
    positionQuantity = brokerQty(brokerPosition)
  } catch {
    return Object.freeze({ ok: false, status: 'EXACT_BROKER_POSITION_REQUIRED' })
  }
  if (positionQuantity === null || positionSymbol !== symbol || positionQuantity !== fromQuantity) {
    return Object.freeze({ ok: false, status: 'EXACT_BROKER_POSITION_REQUIRED' })
  }

  const expectedIdentity = `${symbol}:${fromQuantity}`
  const assetId = clean(brokerPosition?.assetId ?? brokerPosition?.asset_id)
  const storedIdentity = clean(lifecycle.brokerPositionIdentity)
  if (!storedIdentity || (storedIdentity !== expectedIdentity && (!assetId || storedIdentity !== assetId))) {
    return Object.freeze({ ok: false, status: 'BROKER_POSITION_IDENTITY_MISMATCH' })
  }

  const conflict = (Array.isArray(openOrders) ? openOrders : []).some(order => {
    const side = clean(order?.side).toLowerCase()
    const orderSymbol = upper(order?.symbol)
    return orderSymbol === symbol && ['buy', 'sell'].includes(side)
  })
  if (conflict) return Object.freeze({ ok: false, status: 'SYMBOL_OPEN_ORDER_CONFLICT' })

  let identity
  try {
    identity = buildPaperScaleActionIdentity({
      lifecycleId: lifecycle.lifecycleId,
      action,
      symbol,
      fromQuantity,
      targetQuantity,
      actionSequence,
    })
  } catch (error) {
    return Object.freeze({ ok: false, status: 'SCALE_ACTION_IDENTITY_INVALID', error: error?.message ?? String(error) })
  }

  return Object.freeze({
    ok: true,
    status: 'PAPER_SCALE_ACTION_PREFLIGHT_READY',
    identity,
    lifecycleState: lifecycle.state,
    brokerPositionQuantity: positionQuantity,
    targetQuantity: identity.targetQuantity,
    orderQuantity: identity.quantity,
    side: identity.side,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
  })
}

export function reconcilePaperScaleActionFill({
  lifecycle,
  identity,
  order,
  brokerPositionAfter,
} = {}) {
  if (!lifecycle || lifecycle.state !== 'MONITORING') {
    return Object.freeze({ ok: false, status: 'MONITORING_LIFECYCLE_REQUIRED' })
  }
  if (!identity || identity.lifecycleId !== lifecycle.lifecycleId || upper(identity.symbol) !== upper(lifecycle.selectedSymbol)) {
    return Object.freeze({ ok: false, status: 'SCALE_ACTION_LIFECYCLE_IDENTITY_MISMATCH' })
  }
  if (wholePositive(identity.actionSequence) === null) {
    return Object.freeze({ ok: false, status: 'SCALE_ACTION_SEQUENCE_REQUIRED' })
  }
  const status = clean(order?.status).toLowerCase()
  const clientOrderId = clean(order?.clientOrderId ?? order?.client_order_id)
  const filledQty = wholePositive(order?.filledQty ?? order?.filled_qty)
  if (status !== 'filled' || clientOrderId !== identity.clientOrderId || filledQty !== identity.quantity) {
    return Object.freeze({ ok: false, status: 'BROKER_SCALE_FILL_NOT_EXACT' })
  }

  const afterQty = brokerQty(brokerPositionAfter)
  let afterSymbol = null
  try { afterSymbol = brokerSymbol(brokerPositionAfter) } catch {}
  if (afterQty !== identity.targetQuantity || afterSymbol !== identity.symbol) {
    return Object.freeze({ ok: false, status: 'BROKER_POST_SCALE_POSITION_NOT_EXACT' })
  }

  const assetId = clean(brokerPositionAfter?.assetId ?? brokerPositionAfter?.asset_id)
  const averageEntryPrice = Number(brokerPositionAfter?.averageEntryPrice ?? brokerPositionAfter?.avg_entry_price ?? brokerPositionAfter?.avgEntryPrice)
  const patch = Object.freeze({
    filledQuantity: identity.targetQuantity,
    brokerPositionIdentity: assetId || `${identity.symbol}:${identity.targetQuantity}`,
    ...(Number.isFinite(averageEntryPrice) && averageEntryPrice > 0 ? { averageFillPrice: averageEntryPrice } : {}),
    reconciliationEntry: Object.freeze({
      kind: 'paper_scale_action_filled',
      version: VERSION,
      action: identity.action,
      actionSequence: identity.actionSequence,
      symbol: identity.symbol,
      fromQuantity: identity.fromQuantity,
      targetQuantity: identity.targetQuantity,
      orderQuantity: identity.quantity,
      side: identity.side,
      clientOrderId: identity.clientOrderId,
      brokerOrderId: clean(order?.id ?? order?.orderId ?? order?.brokerOrderId) || null,
      filledAt: clean(order?.filledAt ?? order?.filled_at) || null,
    }),
  })

  return Object.freeze({
    ok: true,
    status: 'PAPER_SCALE_ACTION_RECONCILED',
    identity,
    lifecyclePatch: patch,
    lifecycleMustRemainMonitoring: true,
    mainEnterIdentityUnchanged: true,
    mainExitIdentityUnchanged: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
  })
}

export default {
  VERSION,
  buildPaperScaleActionIdentity,
  preflightPaperScaleAction,
  reconcilePaperScaleActionFill,
}
