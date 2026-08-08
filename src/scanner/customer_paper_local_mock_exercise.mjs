import fs from 'node:fs'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { buildPaperAutoOrderIdentity } from './paper_auto_execution_order_identity.mjs'
import { exerciseCustomerPaperMockExecutionBoundary } from './customer_paper_mock_execution_boundary.mjs'

export const VERSION = 'customer_paper_local_mock_exercise_v1'
const clean = (v) => String(v ?? '').trim()
const safe = (v) => clean(v).replace(/[^A-Za-z0-9._-]/g, '_') || 'customer'
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null } }

export async function exerciseCustomerPaperLocalMock({ accountId, preparationId, runsDir = 'runs', nowMs = Date.now() } = {}) {
  const account = clean(accountId)
  const prepId = clean(preparationId)
  if (!account) throw new Error('customer_paper_local_mock_account_required')
  if (!/^customer-paper-(enter|exit)-[A-Za-z0-9_-]+$/i.test(prepId)) throw new Error('customer_paper_local_mock_preparation_id_invalid')

  const preparationFile = path.join(runsDir, 'customer_paper_order_preparations', `${prepId}.json`)
  const lifecycleFile = path.join(runsDir, `customer_paper_user_lifecycle_${safe(account)}.json`)
  const preparation = readJson(preparationFile)
  if (!preparation || preparation.ok !== true || preparation.preparationId !== prepId) throw new Error('customer_paper_local_mock_preparation_not_found')
  if (clean(preparation.customerAccountId) !== account) throw new Error('customer_paper_local_mock_preparation_account_mismatch')

  const store = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
  const lifecycle = store.load()
  if (!lifecycle || clean(lifecycle.scannerEvidence?.source) !== 'customer_paper_user_preparation') throw new Error('customer_paper_local_mock_lifecycle_not_found')

  const mode = clean(preparation.mode).toUpperCase()
  const symbol = clean(preparation.symbol).toUpperCase()
  const quantity = Number(preparation.quantity)
  if (!['ENTER', 'EXIT'].includes(mode) || !symbol || !Number.isFinite(quantity) || quantity <= 0) throw new Error('customer_paper_local_mock_preparation_invalid')

  if (mode === 'ENTER') {
    if (lifecycle.scannerEvidence?.preparationId !== prepId || lifecycle.selectedSymbol !== symbol || Number(lifecycle.scannerEvidence?.quantity) !== quantity) {
      throw new Error('customer_paper_local_mock_enter_lifecycle_mismatch')
    }
  } else if (lifecycle.state !== 'MONITORING' || lifecycle.selectedSymbol !== symbol || Number(lifecycle.filledQuantity) !== quantity) {
    throw new Error('customer_paper_local_mock_exit_lifecycle_mismatch')
  }

  const phase = mode.toLowerCase()
  const side = mode === 'ENTER' ? 'buy' : 'sell'
  const identity = buildPaperAutoOrderIdentity({ lifecycleId: lifecycle.lifecycleId, phase, symbol, quantity, side })
  const handoff = Object.freeze({
    ok: true,
    status: 'READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY',
    mode,
    order: Object.freeze({ symbol, qty: quantity, side, type: 'market', timeInForce: 'day', clientOrderId: identity.clientOrderId, paperOnly: true }),

  })

  const result = await exerciseCustomerPaperMockExecutionBoundary({ handoff, lifecycleStore: store, nowMs })
  return Object.freeze({
    ok: true,
    version: VERSION,
    status: result.status,
    preparationId: prepId,
    lifecycleFile,
    lifecycle: result.lifecycle,
    safety: Object.freeze({ paperOnly: true, localMockOnly: true, humanAuthorizationRequired: false, brokerContactAllowed: false, realOrderPlacementAllowed: false, accountMutationAllowed: false }),
  })
}

export default { VERSION, exerciseCustomerPaperLocalMock }
