import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { PAPER_EXECUTION_STAGES } from '../src/scanner/paper_execution_stage_promotion_lock.mjs'
import { REQUIRED_PHRASE } from '../src/scanner/paper_auto_execution_run_once_authorization.mjs'
import { createPaperAutoExecutionAuthorizedRunOnceCoordinator } from '../src/scanner/paper_auto_execution_authorized_run_once_coordinator.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-authorized-run-'))
  const lifecycleStore = new PaperAutoExecutionLifecycleStore({
    filePath: path.join(dir, 'state.json'),
    clock: () => Date.parse('2026-08-04T06:00:00.000Z'),
    idFactory: () => 'authorized-life-1',
  })
  const env = {
    PAPER_AUTO_RUN_ONCE_AUTHORIZATION_ENABLED: '1',
    PAPER_AUTO_RUNTIME_BRIDGE_ENABLED: '1',
    PAPER_AUTO_COMPOSITION_ENABLED: '1',
    PAPER_AUTO_ORCHESTRATOR_ENABLED: '1',
    PAPER_AUTO_ENTER_ENABLED: '1',
    PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
    PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
  }
  const authorization = {
    env,
    authorizationId: 'authorized-run-1',
    operator: 'Borac',
    phrase: REQUIRED_PHRASE,
    scope: 'paper_auto_run_once_only',
    expiresAtMs: Date.parse('2026-08-04T07:00:00.000Z'),
    latchFile: path.join(dir, 'authorization.json'),
  }
  return { dir, lifecycleStore, env, authorization }
}

function unlocked() {
  return {
    stage2Unlocked: true,
    stage3Unlocked: true,
    manualProof: {
      stage: PAPER_EXECUTION_STAGES.MANUAL,
      enterDetected: true, entryReconciled: true, monitoringStarted: true,
      exitDetected: true, exitReconciled: true, roundTripClosed: true,
      restartRecoveryVerified: true, duplicateProtectionVerified: true,
      mechanicalSuccess: true, evidenceId: 'm', completedAt: '2026-08-04T05:00:00.000Z',
    },
    userApprovedProof: {
      stage: PAPER_EXECUTION_STAGES.USER_APPROVED,
      enterApproved: true, enterSubmittedOnce: true, enterFilledAndReconciled: true,
      exitApproved: true, exitSubmittedOnce: true, exitFilledAndReconciled: true,
      roundTripClosed: true, restartRecoveryVerified: true, duplicateProtectionVerified: true,
      mechanicalSuccess: true, evidenceId: 'u', completedAt: '2026-08-04T05:10:00.000Z',
    },
  }
}

test('disabled authorization blocks before bridge or adapter', async () => {
  const { dir, lifecycleStore, env, authorization } = fixture()
  try {
    let calls = 0
    authorization.env = {}
    const coordinator = createPaperAutoExecutionAuthorizedRunOnceCoordinator({
      lifecycleStore, env, authorization,
      readStageState: unlocked,
      submitPaperOrder: async () => { calls += 1 },
      now: () => Date.parse('2026-08-04T06:00:00.000Z'),
    })
    const result = await coordinator.runOnce()
    assert.equal(result.lastResult.status, 'AUTHORIZED_RUN_ONCE_BLOCKED')
    assert.equal(result.lastResult.bridgeInvoked, false)
    assert.equal(result.bridge.cycles, 0)
    assert.equal(calls, 0)
    assert.equal(fs.existsSync(authorization.latchFile), false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('valid authorization is consumed before exactly one bridge delegation', async () => {
  const { dir, lifecycleStore, env, authorization } = fixture()
  try {
    let calls = 0
    const coordinator = createPaperAutoExecutionAuthorizedRunOnceCoordinator({
      lifecycleStore, env, authorization,
      readStageState: unlocked,
      getScanSnapshot: async () => ({
        candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 90 }],
      }),
      submitPaperOrder: async () => {
        calls += 1
        return { orderSubmitted: true, orderId: 'paper-order-1' }
      },
      now: () => Date.parse('2026-08-04T06:00:00.000Z'),
    })
    const result = await coordinator.runOnce()
    assert.equal(result.lastResult.status, 'AUTHORIZED_RUN_ONCE_COMPOSITION_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
    assert.equal(result.lastResult.bridgeInvoked, true)
    assert.equal(result.bridge.cycles, 1)
    assert.equal(calls, 1)
    const latch = JSON.parse(fs.readFileSync(authorization.latchFile, 'utf8'))
    assert.equal(latch.status, 'CONSUMED')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('replay is blocked and never delegates a second time', async () => {
  const { dir, lifecycleStore, env, authorization } = fixture()
  try {
    let calls = 0
    const coordinator = createPaperAutoExecutionAuthorizedRunOnceCoordinator({
      lifecycleStore, env, authorization,
      readStageState: unlocked,
      getScanSnapshot: async () => ({
        candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 90 }],
      }),
      submitPaperOrder: async () => {
        calls += 1
        return { orderSubmitted: true, orderId: 'paper-order-1' }
      },
      now: () => Date.parse('2026-08-04T06:00:00.000Z'),
    })
    const first = await coordinator.runOnce()
    const second = await coordinator.runOnce()
    assert.equal(first.lastResult.bridgeInvoked, true)
    assert.equal(second.lastResult.status, 'AUTHORIZED_RUN_ONCE_BLOCKED')
    assert.equal(second.lastResult.bridgeInvoked, false)
    assert.equal(second.bridge.cycles, 1)
    assert.equal(calls, 1)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('automatic start remains prohibited and source has no scheduling network or broker implementation', () => {
  const { dir, lifecycleStore, env, authorization } = fixture()
  try {
    const coordinator = createPaperAutoExecutionAuthorizedRunOnceCoordinator({
      lifecycleStore, env, authorization,
      readStageState: unlocked,
    })
    assert.equal(coordinator.start().lastResult.status, 'AUTOMATIC_START_PROHIBITED')
    const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_authorized_run_once_coordinator.mjs', import.meta.url), 'utf8')
    assert.doesNotMatch(source, /setInterval|setTimeout|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
    assert.match(source, /serverIntegrated: false/)
    assert.match(source, /automaticStartAllowed: false/)
    assert.match(source, /orderPlacementAllowed: false/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
