import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { PAPER_EXECUTION_STAGES } from '../src/scanner/paper_execution_stage_promotion_lock.mjs'
import { REQUIRED_PHRASE } from '../src/scanner/paper_auto_execution_run_once_authorization.mjs'
import {
  runPaperAutoExecutionAlpacaPaperAuthorizedCommand,
} from '../src/scanner/paper_auto_execution_alpaca_paper_authorized_command.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-alpaca-command-'))
  const lifecycleStore = new PaperAutoExecutionLifecycleStore({
    filePath: path.join(dir, 'state.json'),
    clock: () => Date.parse('2026-08-04T22:45:00.000Z'),
    idFactory: () => 'alpaca-command-life-1',
  })
  return { dir, lifecycleStore }
}

function unlocked() {
  return {
    activeStage: PAPER_EXECUTION_STAGES.AUTOMATIC,
    stage2Unlocked: true,
    stage3Unlocked: true,
    manualProof: {
      stage: PAPER_EXECUTION_STAGES.MANUAL,
      enterDetected: true, entryReconciled: true, monitoringStarted: true,
      exitDetected: true, exitReconciled: true, roundTripClosed: true,
      restartRecoveryVerified: true, duplicateProtectionVerified: true,
      mechanicalSuccess: true, evidenceId: 'manual', completedAt: '2026-08-04T21:00:00.000Z',
    },
    userApprovedProof: {
      stage: PAPER_EXECUTION_STAGES.USER_APPROVED,
      enterApproved: true, enterSubmittedOnce: true, enterFilledAndReconciled: true,
      exitApproved: true, exitSubmittedOnce: true, exitFilledAndReconciled: true,
      roundTripClosed: true, restartRecoveryVerified: true, duplicateProtectionVerified: true,
      mechanicalSuccess: true, evidenceId: 'approved', completedAt: '2026-08-04T21:10:00.000Z',
    },
  }
}

const commandArgs = (dir) => ({
  execute: 'true',
  authorizationId: 'alpaca-command-run-1',
  operator: 'Borac',
  phrase: REQUIRED_PHRASE,
  scope: 'paper_auto_run_once_only',
  expiresAtMs: String(Date.parse('2026-08-04T23:00:00.000Z')),
  latch: path.join(dir, 'authorization.json'),
})

test('command validation blocks before factory and network', async () => {
  const { dir, lifecycleStore } = fixture()
  try {
    let calls = 0
    const result = await runPaperAutoExecutionAlpacaPaperAuthorizedCommand({
      args: { ...commandArgs(dir), execute: 'false' },
      lifecycleStore,
      readStageState: unlocked,
      env: {},
      fetchImpl: async () => { calls += 1; throw new Error('must not run') },
      nowMs: Date.parse('2026-08-04T22:45:00.000Z'),
    })
    assert.equal(result.status, 'COMMAND_BLOCKED')
    assert.equal(result.coordinatorResult, null)
    assert.equal(calls, 0)
    assert.equal(fs.existsSync(path.join(dir, 'authorization.json')), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('valid command reaches dedicated factory but disabled runtime prevents network', async () => {
  const { dir, lifecycleStore } = fixture()
  try {
    let calls = 0
    const env = { PAPER_AUTO_RUN_ONCE_AUTHORIZATION_ENABLED: '1' }
    const result = await runPaperAutoExecutionAlpacaPaperAuthorizedCommand({
      args: commandArgs(dir),
      lifecycleStore,
      readStageState: unlocked,
      env,
      fetchImpl: async () => { calls += 1; throw new Error('unexpected') },
      nowMs: Date.parse('2026-08-04T22:45:00.000Z'),
    })
    assert.equal(calls, 0)
    assert.equal(result.status, 'AUTHORIZED_RUN_ONCE_RUNTIME_BRIDGE_DISABLED_BY_ENV')
    assert.equal(result.coordinatorResult.coordinator.lastResult.bridgeInvoked, true)
    assert.equal(result.coordinatorResult.adapter.enabled, false)
    assert.equal(result.safety.dedicatedAlpacaPaperFactoryOnly, true)
    assert.equal(result.safety.serverIntegrated, false)
    assert.equal(result.safety.liveTradingAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('all internal gates can reach adapter disable without network', async () => {
  const { dir, lifecycleStore } = fixture()
  try {
    let calls = 0
    const env = {
      PAPER_AUTO_RUN_ONCE_AUTHORIZATION_ENABLED: '1',
      PAPER_AUTO_RUNTIME_BRIDGE_ENABLED: '1',
      PAPER_AUTO_COMPOSITION_ENABLED: '1',
      PAPER_AUTO_ORCHESTRATOR_ENABLED: '1',
      PAPER_AUTO_ENTER_ENABLED: '1',
      PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
      PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
    }
    const result = await runPaperAutoExecutionAlpacaPaperAuthorizedCommand({
      args: commandArgs(dir),
      lifecycleStore,
      readStageState: unlocked,
      getScanSnapshot: async () => ({
        candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 90 }],
      }),
      env,
      fetchImpl: async () => { calls += 1; throw new Error('unexpected') },
      nowMs: Date.parse('2026-08-04T22:45:00.000Z'),
    })
    assert.equal(calls, 0)
    assert.equal(result.status, 'AUTHORIZED_RUN_ONCE_COMPOSITION_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED')
    const submission = result.coordinatorResult.coordinator.bridge.composition.lastResult.submission
    assert.equal(submission.result.status, 'PAPER_AUTO_ADAPTER_BLOCKED')
    assert.ok(submission.result.blockers.includes('paper_auto_alpaca_adapter_disabled'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('source has no script, server, timer, PM2, scheduling, or endpoint integration', () => {
  const source = fs.readFileSync(
    new URL('../src/scanner/paper_auto_execution_alpaca_paper_authorized_command.mjs', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(source, /setInterval|setTimeout|createServer|listen\(|pm2|\/v2\/orders|https?:\/\//)
  assert.match(source, /createPaperAutoExecutionAlpacaPaperFactory/)
  assert.match(source, /serverIntegrated: false/)
  assert.match(source, /automaticStartAllowed: false/)
  assert.match(source, /liveTradingAllowed: false/)
})
