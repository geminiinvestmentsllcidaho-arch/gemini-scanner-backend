import crypto from 'node:crypto'

export const VERSION = 'paper_auto_execution_exit_replacement_action_model_v1'
const clean = v => String(v ?? '').trim()
const upper = v => clean(v).toUpperCase()
const whole = v => {
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
const terminal = new Set(['canceled','cancelled','rejected','expired','done_for_day','stopped'])

export function buildPaperExitReplacementIdentity({
  lifecycleId,
  symbol,
  residualQuantity,
  replacementSequence,
  priorExitClientOrderId,
  priorExitBrokerOrderId,
  terminalReason,
} = {}) {
  const lifecycle = clean(lifecycleId)
  const sym = upper(symbol)
  const qty = whole(residualQuantity)
  const sequence = whole(replacementSequence)
  const priorClient = clean(priorExitClientOrderId)
  const priorBroker = clean(priorExitBrokerOrderId)
  const reason = clean(terminalReason).toLowerCase()
  if (!lifecycle) throw new Error('paper_exit_replacement_lifecycle_id_required')
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(sym)) throw new Error('paper_exit_replacement_symbol_invalid')
  if (qty === null) throw new Error('paper_exit_replacement_residual_whole_quantity_required')
  if (sequence === null) throw new Error('paper_exit_replacement_sequence_required')
  if (!priorClient) throw new Error('paper_exit_replacement_prior_client_order_id_required')
  if (!priorBroker) throw new Error('paper_exit_replacement_prior_broker_order_id_required')
  if (!terminal.has(reason)) throw new Error('paper_exit_replacement_terminal_reason_invalid')
  const canonical = [VERSION,lifecycle,sym,String(qty),String(sequence),priorClient,priorBroker,reason,'sell'].join('|')
  const digest = crypto.createHash('sha256').update(canonical).digest('hex')
  return Object.freeze({
    version: VERSION,
    lifecycleId: lifecycle,
    symbol: sym,
    residualQuantity: qty,
    replacementSequence: sequence,
    priorExitClientOrderId: priorClient,
    priorExitBrokerOrderId: priorBroker,
    terminalReason: reason,
    quantity: qty,
    side: 'sell',
    canonical,
    digest,
    clientOrderId: `gs-pa-exitrepl-${digest.slice(0,20)}`,
    paperOnly: true,
    liveTradingAllowed: false,
  })
}

export default { VERSION, buildPaperExitReplacementIdentity }
