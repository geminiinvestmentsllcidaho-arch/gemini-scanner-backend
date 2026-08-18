import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createPaperAutoExecutionDegradedBrokerMode,
  DEFAULT_TRANSIENT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_SUCCESS_THRESHOLD,
} from '../src/scanner/paper_auto_execution_degraded_broker_mode.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'degraded-broker-mode-'))
const at = Date.parse('2026-08-18T16:00:00Z')

test('disabled-by-default mode never blocks automatic actions', () => {
  const d = tmp()
  try {
    const filePath = path.join(d, 'state.json')
    const mode = createPaperAutoExecutionDegradedBrokerMode({ env: {}, filePath, now: () => at })
    const enter = mode.evaluateAction({ action: 'ENTER' })
    assert.equal(enter.allowed, true)
    assert.equal(enter.status, 'DEGRADED_BROKER_MODE_DISABLED_BY_ENV')
    assert.equal(mode.diagnostics().enabled, false)
    assert.equal(mode.diagnostics().safety.paperOnly, true)
    assert.equal(mode.diagnostics().safety.liveTradingAllowed, false)
    assert.equal(fs.existsSync(filePath), false)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('transient broker failures enter degraded mode only at configured threshold', () => {
  const d = tmp()
  try {
    const filePath = path.join(d, 'state.json')
    const mode = createPaperAutoExecutionDegradedBrokerMode({
      env: { PAPER_AUTO_DEGRADED_BROKER_MODE_ENABLED: '1' },
      filePath,
      now: () => at,
    })
    assert.equal(DEFAULT_TRANSIENT_FAILURE_THRESHOLD, 3)
    mode.recordFailure({ kind: 'NETWORK_FAILURE' })
    mode.recordFailure({ kind: 'NETWORK_FAILURE' })
    assert.equal(mode.diagnostics().status.degraded, false)
    mode.recordFailure({ kind: 'NETWORK_FAILURE', reason: 'broker_transport_unavailable' })
    const diag = mode.diagnostics()
    assert.equal(diag.status.degraded, true)
    assert.equal(diag.status.state, 'degraded')
    assert.equal(diag.status.reason, 'broker_transport_unavailable')
    assert.equal(diag.status.consecutiveTransientFailures, 3)
    assert.equal(mode.evaluateAction({ action: 'ENTER' }).allowed, false)
    assert.equal(mode.evaluateAction({ action: 'SCALE_IN' }).allowed, false)
    assert.equal(mode.evaluateAction({ action: 'SCALE_OUT' }).allowed, true)
    assert.equal(mode.evaluateAction({ action: 'EXIT' }).allowed, true)
    assert.equal(mode.evaluateAction({ action: 'EXIT_RECOVERY' }).allowed, true)
    assert.equal(mode.evaluateAction({ action: 'EXIT_REPLACEMENT' }).allowed, true)
    assert.equal(mode.evaluateAction({ action: 'RECONCILE' }).allowed, true)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('immediate ambiguity class enters degraded mode on first failure', () => {
  const d = tmp()
  try {
    const mode = createPaperAutoExecutionDegradedBrokerMode({
      env: { PAPER_AUTO_DEGRADED_BROKER_MODE_ENABLED: '1' },
      filePath: path.join(d, 'state.json'),
      now: () => at,
    })
    mode.recordFailure({ kind: 'AMBIGUOUS_SUBMISSION' })
    assert.equal(mode.diagnostics().status.degraded, true)
    assert.equal(mode.diagnostics().status.lastFailureKind, 'AMBIGUOUS_SUBMISSION')
    assert.equal(mode.evaluateAction({ action: 'ENTER' }).status, 'DEGRADED_BROKER_RISK_INCREASING_ACTION_BLOCKED')
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('recovery requires consecutive successes and then re-allows risk-increasing actions', () => {
  const d = tmp()
  try {
    let now = at
    const mode = createPaperAutoExecutionDegradedBrokerMode({
      env: { PAPER_AUTO_DEGRADED_BROKER_MODE_ENABLED: '1' },
      filePath: path.join(d, 'state.json'),
      now: () => now,
    })
    assert.equal(DEFAULT_RECOVERY_SUCCESS_THRESHOLD, 2)
    mode.recordFailure({ kind: 'BROKER_ACCOUNT_BLOCKED' })
    assert.equal(mode.diagnostics().status.degraded, true)
    now += 1000
    mode.recordSuccess({ probeId:'probe-1' })
    assert.equal(mode.diagnostics().status.degraded, true)
    assert.equal(mode.diagnostics().status.consecutiveRecoverySuccesses, 1)
    now += 1000
    mode.recordSuccess({ probeId:'probe-2' })
    assert.equal(mode.diagnostics().status.degraded, false)
    assert.equal(mode.diagnostics().status.state, 'normal')
    assert.equal(mode.evaluateAction({ action: 'ENTER' }).allowed, true)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('corrupt persisted state fails safe as degraded', () => {
  const d = tmp()
  try {
    const filePath = path.join(d, 'state.json')
    fs.writeFileSync(filePath, '{not-json', { mode: 0o600 })
    const mode = createPaperAutoExecutionDegradedBrokerMode({
      env: { PAPER_AUTO_DEGRADED_BROKER_MODE_ENABLED: '1' },
      filePath,
      now: () => at,
    })
    const diag = mode.diagnostics()
    assert.equal(diag.status.degraded, true)
    assert.equal(diag.status.reason, 'DEGRADED_BROKER_STATE_CORRUPT')
    assert.equal(mode.evaluateAction({ action: 'ENTER' }).allowed, false)
    assert.equal(mode.evaluateAction({ action: 'EXIT' }).allowed, true)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('unknown action is blocked while degraded', () => {
  const d = tmp()
  try {
    const mode = createPaperAutoExecutionDegradedBrokerMode({
      env: { PAPER_AUTO_DEGRADED_BROKER_MODE_ENABLED: '1' },
      filePath: path.join(d, 'state.json'),
      now: () => at,
    })
    mode.recordFailure({ kind: 'AMBIGUOUS_SUBMISSION' })
    const out = mode.evaluateAction({ action: 'something_else' })
    assert.equal(out.allowed, false)
    assert.equal(out.status, 'DEGRADED_BROKER_UNKNOWN_ACTION_BLOCKED')
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})


test('distinct authoritative recovery probes are deduplicated', () => {
  const d = tmp()
  try {
    const mode = createPaperAutoExecutionDegradedBrokerMode({
      env: { PAPER_AUTO_DEGRADED_BROKER_MODE_ENABLED: '1' },
      filePath: path.join(d, 'state.json'),
      now: () => at,
    })
    mode.recordFailure({ kind: 'BROKER_ACCOUNT_BLOCKED' })
    mode.recordSuccess({ probeId: 'probe-a' })
    assert.equal(mode.diagnostics().status.consecutiveRecoverySuccesses, 1)
    mode.recordSuccess({ probeId: 'probe-a' })
    assert.equal(mode.diagnostics().status.consecutiveRecoverySuccesses, 1)
    assert.equal(mode.diagnostics().status.degraded, true)
    mode.recordSuccess({ probeId: 'probe-b' })
    assert.equal(mode.diagnostics().status.degraded, false)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})
