import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const script = path.join(repoRoot, 'scripts', 'preflight_paper_auto_execution_authorized_run_once.mjs')

test('preflight fails closed with no prerequisites and writes a private blocked packet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-preflight-blocked-'))
  try {
    const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' })
    assert.equal(result.status, 1)
    const output = JSON.parse(result.stdout)
    assert.equal(output.ok, false)
    assert.equal(output.commandExecuted, false)
    assert.equal(output.safety.executionCliInvoked, false)
    assert.ok(output.blockers.includes('runbook:authorization_id_required'))
    assert.equal(fs.statSync(path.resolve(dir, output.reportFile)).mode & 0o777, 0o600)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('complete explicit paper-only prerequisites produce review-ready preflight without execution', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-preflight-ready-'))
  try {
    const args = [
      script,
      '--authorization-id=auth-preflight-1',
      `--expires-at-ms=${Date.now() + 600000}`,
      '--latch=runs/private/paper-auto-preflight-latch.json',
      '--manual-stage-proof-complete=true',
      '--user-approved-stage-proof-complete=true',
      '--automatic-stage-unlocked=true',
      '--paper-account-selected=true',
      '--paper-credentials-selected-separately=true',
      '--live-credentials-absent=true',
      '--single-use-authorization-ready=true',
      '--market-session-preflight-pass=true',
      '--risk-preflight-pass=true',
      '--kill-switch-ready=true',
    ]
    const result = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.ok, true)
    assert.equal(output.readyForSeparateExplicitExecutionReview, true)
    assert.equal(output.commandExecuted, false)
    assert.match(output.commandPreview, /^npm run run:paper-auto-authorized-once -- /)
    assert.equal(output.integrityVerified, true)
    assert.equal(output.artifactVerification.privateModeVerified, true)
    assert.equal(output.safety.brokerContactAllowed, false)
    assert.equal(output.safety.orderPlacementAllowed, false)
    assert.equal(output.safety.liveTradingAllowed, false)
    assert.equal(fs.statSync(path.resolve(dir, output.reportFile)).mode & 0o777, 0o600)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight source cannot invoke execution coordinator factory adapter network or scheduling', () => {
  const source = fs.readFileSync(script, 'utf8')
  assert.doesNotMatch(source, /runPaperAutoExecutionAlpacaPaperAuthorizedCommand|runPaperAutoExecutionAuthorizedRunOnceCommand/)
  assert.doesNotMatch(source, /createPaperAutoExecutionAuthorizedRunOnceCoordinator|createPaperAutoExecutionAlpacaPaperFactory/)
  assert.doesNotMatch(source, /fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
  assert.doesNotMatch(source, /setInterval\s*\(|setTimeout\s*\(|\bpm2\b|\bcron\b|schedule\s*\(/)
})
