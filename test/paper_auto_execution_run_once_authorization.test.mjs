import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  REQUIRED_PHRASE,
  evaluatePaperAutoRunOnceAuthorization,
  consumePaperAutoRunOnceAuthorization,
} from '../src/scanner/paper_auto_execution_run_once_authorization.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-auth-'))
  return {
    dir,
    input: {
      env: { PAPER_AUTO_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
      authorizationId: 'auth-1',
      operator: 'Borac',
      phrase: REQUIRED_PHRASE,
      scope: 'paper_auto_run_once_only',
      expiresAtMs: Date.parse('2026-08-04T07:00:00.000Z'),
      latchFile: path.join(dir, 'authorization.json'),
    },
  }
}

test('disabled by default fails closed', () => {
  const { dir, input } = fixture()
  try {
    input.env = {}
    const result = evaluatePaperAutoRunOnceAuthorization(input, Date.parse('2026-08-04T06:00:00.000Z'))
    assert.equal(result.ok, false)
    assert.ok(result.blockers.includes('authorization_disabled_by_env'))
    assert.equal(result.safety.orderPlacementAllowed, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('wrong operator phrase scope or expired authorization is blocked', () => {
  const { dir, input } = fixture()
  try {
    const result = evaluatePaperAutoRunOnceAuthorization({
      ...input,
      operator: 'Other',
      phrase: 'wrong',
      scope: 'wrong',
      expiresAtMs: Date.parse('2026-08-04T05:00:00.000Z'),
    }, Date.parse('2026-08-04T06:00:00.000Z'))
    assert.equal(result.ok, false)
    assert.ok(result.blockers.includes('borac_operator_identity_required'))
    assert.ok(result.blockers.includes('exact_authorization_phrase_required'))
    assert.ok(result.blockers.includes('exact_authorization_scope_required'))
    assert.ok(result.blockers.includes('authorization_expired'))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('valid authorization is consumed exactly once and replay is blocked', () => {
  const { dir, input } = fixture()
  try {
    const now = Date.parse('2026-08-04T06:00:00.000Z')
    const first = consumePaperAutoRunOnceAuthorization(input, now)
    assert.equal(first.status, 'AUTHORIZED_AND_CONSUMED')
    assert.equal(first.consumed, true)
    const second = consumePaperAutoRunOnceAuthorization(input, now + 1)
    assert.equal(second.ok, false)
    assert.ok(second.blockers.includes('authorization_already_consumed'))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('source contains no server wiring network or broker implementation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_run_once_authorization.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
  assert.match(source, /serverIntegrated: false/)
  assert.match(source, /orderPlacementAllowed: false/)
})
