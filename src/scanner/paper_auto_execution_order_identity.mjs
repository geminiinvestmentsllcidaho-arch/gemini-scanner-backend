import crypto from 'node:crypto'

export const VERSION = 'paper_auto_execution_order_identity_v1'

const clean = (value) => String(value ?? '').trim()
const upper = (value) => clean(value).toUpperCase()

function normalizeSide(value) {
  const side = clean(value).toLowerCase()
  if (!['buy', 'sell'].includes(side)) throw new Error('paper_auto_order_side_invalid')
  return side
}

function normalizeQuantity(value) {
  const quantity = Number(value)
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('paper_auto_order_quantity_invalid')
  return quantity
}

function normalizeSymbol(value) {
  const symbol = upper(value)
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('paper_auto_order_symbol_invalid')
  return symbol
}

export function buildPaperAutoOrderIdentity({
  lifecycleId,
  phase,
  symbol,
  quantity,
  side,
} = {}) {
  const normalizedLifecycleId = clean(lifecycleId)
  const normalizedPhase = clean(phase).toLowerCase()
  if (!normalizedLifecycleId) throw new Error('paper_auto_lifecycle_id_required')
  if (!['enter', 'exit'].includes(normalizedPhase)) throw new Error('paper_auto_order_phase_invalid')

  const normalized = Object.freeze({
    lifecycleId: normalizedLifecycleId,
    phase: normalizedPhase,
    symbol: normalizeSymbol(symbol),
    quantity: normalizeQuantity(quantity),
    side: normalizeSide(side),
  })

  if (normalized.phase === 'enter' && normalized.side !== 'buy') throw new Error('paper_auto_enter_side_must_be_buy')
  if (normalized.phase === 'exit' && normalized.side !== 'sell') throw new Error('paper_auto_exit_side_must_be_sell')

  const canonical = [
    VERSION,
    normalized.lifecycleId,
    normalized.phase,
    normalized.symbol,
    String(normalized.quantity),
    normalized.side,
  ].join('|')

  const digest = crypto.createHash('sha256').update(canonical).digest('hex')
  const clientOrderId = `gs-pa-${normalized.phase}-${digest.slice(0, 24)}`

  return Object.freeze({
    version: VERSION,
    ...normalized,
    canonical,
    digest,
    clientOrderId,
  })
}

export function assertExactPaperAutoOrderIdentity(expected = {}, actual = {}) {
  const left = buildPaperAutoOrderIdentity(expected)
  const right = buildPaperAutoOrderIdentity(actual)
  if (left.digest !== right.digest) throw new Error('paper_auto_order_identity_mismatch')
  return true
}

export default {
  VERSION,
  buildPaperAutoOrderIdentity,
  assertExactPaperAutoOrderIdentity,
}
