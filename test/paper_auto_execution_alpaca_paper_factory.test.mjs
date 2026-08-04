import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { PAPER_EXECUTION_STAGES } from '../src/scanner/paper_execution_stage_promotion_lock.mjs'
import { REQUIRED_PHRASE } from '../src/scanner/paper_auto_execution_run_once_authorization.mjs'
import { createPaperAutoExecutionAlpacaPaperFactory } from '../src/scanner/paper_auto_execution_alpaca_paper_factory.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-alpaca-factory-'))
  const lifecycleStore = new PaperAutoExecutionLifecycleStore({
    filePath: path.join(dir, 'state.json'),
    clock: () => Date.parse('2026-08-04T22:30:00.000Z'),
    idFactory: () => 'factory-life-1',
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

test('disabled by default performs no network request', async () => {
  const { dir, lifecycleStore } = fixture()
  try {
    let calls = 0
    const built = createPaperAutoExecutionAlpacaPaperFactory({
      lifecycleStore,
      readStageState: unlocked,
      authorization: { env: {} },
      env: {},
      fetchImpl: async () => { calls += 1; throw new Error('must not run') },
      now: () => Date.parse('2026-08-04T22:30:00.000Z'),
    })
    const result = await built.runOnce()
    assert.equal(calls, 0)
    assert.equal(result.coordinator.lastResult.status, 'AUTHORIZED_RUN_ONCE_BLOCKED')
    assert.equal(result.safety.serverIntegrated, false)
    assert.equal(result.safety.automaticStartAllowed, false)
    assert.equal(result.adapter.safety.liveTradingAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('authorized chain reaches injected adapter but adapter disable blocks before network', async () => {
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
    const built = createPaperAutoExecutionAlpacaPaperFactory({
      lifecycleStore,
      readStageState: unlocked,
      getScanSnapshot: async () => ({
        candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 90 }],
      }),
      authorization: {
        env,
        authorizationId: 'factory-run-1',
        operator: 'Borac',
        phrase: REQUIRED_PHRASE,
        scope: 'paper_auto_run_once_only',
        expiresAtMs: Date.parse('2026-08-04T23:00:00.000Z'),
        latchFile: path.join(dir, 'authorization.json'),
      },
      env,
      fetchImpl: async () => { calls += 1; throw new Error('must not run') },
      now: () => Date.parse('2026-08-04T22:30:00.000Z'),
    })
    const result = await built.runOnce()
    assert.equal(calls, 0)
    assert.equal(result.coordinator.lastResult.bridgeInvoked, true)
    assert.equal(result.coordinator.lastResult.status, 'AUTHORIZED_RUN_ONCE_COMPOSITION_SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED')
    assert.equal(result.coordinator.bridge.composition.lastResult.submission.result.status, 'PAPER_AUTO_ADAPTER_BLOCKED')
    assert.ok(result.coordinator.bridge.composition.lastResult.submission.result.blockers.includes('paper_auto_alpaca_adapter_disabled'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('factory start remains prohibited', () => {
  const { dir, lifecycleStore } = fixture()
  try {
    const built = createPaperAutoExecutionAlpacaPaperFactory({
      lifecycleStore,
      readStageState: unlocked,
      authorization: { env: {} },
      env: {},
    })
    const result = built.start()
    assert.equal(result.coordinator.lastResult.status, 'AUTOMATIC_START_PROHIBITED')
    assert.equal(result.coordinator.bridge.started, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('source contains no server, timer, PM2, scheduling, or direct endpoint implementation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_alpaca_paper_factory.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /setInterval|setTimeout|createServer|listen\(?pm2|\/v2\/orders|https?:\/\//)
  assert.match(source, /createPaperAutoExecutionAlpacaPaperAdapter/)
  assert.match(source, /submitPaperOrder: adapter\.submitPaperOrder/)
  assert.match(source, /serverIntegrated: false/)
  assert.match(source, /automaticStartAllowed: false/)
})
