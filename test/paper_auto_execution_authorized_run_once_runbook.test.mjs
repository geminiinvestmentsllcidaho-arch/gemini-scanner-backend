import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildPaperAutoExecutionAuthorizedRunOnceRunbook,
  writePaperAutoExecutionAuthorizedRunOnceRunbook,
} from '../src/scanner/paper_auto_execution_authorized_run_once_runbook.mjs'
import { REQUIRED_PHRASE } from '../src/scanner/paper_auto_execution_run_once_authorization.mjs'

test('missing inputs block preview without command execution', () => {
  const report = buildPaperAutoExecutionAuthorizedRunOnceRunbook({ now: new Date('2026-08-04T07:00:00.000Z') })
  assert.equal(report.previewReady, false)
  assert.equal(report.commandPreview, null)
  assert.equal(report.commandExecuted, false)
  assert.ok(report.blockers.includes('authorization_id_required'))
})

test('complete inputs render exact disabled run-once command preview only', () => {
  const report = buildPaperAutoExecutionAuthorizedRunOnceRunbook({
    authorizationId: 'auth-1',
    expiresAtMs: Date.parse('2026-08-04T08:00:00.000Z'),
    latchFile: 'runs/private/paper-auto-auth.json',
    now: new Date('2026-08-04T07:00:00.000Z'),
  })
  assert.equal(report.previewReady, true)
  assert.match(report.commandPreview, /^node scripts\/paper_auto_execution_alpaca_paper_authorized_command\.mjs /)
  assert.doesNotMatch(report.commandPreview, /paper_auto_execution_authorized_run_once_command\.mjs/)
  assert.match(report.commandPreview, /--execute=true/)
  assert.match(report.commandPreview, /--authorization-id='auth-1'/)
  assert.match(report.commandPreview, new RegExp(REQUIRED_PHRASE))
  assert.equal(report.commandExecuted, false)
  assert.equal(report.safety.orderPlacementAllowed, false)
  assert.equal(report.safety.liveTradingAllowed, false)
})

test('writer creates private preview artifact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-runbook-'))
  try {
    const report = buildPaperAutoExecutionAuthorizedRunOnceRunbook({
      authorizationId: 'auth-1', expiresAtMs: 1785830400000,
      latchFile: 'runs/private/paper-auto-auth.json',
      now: new Date('2026-08-04T07:00:00.000Z'),
    })
    const file = writePaperAutoExecutionAuthorizedRunOnceRunbook(report, dir)
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).commandExecuted, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('source and CLI have no execution import scheduling network or broker implementation', () => {
  for (const file of [
    new URL('../src/scanner/paper_auto_execution_authorized_run_once_runbook.mjs', import.meta.url),
    new URL('../scripts/preview_paper_auto_execution_authorized_run_once_runbook.mjs', import.meta.url),
  ]) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /createPaperAutoExecutionAuthorizedRunOnceCoordinator|runPaperAutoExecutionAuthorizedRunOnceCommand|setInterval|setTimeout|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
  }
})
