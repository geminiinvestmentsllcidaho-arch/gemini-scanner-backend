import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REQUIRED_PHRASE } from './paper_auto_execution_run_once_authorization.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_runbook_v1'
const clean = (value) => String(value ?? '').trim()
const quote = (value) => `'${clean(value).replaceAll("'", "'\\''")}'`

export function buildPaperAutoExecutionAuthorizedRunOnceRunbook(options = {}) {
  const now = options.now ?? new Date()
  const authorizationId = clean(options.authorizationId)
  const expiresAtMs = Number(options.expiresAtMs)
  const latchFile = clean(options.latchFile)
  const blockers = []
  if (!authorizationId) blockers.push('authorization_id_required')
  if (!Number.isFinite(expiresAtMs)) blockers.push('authorization_expiry_required')
  if (!latchFile) blockers.push('authorization_latch_path_required')
  const previewReady = blockers.length === 0
  const commandPreview = previewReady ? [
    'npm run run:paper-auto-authorized-once --',
    '--execute=true',
    `--authorization-id=${quote(authorizationId)}`,
    '--operator=Borac',
    `--phrase=${quote(REQUIRED_PHRASE)}`,
    '--scope=paper_auto_run_once_only',
    `--expires-at-ms=${quote(expiresAtMs)}`,
    `--latch=${quote(latchFile)}`,
  ].join(' ') : null
  return Object.freeze({
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    status: previewReady ? 'RUNBOOK_PREVIEW_READY' : 'RUNBOOK_BLOCKED',
    previewReady,
    commandPreview,
    commandExecuted: false,
    prerequisites: Object.freeze([
      'manual_stage_mechanical_proof_complete',
      'user_approved_stage_mechanical_proof_complete',
      'automatic_stage_explicitly_unlocked',
      'paper_only_credentials_and_adapter_selected_separately',
      'all_paper_auto_environment_gates_explicitly_enabled_for_one_test',
      'fresh_single_use_operator_authorization',
      'market_session_and_risk_preflight_pass',
    ]),
    blockers: Object.freeze(blockers),
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      disabledByDefault: true,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      commandExecuted: false,
      directBrokerImplementation: false,
      liveTradingAllowed: false,
    }),
  })
}

export function writePaperAutoExecutionAuthorizedRunOnceRunbook(report, runsDir = 'runs') {
  mkdirSync(runsDir, { recursive: true, mode: 0o700 })
  const stamp = report.ts.replace(/[:.]/g, '-')
  const suffix = report.previewReady ? 'ready' : 'blocked'
  const file = join(runsDir, `paper_auto_execution_authorized_run_once_runbook_${suffix}_${stamp}.json`)
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return file
}

export default { VERSION, buildPaperAutoExecutionAuthorizedRunOnceRunbook, writePaperAutoExecutionAuthorizedRunOnceRunbook }
