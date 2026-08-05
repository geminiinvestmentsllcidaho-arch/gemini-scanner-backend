import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const VERSION = 'paper_auto_execution_exit_only_run_once_authorization_v1'
export const REQUIRED_PHRASE = 'I_APPROVE_ONE_EXACT_POSITION_PAPER_AUTO_EXIT_ONCE'
export const REQUIRED_SCOPE = 'paper_auto_exit_once_only'

const clean = (value) => String(value ?? '').trim()

function readLatch(file) {
  const path = clean(file)
  if (!path) return { consumed: true, blocker: 'authorization_latch_path_required' }
  try {
    const record = JSON.parse(readFileSync(path, 'utf8'))
    return {
      consumed: record?.status === 'CONSUMED',
      blocker: record?.status === 'CONSUMED' ? 'authorization_already_consumed' : 'authorization_latch_malformed',
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { consumed: false, blocker: null }
    return { consumed: true, blocker: 'authorization_latch_unreadable' }
  }
}

export function evaluatePaperAutoExitOnlyRunOnceAuthorization(input = {}, nowMs = Date.now()) {
  const authorizationId = clean(input.authorizationId)
  const operator = clean(input.operator)
  const phrase = clean(input.phrase)
  const scope = clean(input.scope)
  const lifecycleId = clean(input.lifecycleId)
  const symbol = clean(input.symbol).toUpperCase()
  const quantity = Number(input.quantity)
  const expiresAtMs = Number(input.expiresAtMs)
  const latch = readLatch(input.latchFile)
  const blockers = []

  if (clean(input.env?.PAPER_AUTO_EXIT_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED) !== '1') blockers.push('exit_only_authorization_disabled_by_env')
  if (!authorizationId) blockers.push('authorization_id_required')
  if (operator !== 'Borac') blockers.push('borac_operator_identity_required')
  if (phrase !== REQUIRED_PHRASE) blockers.push('exact_exit_only_authorization_phrase_required')
  if (scope !== REQUIRED_SCOPE) blockers.push('exact_exit_only_authorization_scope_required')
  if (!lifecycleId) blockers.push('exact_lifecycle_id_required')
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) blockers.push('exact_symbol_required')
  if (!Number.isFinite(quantity) || quantity <= 0) blockers.push('exact_positive_quantity_required')
  if (!Number.isFinite(expiresAtMs)) blockers.push('authorization_expiry_required')
  else if (expiresAtMs <= Number(nowMs)) blockers.push('authorization_expired')
  if (latch.consumed) blockers.push(latch.blocker)

  return Object.freeze({
    ok: blockers.length === 0,
    version: VERSION,
    status: blockers.length === 0 ? 'AUTHORIZED_FOR_ONE_EXACT_POSITION_PAPER_AUTO_EXIT_ONCE' : 'BLOCKED',
    authorizationId: authorizationId || null,
    operator: operator || null,
    scope: scope || null,
    lifecycleId: lifecycleId || null,
    symbol: symbol || null,
    quantity: Number.isFinite(quantity) ? quantity : null,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
    blockers: Object.freeze([...new Set(blockers)]),
    safety: Object.freeze({
      paperOnly: true,
      exitOnly: true,
      enterAuthorized: false,
      disabledByDefault: true,
      automaticStartAllowed: false,
      recurringExecutionAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export function consumePaperAutoExitOnlyRunOnceAuthorization(input = {}, nowMs = Date.now()) {
  const result = evaluatePaperAutoExitOnlyRunOnceAuthorization(input, nowMs)
  if (!result.ok) return result
  const path = clean(input.latchFile)
  const record = Object.freeze({
    version: VERSION,
    status: 'CONSUMED',
    authorizationId: result.authorizationId,
    operator: result.operator,
    scope: result.scope,
    lifecycleId: result.lifecycleId,
    symbol: result.symbol,
    quantity: result.quantity,
    mode: 'EXIT_ONLY',
    consumedAt: new Date(nowMs).toISOString(),
  })
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  renameSync(temp, path)
  return Object.freeze({ ...result, status: 'AUTHORIZED_AND_CONSUMED', consumed: true, record })
}

export default {
  VERSION,
  REQUIRED_PHRASE,
  REQUIRED_SCOPE,
  evaluatePaperAutoExitOnlyRunOnceAuthorization,
  consumePaperAutoExitOnlyRunOnceAuthorization,
}
