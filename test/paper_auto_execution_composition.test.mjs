import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionComposition } from '../src/scanner/paper_auto_execution_composition.mjs'
import { PAPER_EXECUTION_STAGES } from '../src/scanner/paper_execution_stage_promotion_lock.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'

function unlocked() {
  return {
    stage2Unlocked: true, stage3Unlocked: true,
    manualProof: { stage: PAPER_EXECUTION_STAGES.MANUAL, enterDetected: true, entryReconciled: true, monitoringStarted: true, exitDetected: true, exitReconciled: true, roundTripClosed: true, restartRecoveryVerified: true, duplicateProtectionVerified: true, mechanicalSuccess: true, evidenceId: 'm', completedAt: '2026-08-04T00:00:00Z' },
    userApprovedProof: { stage: PAPER_EXECUTION_STAGES.USER_APPROVED, enterApproved: true, enterSubmittedOnce: true, enterFilledAndReconciled: true, exitApproved: true, exitSubmittedOnce: true, exitFilledAndReconciled: true, roundTripClosed: true, restartRecoveryVerified: true, duplicateProtectionVerified: true, mechanicalSuccess: true, evidenceId: 'u', completedAt: '2026-08-04T00:01:00Z' },
  }
}
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-compose-'))
  const store = new PaperAutoExecutionLifecycleStore({ filePath: path.join(dir, 'state.json'), clock: () => 1785819600000, idFactory: () => 'life-compose-1' })
  return { dir, store }
}
const env = {
  PAPER_AUTO_COMPOSITION_ENABLED: '1',
  PAPER_AUTO_ORCHESTRATOR_ENABLED: '1',
  PAPER_AUTO_ENTER_ENABLED: '1',
  PAPER_AUTO_EXIT_ENABLED: '1',
  PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
  PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
  PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '1',
}

test('disabled by default and start prohibited', async () => {
  const { dir, store } = fixture()
  try {
    let calls = 0
    const c = createPaperAutoExecutionComposition({ lifecycleStore: store, readStageState: unlocked, submitPaperOrder: async () => { calls += 1 }, env: {} })
    assert.equal(c.start().lastResult.status, 'COMPOSITION_AUTOMATIC_START_PROHIBITED')
    assert.equal((await c.runOnce()).lastResult.status, 'COMPOSITION_DISABLED_BY_ENV')
    assert.equal(calls, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('stage lock blocks before orchestration or adapter', async () => {
  const { dir, store } = fixture()
  try {
    let calls = 0
    const c = createPaperAutoExecutionComposition({ lifecycleStore: store, readStageState: () => ({}), submitPaperOrder: async () => { calls += 1 }, env })
    assert.equal((await c.runOnce()).lastResult.status, 'COMPOSITION_BLOCKED_STAGE_LOCKED')
    assert.equal(store.load(), null)
    assert.equal(calls, 0)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('eligible enter invokes injected adapter once and blocks replay by state', async () => {
  const { dir, store } = fixture()
  try {
    let calls = 0
    const c = createPaperAutoExecutionComposition({
      lifecycleStore: store, readStageState: unlocked, env,
      getScanSnapshot: async () => ({ candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 90 }] }),
      submitPaperOrder: async () => { calls += 1; return { orderSubmitted: true, orderId: 'broker-1' } },
    })
    const first = await c.runOnce()
    assert.equal(first.lastResult.status, 'COMPOSITION_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
    assert.equal(store.load().state, S.ENTER_OPEN)
    assert.equal(calls, 1)
    const second = await c.runOnce()
    assert.equal(second.lastResult.adapterInvoked, false)
    assert.equal(calls, 1)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('source contains no direct network or broker implementation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_composition.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /api\.alpaca|\/v2\/orders|https?:\/\//)
})
