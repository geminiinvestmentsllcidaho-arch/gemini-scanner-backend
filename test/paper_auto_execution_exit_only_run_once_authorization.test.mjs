import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  REQUIRED_PHRASE,
  REQUIRED_SCOPE,
  evaluatePaperAutoExitOnlyRunOnceAuthorization,
  consumePaperAutoExitOnlyRunOnceAuthorization,
} from '../src/scanner/paper_auto_execution_exit_only_run_once_authorization.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-exit-auth-'))
  const latchFile = path.join(dir, 'authorization.json')
  const nowMs = Date.parse('2026-08-05T21:10:00.000Z')
  const input = {
    env: { PAPER_AUTO_EXIT_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
    authorizationId: 'exit-once-1',
    operator: 'Borac',
    phrase: REQUIRED_PHRASE,
    scope: REQUIRED_SCOPE,
    lifecycleId: 'life-exit-1',
    symbol: 'BTG',
    quantity: 1,
    expiresAtMs: nowMs + 60000,
    latchFile,
  }
  return { dir, latchFile, nowMs, input }
}

test('authorizes one exact lifecycle symbol and quantity only', () => {
  const { dir, nowMs, input } = fixture()
  try {
    const result = evaluatePaperAutoExitOnlyRunOnceAuthorization(input, nowMs)
    assert.equal(result.ok, true)
    assert.equal(result.lifecycleId, 'life-exit-1')
    assert.equal(result.symbol, 'BTG')
    assert.equal(result.quantity, 1)
    assert.equal(result.safety.paperOnly, true)
    assert.equal(result.safety.exitOnly, true)
    assert.equal(result.safety.enterAuthorized, false)
    assert.equal(result.safety.liveTradingAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('fails closed when exact identity, scope, phrase, or expiry is wrong', () => {
  const { dir, nowMs, input } = fixture()
  try {
    const result = evaluatePaperAutoExitOnlyRunOnceAuthorization({
      ...input,
      operator: 'Other',
      phrase: 'wrong',
      scope: 'wrong',
      lifecycleId: '',
      symbol: '',
      quantity: 0,
      expiresAtMs: nowMs,
    }, nowMs)
    assert.equal(result.ok, false)
    assert.ok(result.blockers.includes('borac_operator_identity_required'))
    assert.ok(result.blockers.includes('exact_exit_only_authorization_phrase_required'))
    assert.ok(result.blockers.includes('exact_exit_only_authorization_scope_required'))
    assert.ok(result.blockers.includes('exact_lifecycle_id_required'))
    assert.ok(result.blockers.includes('exact_symbol_required'))
    assert.ok(result.blockers.includes('exact_positive_quantity_required'))
    assert.ok(result.blockers.includes('authorization_expired'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('consumes authorization exactly once with durable exact-position record', () => {
  const { dir, latchFile, nowMs, input } = fixture()
  try {
    const first = consumePaperAutoExitOnlyRunOnceAuthorization(input, nowMs)
    assert.equal(first.ok, true)
    assert.equal(first.consumed, true)
    const record = JSON.parse(fs.readFileSync(latchFile, 'utf8'))
    assert.equal(record.status, 'CONSUMED')
    assert.equal(record.mode, 'EXIT_ONLY')
    assert.equal(record.lifecycleId, 'life-exit-1')
    assert.equal(record.symbol, 'BTG')
    assert.equal(record.quantity, 1)

    const second = consumePaperAutoExitOnlyRunOnceAuthorization(input, nowMs + 1)
    assert.equal(second.ok, false)
    assert.ok(second.blockers.includes('authorization_already_consumed'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('disabled-by-default evaluation creates no latch and performs no network work', () => {
  const { dir, latchFile, nowMs, input } = fixture()
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    throw new Error('network forbidden')
  }
  try {
    const result = evaluatePaperAutoExitOnlyRunOnceAuthorization({ ...input, env: {} }, nowMs)
    assert.equal(result.ok, false)
    assert.ok(result.blockers.includes('exit_only_authorization_disabled_by_env'))
    assert.equal(fs.existsSync(latchFile), false)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
