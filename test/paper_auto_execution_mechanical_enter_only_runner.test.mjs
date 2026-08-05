import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionMechanicalEnterOnlyRunner } from '../src/scanner/paper_auto_execution_mechanical_enter_only_runner.mjs'

const stage = () => {
  const completedAt = '2026-08-05T17:00:00.000Z'
  return {
    activeStage: 'automatic',
    stage2Unlocked: true,
    stage3Unlocked: true,
    manualProof: {
      stage: 'manual_detection_only',
      enterDetected: true,
      entryReconciled: true,
      monitoringStarted: true,
      exitDetected: true,
      exitReconciled: true,
      roundTripClosed: true,
      restartRecoveryVerified: true,
      duplicateProtectionVerified: true,
      mechanicalSuccess: true,
      evidenceId: 'enter_only_test_manual_proof',
      completedAt,
    },
    userApprovedProof: {
      stage: 'user_approved_paper',
      enterApproved: true,
      enterSubmittedOnce: true,
      enterFilledAndReconciled: true,
      exitApproved: true,
      exitSubmittedOnce: true,
      exitFilledAndReconciled: true,
      roundTripClosed: true,
      restartRecoveryVerified: true,
      duplicateProtectionVerified: true,
      mechanicalSuccess: true,
      evidenceId: 'enter_only_test_user_approved_proof',
      completedAt,
    },
  }
}

test('submits one ENTER, reconciles the position, and never prepares EXIT', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enter-only-runner-'))
  try {
    const store = new PaperAutoExecutionLifecycleStore({ filePath: path.join(dir, 'lifecycle.json') })
    let submissions = 0
    const runner = createPaperAutoExecutionMechanicalEnterOnlyRunner({
      lifecycleStore: store,
      readStageState: stage,
      env: { PAPER_AUTO_COMPOSITION_ENABLED: '1', PAPER_AUTO_ORCHESTRATOR_ENABLED: '1', PAPER_AUTO_ENTER_ENABLED: '1', PAPER_AUTO_EXIT_ENABLED: '0', PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1', PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1', PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '0' },
      getScanSnapshot: async () => ({ candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 99 }] }),
      getAccountSnapshot: async () => ({
        status: 'connected_readonly',
        mode: 'PAPER_ONLY',
        observedAt: new Date().toISOString(),
        runtime: { readOnly: true, allowedMethods: ['GET'] },
        positions: submissions ? [{ asset_id: 'aapl', symbol: 'AAPL', qty: '1', avg_entry_price: '100' }] : [],
        openOrders: [],
      }),
      getHistoricalOrders: async () => submissions ? [{ id: 'order-1', client_order_id: store.load()?.enterClientOrderId, symbol: 'AAPL', side: 'buy', status: 'filled', filled_qty: '1' }] : [],
      submitPaperOrder: async (order) => { submissions += 1; assert.equal(order.side, 'buy'); return { ok: true, orderSubmitted: true, orderId: 'order-1', brokerOrderId: 'order-1', clientOrderId: order.clientOrderId } },
      wait: async () => {}, maxCycles: 5, pollIntervalMs: 250,
    })
    const result = await runner.run()
    assert.equal(result.ok, true)
    assert.equal(submissions, 1)
    assert.equal(result.lifecycle.exitClientOrderId, null)
    assert.equal(result.safety.exitAuthorized, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
