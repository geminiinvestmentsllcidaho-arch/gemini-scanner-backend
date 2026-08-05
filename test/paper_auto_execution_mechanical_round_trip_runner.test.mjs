import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { PAPER_EXECUTION_STAGES } from '../src/scanner/paper_execution_stage_promotion_lock.mjs'
import { createPaperAutoExecutionMechanicalRoundTripRunner } from '../src/scanner/paper_auto_execution_mechanical_round_trip_runner.mjs'

const unlocked = () => ({
  activeStage: PAPER_EXECUTION_STAGES.AUTOMATIC,
  stage2Unlocked: true, stage3Unlocked: true,
  manualProof: {
    stage: PAPER_EXECUTION_STAGES.MANUAL, enterDetected: true, entryReconciled: true,
    monitoringStarted: true, exitDetected: true, exitReconciled: true, roundTripClosed: true,
    restartRecoveryVerified: true, duplicateProtectionVerified: true, mechanicalSuccess: true,
    evidenceId: 'manual', completedAt: '2026-08-05T00:00:00.000Z',
  },
  userApprovedProof: {
    stage: PAPER_EXECUTION_STAGES.USER_APPROVED, enterApproved: true, enterSubmittedOnce: true,
    enterFilledAndReconciled: true, exitApproved: true, exitSubmittedOnce: true,
    exitFilledAndReconciled: true, roundTripClosed: true, restartRecoveryVerified: true,
    duplicateProtectionVerified: true, mechanicalSuccess: true,
    evidenceId: 'approved', completedAt: '2026-08-05T00:01:00.000Z',
  },
})

const env = {
  PAPER_AUTO_COMPOSITION_ENABLED: '1',
  PAPER_AUTO_ORCHESTRATOR_ENABLED: '1',
  PAPER_AUTO_ENTER_ENABLED: '1',
  PAPER_AUTO_EXIT_ENABLED: '1',
  PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
  PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
  PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '1',
}

test('completes one top-candidate exact-position mechanical round trip', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-mechanical-'))
  try {
    let entered = false
    let exited = false
    let submissions = 0
    const store = new PaperAutoExecutionLifecycleStore({
      filePath: path.join(dir, 'state.json'),
      idFactory: () => 'mechanical-life-1',
    })
    const runner = createPaperAutoExecutionMechanicalRoundTripRunner({
      lifecycleStore: store, readStageState: unlocked, env,
      getScanSnapshot: async () => ({ candidates: [
        { symbol: 'MSFT', state: 'ENTER', buyRecommendation: true, blockers: [], score: 80 },
        { symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 95 },
      ] }),
      submitPaperOrder: async (order) => {
        submissions += 1
        if (order.side === 'buy') entered = true
        if (order.side === 'sell') exited = true
        return { orderSubmitted: true, orderId: `${order.side}-broker-id` }
      },
      getAccountSnapshot: async () => ({
        status: 'connected_readonly', mode: 'PAPER_ONLY',
        observedAt: new Date().toISOString(),
        runtime: { readOnly: true, allowedMethods: ['GET'] },
        positions: entered && !exited
          ? [{ asset_id: 'asset-aapl', symbol: 'AAPL', qty: '1', avg_entry_price: '100' }]
          : [],
        openOrders: [],
      }),
      getHistoricalOrders: async () => {
        const life = store.load()
        const orders = []
        if (life?.enterClientOrderId) orders.push({
          id: 'buy-broker-id', client_order_id: life.enterClientOrderId,
          symbol: 'AAPL', side: 'buy', status: 'filled',
          filled_qty: '1', filled_avg_price: '100',
        })
        if (life?.exitClientOrderId) orders.push({
          id: 'sell-broker-id', client_order_id: life.exitClientOrderId,
          symbol: 'AAPL', side: 'sell', status: 'filled',
          filled_qty: '1', filled_avg_price: '101',
        })
        return orders
      },
      wait: async () => {}, maxCycles: 8, pollIntervalMs: 250,
    })
    const result = await runner.run()
    assert.equal(result.completed, true)
    assert.equal(result.lifecycle.selectedSymbol, 'AAPL')
    assert.equal(result.lifecycle.state, 'ROUND_TRIP_COMPLETED')
    assert.equal(submissions, 2)
    assert.equal(result.safety.strategyExitCriteriaRequired, false)
    assert.equal(result.safety.exactPositionExitRequired, true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('fails closed after bounded cycles without duplicate entry', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-mechanical-'))
  try {
    let submissions = 0
    const store = new PaperAutoExecutionLifecycleStore({
      filePath: path.join(dir, 'state.json'),
      idFactory: () => 'mechanical-life-2',
    })
    const runner = createPaperAutoExecutionMechanicalRoundTripRunner({
      lifecycleStore: store, readStageState: unlocked, env,
      getScanSnapshot: async () => ({ candidates: [
        { symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 99 },
      ] }),
      submitPaperOrder: async () => {
        submissions += 1
        return { orderSubmitted: true, orderId: 'buy-only' }
      },
      getAccountSnapshot: async () => ({
        status: 'connected_readonly', mode: 'PAPER_ONLY',
        observedAt: new Date().toISOString(),
        runtime: { readOnly: true, allowedMethods: ['GET'] },
        positions: [], openOrders: [],
      }),
      getHistoricalOrders: async () => [],
      wait: async () => {}, maxCycles: 3, pollIntervalMs: 250,
    })
    const result = await runner.run()
    assert.equal(result.completed, false)
    assert.equal(submissions, 1)
    assert.equal(result.safety.blindRetryAllowed, false)
    assert.equal(result.safety.additionalEntryAllowed, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
