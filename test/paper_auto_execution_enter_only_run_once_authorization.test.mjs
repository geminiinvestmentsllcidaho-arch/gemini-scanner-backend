import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  REQUIRED_PHRASE,
  REQUIRED_SCOPE,
  evaluatePaperAutoEnterOnlyRunOnceAuthorization,
  consumePaperAutoEnterOnlyRunOnceAuthorization,
} from '../src/scanner/paper_auto_execution_enter_only_run_once_authorization.mjs'

test('requires distinct ENTER-only phrase and scope', () => {
  const latchFile = path.join(os.tmpdir(), `missing-enter-only-${process.pid}.json`)
  const result = evaluatePaperAutoEnterOnlyRunOnceAuthorization({
    env: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
    authorizationId: 'enter-once',
    operator: 'Borac',
    phrase: REQUIRED_PHRASE,
    scope: REQUIRED_SCOPE,
    expiresAtMs: Date.now() + 60000,
    latchFile,
  })
  assert.equal(result.ok, true)
  assert.equal(result.safety.enterOnly, true)
  assert.equal(result.safety.exitAuthorized, false)
})

test('consumes once and blocks replay', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enter-only-auth-'))
  try {
    const latchFile = path.join(dir, 'latch.json')
    const input = {
      env: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
      authorizationId: 'enter-once',
      operator: 'Borac',
      phrase: REQUIRED_PHRASE,
      scope: REQUIRED_SCOPE,
      expiresAtMs: Date.now() + 60000,
      latchFile,
    }
    assert.equal(consumePaperAutoEnterOnlyRunOnceAuthorization(input).consumed, true)
    const replay = evaluatePaperAutoEnterOnlyRunOnceAuthorization(input)
    assert.equal(replay.ok, false)
    assert.ok(replay.blockers.includes('authorization_already_consumed'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
