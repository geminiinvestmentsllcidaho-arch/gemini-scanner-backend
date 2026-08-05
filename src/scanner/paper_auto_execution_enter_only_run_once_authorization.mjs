import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const VERSION = 'paper_auto_execution_enter_only_run_once_authorization_v1'
export const REQUIRED_PHRASE = 'I_APPROVE_ONE_DISABLED_PAPER_AUTO_ENTER_ONCE'
export const REQUIRED_SCOPE = 'paper_auto_enter_once_only'

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

export function evaluatePaperAutoEnterOnlyRunOnceAuthorization(input = {}, nowMs = Date.now()) {
  const blockers = []
  const authorizationId = clean(input.authorizationId)
  const operator = clean(input.operator)
  const phrase = clean(input.phrase)
  const scope = clean(input.scope)
  const expiresAtMs = Number(input.expiresAtMs)
  const latch = readLatch(input.latchFile)

  if (clean(input.env?.PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED) !== '1') blockers.push('enter_only_authorization_disabled_by_env')
  if (!authorizationId) blockers.push('authorization_id_required')
  if (operator !== 'Borac') blockers.push('borac_operator_identity_required')
  if (phrase !== REQUIRED_PHRASE) blockers.push('exact_enter_only_authorization_phrase_required')
  if (scope !== REQUIRED_SCOPE) blockers.push('exact_enter_only_authorization_scope_required')
  if (!Number.isFinite(expiresAtMs)) blockers.push('authorization_expiry_required')
  else if (expiresAtMs <= Number(nowMs)) blockers.push('authorization_expired')
  if (latch.consumed) blockers.push(latch.blocker)

  return Object.freeze({
    ok: blockers.length === 0,
    version: VERSION,
    status: blockers.length === 0 ? 'AUTHORIZED_FOR_ONE_DISABLED_PAPER_AUTO_ENTER_ONCE' : 'BLOCKED',
    authorizationId: authorizationId || null,
    operator: operator || null,
    scope: scope || null,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
    blockers: Object.freeze([...new Set(blockers)]),
    safety: Object.freeze({
      paperOnly: true,
      enterOnly: true,
      exitAuthorized: false,
      disabledByDefault: true,
      serverIntegrated: false,
      automaticStartAllowed: false,
      recurringExecutionAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export function consumePaperAutoEnterOnlyRunOnceAuthorization(input = {}, nowMs = Date.now()) {
  const result = evaluatePaperAutoEnterOnlyRunOnceAuthorization(input, nowMs)
  if (!result.ok) return result
  const path = clean(input.latchFile)
  const record = Object.freeze({
    version: VERSION,
    status: 'CONSUMED',
    authorizationId: result.authorizationId,
    operator: result.operator,
    scope: result.scope,
    mode: 'ENTER_ONLY',
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
  evaluatePaperAutoEnterOnlyRunOnceAuthorization,
  consumePaperAutoEnterOnlyRunOnceAuthorization,
}
