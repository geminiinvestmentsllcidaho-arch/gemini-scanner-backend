import fs from 'node:fs'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { buildPaperAutoOrderIdentity } from './paper_auto_execution_order_identity.mjs'
import { REQUIRED_PHRASE as ENTER_PHRASE, REQUIRED_SCOPE as ENTER_SCOPE, evaluatePaperAutoEnterOnlyRunOnceAuthorization } from './paper_auto_execution_enter_only_run_once_authorization.mjs'
import { REQUIRED_PHRASE as EXIT_PHRASE, REQUIRED_SCOPE as EXIT_SCOPE, evaluatePaperAutoExitOnlyRunOnceAuthorization } from './paper_auto_execution_exit_only_run_once_authorization.mjs'

export const VERSION = 'customer_paper_preparation_lifecycle_bridge_v1'
const clean = (v) => String(v ?? '').trim()
const safe = (v) => clean(v).replace(/[^A-Za-z0-9._-]/g, '_') || 'customer'

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

const ACTIVE_ENTER_STATES = new Set([
  'CANDIDATE_SELECTED',
  'ENTER_SUBMITTING',
  'ENTER_UNKNOWN',
  'ENTER_OPEN',
  'ENTER_PARTIALLY_FILLED',
  'POSITION_CONFIRMED',
  'MONITORING',
  'UNRESOLVED_NEEDS_RECONCILIATION',
])

function findActiveCustomerEnter(runsDir, accountId) {
  const accountKey = safe(accountId)
  const prefix = `customer_paper_user_lifecycle_${accountKey}`
  const matches = []
  if (!fs.existsSync(runsDir)) return matches
  for (const name of fs.readdirSync(runsDir)) {
    if (!name.endsWith('.json') || !name.startsWith(prefix)) continue
    const file = path.join(runsDir, name)
    const state = readJson(file)
    if (!state || !ACTIVE_ENTER_STATES.has(clean(state.state))) continue
    if (clean(state.scannerEvidence?.source) !== 'customer_paper_user_preparation') continue
    matches.push({ file, state })
  }
  return matches
}

function findMonitoring(runsDir, symbol, quantity) {
  const matches = []
  if (!fs.existsSync(runsDir)) return matches
  for (const name of fs.readdirSync(runsDir)) {
    if (!name.endsWith('.json')) continue
    if (!name.includes('lifecycle')) continue
    const file = path.join(runsDir, name)
    const state = readJson(file)
    if (!state) continue
    if (clean(state.state) !== 'MONITORING') continue
    if (clean(state.selectedSymbol).toUpperCase() !== symbol) continue
    if (Number(state.filledQuantity) !== quantity) continue
    matches.push({ file, state })
  }
  return matches
}

export function bridgePaperPreparationToLifecycle(preparation, options = {}) {
  if (preparation?.ok !== true || !preparation?.preparationId) throw new Error('paper_preparation_invalid')
  const mode = clean(preparation.mode).toUpperCase()
  const symbol = clean(preparation.symbol).toUpperCase()
  const quantity = Number(preparation.quantity)
  if (!['ENTER', 'EXIT'].includes(mode)) throw new Error('paper_preparation_mode_invalid')
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('paper_preparation_symbol_invalid')
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('paper_preparation_quantity_invalid')
  if (mode === 'ENTER' && quantity !== 1) throw new Error('paper_preparation_enter_quantity_must_be_one')

  const runsDir = options.runsDir ?? 'runs'
  let lifecycleFile
  let lifecycle

  if (mode === 'ENTER') {
    const activeCustomerEnter = findActiveCustomerEnter(runsDir, options.accountId)
    if (activeCustomerEnter.length) throw new Error('paper_enter_active_customer_lifecycle_exists')
    lifecycleFile = path.join(runsDir, `customer_paper_user_lifecycle_${safe(options.accountId)}.json`)
    const store = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
    lifecycle = store.create({
      selectedSymbol: symbol,
      scannerEvidence: {
        source: 'customer_paper_user_preparation',
        preparationId: preparation.preparationId,
        quantity,
        paperOnly: true,
        userInitiated: true,
      },
    })
  } else {
    const matches = findMonitoring(runsDir, symbol, quantity)
    if (matches.length !== 1) throw new Error(matches.length ? 'paper_exit_multiple_matching_lifecycles' : 'paper_exit_matching_lifecycle_not_found')
    lifecycleFile = matches[0].file
    lifecycle = matches[0].state
  }

  const phase = mode.toLowerCase()
  const side = mode === 'ENTER' ? 'buy' : 'sell'
  const identity = buildPaperAutoOrderIdentity({
    lifecycleId: lifecycle.lifecycleId,
    phase,
    symbol,
    quantity,
    side,
  })

  const authorizationId = `customer-paper-${phase}-${preparation.preparationId}`
  const expiresAtMs = Number(options.nowMs ?? Date.now()) + 15 * 60 * 1000
  const latchFile = path.join(runsDir, 'customer_paper_user_authorization_latches', `${safe(authorizationId)}.json`)
  const authorization = Object.freeze({
    authorizationId,
    operator: 'Borac',
    phrase: mode === 'ENTER' ? ENTER_PHRASE : EXIT_PHRASE,
    scope: mode === 'ENTER' ? ENTER_SCOPE : EXIT_SCOPE,
    lifecycleId: lifecycle.lifecycleId,
    symbol,
    quantity,
    expiresAtMs,
    latchFile,
    paperOnly: true,
    userInitiated: true,
    consumed: false,
    requiresExplicitConsumptionAtExecutionBoundary: true,
  })
  const authorizationEvaluationInput = {
    ...authorization,
    env: options.authorizationEnv ?? process.env,
  }
  const authorizationEvaluation = mode === 'ENTER'
    ? evaluatePaperAutoEnterOnlyRunOnceAuthorization(authorizationEvaluationInput, Number(options.nowMs ?? Date.now()))
    : evaluatePaperAutoExitOnlyRunOnceAuthorization(authorizationEvaluationInput, Number(options.nowMs ?? Date.now()))

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: 'READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY',
    preparationId: preparation.preparationId,
    mode,
    lifecycleFile,
    lifecycleId: lifecycle.lifecycleId,
    lifecycleState: lifecycle.state,
    order: Object.freeze({
      symbol: identity.symbol,
      qty: identity.quantity,
      side: identity.side,
      type: 'market',
      timeInForce: 'day',
      clientOrderId: identity.clientOrderId,
      paperOnly: true,
    }),
    deterministicIdentity: identity,
    authorization,
    authorizationEvaluation,
    safety: Object.freeze({
      paperOnly: true,
      userInitiated: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      submissionBoundaryRetained: true,
    }),
  })
}

export default { VERSION, bridgePaperPreparationToLifecycle }
