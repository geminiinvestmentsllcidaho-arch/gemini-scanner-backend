import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { STATES as S } from './paper_auto_execution_state_machine.mjs'

export const VERSION = 'paper_auto_execution_existing_position_adoption_v1'

const clean = value => String(value ?? '').trim()
const upper = value => clean(value).toUpperCase()

export async function adoptExistingPaperPositionForMonitoring(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const lifecycleFile = clean(options.lifecycleFile)
  const symbol = upper(options.symbol)
  const quantity = Number(options.quantity)

  if (!lifecycleFile) throw new Error('paper_position_adoption_lifecycle_file_required')
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('paper_position_adoption_exact_symbol_required')
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('paper_position_adoption_exact_positive_quantity_required')
  if (clean(env.APCA_API_BASE_URL) !== 'https://paper-api.alpaca.markets') throw new Error('paper_position_adoption_paper_host_required')
  if (clean(env.ALPACA_PAPER_TRADING).toLowerCase() !== 'true') throw new Error('paper_position_adoption_paper_flag_required')
  if (!clean(env.APCA_API_KEY_ID) || !clean(env.APCA_API_SECRET_KEY)) throw new Error('paper_position_adoption_credentials_required')
  if (typeof fetchImpl !== 'function') throw new Error('paper_position_adoption_fetch_required')

  const account = await fetchAlpacaPaperAccountReadonly({ env, fetchImpl })
  if (account?.ok !== true || account?.status !== 'connected_readonly') throw new Error('paper_position_adoption_fresh_account_required')
  const matches = (account.positions ?? []).filter(p => upper(p?.symbol) === symbol && Number(p?.qty ?? p?.quantity) === quantity)
  if (matches.length !== 1) throw new Error('paper_position_adoption_exact_broker_position_required')
  const conflicting = (account.openOrders ?? []).find(o => upper(o?.symbol) === symbol && ['buy','sell'].includes(clean(o?.side).toLowerCase()))
  if (conflicting) throw new Error('paper_position_adoption_conflicting_open_order')

  const position = matches[0]
  const brokerPositionIdentity = `${symbol}:${quantity}`
  const store = new PaperAutoExecutionLifecycleStore({ filePath: path.resolve(lifecycleFile) })
  let lifecycle = store.create({
    selectedSymbol: symbol,
    scannerEvidence: {
      source: 'position_adoption_for_controlled_auto_exit_proof',
      paperOnly: true,
      brokerObservedAt: account.observedAt ?? null,
      averageEntryPrice: Number(position?.averageEntryPrice ?? position?.avg_entry_price ?? 0) || null,
    },
  })
  lifecycle = store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: `adopt-${lifecycle.lifecycleId}` })
  lifecycle = store.transition(S.ENTER_OPEN, { enterBrokerOrderId: 'existing-paper-position-adopted' })
  lifecycle = store.transition(S.POSITION_CONFIRMED, {
    filledQuantity: quantity,
    averageFillPrice: Number(position?.averageEntryPrice ?? position?.avg_entry_price ?? 0) || null,
    brokerPositionIdentity,
  })
  lifecycle = store.transition(S.MONITORING)

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: 'EXISTING_PAPER_POSITION_ADOPTED_FOR_MONITORING',
    lifecycleFile: path.resolve(lifecycleFile),
    lifecycle,
    brokerPosition: position,
    safety: {
      paperOnly: true,
      brokerReadMethodsOnly: ['GET'],
      enterOrderSubmitted: false,
      brokerMutationAllowed: false,
      liveTradingAllowed: false,
      automaticExitActivated: false,
    },
  })
}

export default { VERSION, adoptExistingPaperPositionForMonitoring }
