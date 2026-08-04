import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { PAPER_EXECUTION_STAGES } from '../src/scanner/paper_execution_stage_promotion_lock.mjs'
import { REQUIRED_PHRASE } from '../src/scanner/paper_auto_execution_run_once_authorization.mjs'
import {
  runPaperAutoExecutionAuthorizedRunOnceCommand,
  writePaperAutoExecutionAuthorizedRunOnceCommandReport,
} from '../src/scanner/paper_auto_execution_authorized_run_once_command_tool.mjs'

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

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-command-'))
  const lifecycleStore = new PaperAutoExecutionLifecycleStore({
    filePath: path.join(dir, 'state.json'),
    clock: () => Date.parse('2026-08-04T06:00:00.000Z'),
    idFactory: () => 'command-life-1',
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
  const argv = [
    '--execute=true',
    '--authorization-id=auth-1',
    '--operator=Borac',
    `--phrase=${REQUIRED_PHRASE}`,
    '--scope=paper_auto_run_once_only',
    `--expires-at-ms=${Date.parse('2026-08-04T07:00:00.000Z')}`,
    `--latch=${path.join(dir, 'authorization.json')}`,
  ]
  return { dir, lifecycleStore, env, argv }
}

test('missing explicit execute flag blocks before coordinator and adapter', async () => {
  const { dir, lifecycleStore, env, argv } = fixture()
  try {
    let calls = 0
    const report = await runPaperAutoExecutionAuthorizedRunOnceCommand({
      lifecycleStore, env,
      argv: argv.filter((item) => item !== '--execute=true'),
      readStageState: unlocked,
      submitPaperOrder: async () => { calls += 1 },
      nowMs: Date.parse('2026-08-04T06:00:00.000Z'),
    })
    assert.equal(report.status, 'COMMAND_BLOCKED')
    assert.ok(report.blockers.includes('explicit_execute_true_required'))
    assert.equal(report.coordinatorResult, null)
    assert.equal(calls, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('exact command delegates once through authorization and coordinator', async () => {
  const { dir, lifecycleStore, env, argv } = fixture()
  try {
    let calls = 0
    const report = await runPaperAutoExecutionAuthorizedRunOnceCommand({
      lifecycleStore, env, argv,
      readStageState: unlocked,
      getScanSnapshot: async () => ({
        candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 90 }],
      }),
      submitPaperOrder: async () => {
        calls += 1
        return { orderSubmitted: true, orderId: 'paper-order-1' }
      },
      nowMs: Date.parse('2026-08-04T06:00:00.000Z'),
    })
    assert.equal(report.ok, true)
    assert.equal(report.executeRequested, true)
    assert.equal(report.coordinatorResult.lastResult.bridgeInvoked, true)
    assert.equal(calls, 1)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('report writer creates private json artifact', async () => {
  const { dir, lifecycleStore, env, argv } = fixture()
  try {
    const report = await runPaperAutoExecutionAuthorizedRunOnceCommand({
      lifecycleStore, env,
      argv: argv.filter((item) => item !== '--execute=true'),
      readStageState: unlocked,
      nowMs: Date.parse('2026-08-04T06:00:00.000Z'),
    })
    const file = writePaperAutoExecutionAuthorizedRunOnceCommandReport(report, dir)
    assert.equal(fs.existsSync(file), true)
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).status, 'COMMAND_BLOCKED')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('source and cli contain no scheduling network or direct broker implementation', () => {
  for (const file of [
    new URL('../src/scanner/paper_auto_execution_authorized_run_once_command_tool.mjs', import.meta.url),
    new URL('../scripts/paper_auto_execution_authorized_run_once_command.mjs', import.meta.url),
  ]) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /setInterval|setTimeout|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
  }
})
