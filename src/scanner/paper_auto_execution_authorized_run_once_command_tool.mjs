import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPaperAutoExecutionAuthorizedRunOnceCoordinator } from './paper_auto_execution_authorized_run_once_coordinator.mjs'
import { REQUIRED_PHRASE } from './paper_auto_execution_run_once_authorization.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_command_tool_v1'

const clean = (value) => String(value ?? '').trim()

function parseArgs(argv = []) {
  const out = {}
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const [key, ...rest] = raw.slice(2).split('=')
    out[key] = rest.length ? rest.join('=') : 'true'
  }
  return out
}

function boolArg(value) {
  return ['1', 'true', 'yes', 'on'].includes(clean(value).toLowerCase())
}

export async function runPaperAutoExecutionAuthorizedRunOnceCommand(options = {}) {
  const args = options.args ?? parseArgs(options.argv ?? [])
  const env = options.env ?? process.env
  const nowMs = Number(options.nowMs ?? Date.now())
  const executeRequested = boolArg(args.execute)
  const latchFile = clean(args.latch ?? args.latchFile)
  const authorization = {
    env,
    authorizationId: clean(args.authorizationId ?? args['authorization-id'] ?? args.authorization),
    operator: clean(args.operator ?? args.by),
    phrase: clean(args.phrase ?? args.approval),
    scope: clean(args.scope),
    expiresAtMs: Number(args.expiresAtMs ?? args['expires-at-ms'] ?? args.expires),
    latchFile,
  }

  const blockers = []
  if (!executeRequested) blockers.push('explicit_execute_true_required')
  if (authorization.operator !== 'Borac') blockers.push('borac_operator_identity_required')
  if (authorization.phrase !== REQUIRED_PHRASE) blockers.push('exact_authorization_phrase_required')
  if (authorization.scope !== 'paper_auto_run_once_only') blockers.push('exact_authorization_scope_required')
  if (!authorization.authorizationId) blockers.push('authorization_id_required')
  if (!latchFile) blockers.push('authorization_latch_path_required')
  if (!Number.isFinite(authorization.expiresAtMs)) blockers.push('authorization_expiry_required')

  let coordinatorResult = null
  if (blockers.length === 0) {
    const createCoordinator =
      typeof options.createCoordinator === 'function'
        ? options.createCoordinator
        : createPaperAutoExecutionAuthorizedRunOnceCoordinator
    const coordinator = createCoordinator({
      ...options,
      env,
      authorization,
      now: () => nowMs,
    })
    if (!coordinator || typeof coordinator.runOnce !== 'function') {
      throw new Error('paper_auto_command_coordinator_factory_invalid')
    }
    coordinatorResult = await coordinator.runOnce()
  }

  return Object.freeze({
    ok: blockers.length === 0 && coordinatorResult?.lastResult?.bridgeInvoked === true,
    version: VERSION,
    ts: new Date(nowMs).toISOString(),
    status: blockers.length > 0
      ? 'COMMAND_BLOCKED'
      : coordinatorResult?.lastResult?.status ?? 'COMMAND_COMPLETED',
    executeRequested,
    blockers: Object.freeze([...new Set(blockers)]),
    authorization: Object.freeze({
      authorizationId: authorization.authorizationId || null,
      operator: authorization.operator || null,
      scope: authorization.scope || null,
      expiresAtMs: Number.isFinite(authorization.expiresAtMs) ? authorization.expiresAtMs : null,
      latchFile: latchFile || null,
      phraseMatched: authorization.phrase === REQUIRED_PHRASE,
    }),
    coordinatorResult,
    safety: Object.freeze({
      paperOnly: true,
      disabledByDefault: true,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      directBrokerImplementation: false,
      liveTradingAllowed: false,
    }),
  })
}

export function writePaperAutoExecutionAuthorizedRunOnceCommandReport(report, runsDir = 'runs') {
  mkdirSync(runsDir, { recursive: true, mode: 0o700 })
  const stamp = report.ts.replace(/[:.]/g, '-')
  const suffix = report.ok ? 'completed' : 'blocked'
  const file = join(runsDir, `paper_auto_execution_authorized_run_once_command_${suffix}_${stamp}.json`)
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return file
}

export default {
  VERSION,
  runPaperAutoExecutionAuthorizedRunOnceCommand,
  writePaperAutoExecutionAuthorizedRunOnceCommandReport,
}
