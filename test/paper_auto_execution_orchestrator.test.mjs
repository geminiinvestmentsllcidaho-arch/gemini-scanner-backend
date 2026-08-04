import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionOrchestrator } from '../src/scanner/paper_auto_execution_orchestrator.mjs'
import { PAPER_EXECUTION_STAGES } from '../src/scanner/paper_execution_stage_promotion_lock.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'

function unlockedState() {
  return {
    activeStage: PAPER_EXECUTION_STAGES.AUTOMATIC,
    stage2Unlocked: true,
    stage3Unlocked: true,
    manualProof: {
      stage: PAPER_EXECUTION_STAGES.MANUAL,
      enterDetected: true, entryReconciled: true, monitoringStarted: true,
      exitDetected: true, exitReconciled: true, roundTripClosed: true,
      restartRecoveryVerified: true, duplicateProtectionVerified: true,
      mechanicalSuccess: true, evidenceId: 'manual-proof', completedAt: '2026-08-04T04:00:00.000Z',
    },
    userApprovedProof: {
      stage: PAPER_EXECUTION_STAGES.USER_APPROVED,
      enterApproved: true, enterSubmittedOnce: true, enterFilledAndReconciled: true,
      exitApproved: true, exitSubmittedOnce: true, exitFilledAndReconciled: true,
      roundTripClosed: true, restartRecoveryVerified: true, duplicateProtectionVerified: true,
      mechanicalSuccess: true, evidenceId: 'approved-proof', completedAt: '2026-08-04T04:10:00.000Z',
    },
  }
}

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-orchestrator-'))
  let tick = Date.parse('2026-08-04T04:20:00.000Z')
  const store = new PaperAutoExecutionLifecycleStore({
    filePath: path.join(dir, 'state.json'),
    clock: () => tick++,
    idFactory: () => 'life-1',
  })
  return { dir, store }
}

const candidateSnapshot = {
  observedAt: '2026-08-04T04:20:00.000Z',
  candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 90 }],
}

test('is disabled by default and automatic start is prohibited', async () => {
  const { dir, store } = makeStore()
  try {
    const orchestrator = createPaperAutoExecutionOrchestrator({ lifecycleStore: store, readStageState: unlockedState, env: {} })
    assert.equal(orchestrator.start().running, false)
    const result = await orchestrator.runOnce()
    assert.equal(result.lastResult.status, 'DISABLED_BY_ENV')
    assert.equal(store.load(), null)
    assert.equal(result.safety.brokerContactAllowed, false)
    assert.equal(result.safety.liveTradingAllowed, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('stage lock blocks lifecycle creation even when env flags are enabled', async () => {
  const { dir, store } = makeStore()
  try {
    const orchestrator = createPaperAutoExecutionOrchestrator({
      lifecycleStore: store,
      getScanSnapshot: async () => candidateSnapshot,
      readStageState: () => ({}),
      env: { PAPER_AUTO_ORCHESTRATOR_ENABLED: '1', PAPER_AUTO_ENTER_ENABLED: '1' },
    })
    const result = await orchestrator.runOnce()
    assert.equal(result.lastResult.status, 'BLOCKED_STAGE_LOCKED')
    assert.equal(store.load(), null)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('creates one durable lifecycle and deterministic enter identity without broker contact', async () => {
  const { dir, store } = makeStore()
  try {
    let scans = 0
    const orchestrator = createPaperAutoExecutionOrchestrator({
      lifecycleStore: store,
      getScanSnapshot: async () => { scans += 1; return candidateSnapshot },
      readStageState: unlockedState,
      env: { PAPER_AUTO_ORCHESTRATOR_ENABLED: '1', PAPER_AUTO_ENTER_ENABLED: '1' },
    })
    const first = await orchestrator.runOnce()
    assert.equal(first.lastResult.status, 'LIFECYCLE_CREATED_ORDER_SUBMISSION_LOCKED')
    assert.equal(first.lastResult.lifecycle.state, S.CANDIDATE_SELECTED)
    assert.match(first.lastResult.enterIdentity.clientOrderId, /^gs-pa-enter-/)
    assert.equal(first.lastResult.safety.orderPlacementAllowed, false)
    assert.equal(scans, 1)

    const second = await orchestrator.runOnce()
    assert.equal(scans, 1)
    assert.equal(second.lifecycle.lifecycleId, 'life-1')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('reconciles confirmed position to monitoring and prepares exact exit identity only', async () => {
  const { dir, store } = makeStore()
  try {
    const lifecycle = store.create({ selectedSymbol: 'AAPL' })
    store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'cid-enter' })
    const orchestrator = createPaperAutoExecutionOrchestrator({
      lifecycleStore: store,
      getAccountSnapshot: async () => ({
        status: 'connected_readonly',
        mode: 'PAPER_ONLY',
        observedAt: '2026-08-04T04:20:00.000Z',
        runtime: { readOnly: true, allowedMethods: ['GET'] },
        positions: [{ assetId: 'asset-aapl', symbol: 'AAPL', qty: 1, averageEntryPrice: 100 }],
        openOrders: [{ id: 'order-enter', clientOrderId: 'cid-enter', symbol: 'AAPL', side: 'buy', status: 'filled', filledQty: 1, filledAvgPrice: 100 }],
      }),
      readStageState: unlockedState,
      env: { PAPER_AUTO_ORCHESTRATOR_ENABLED: '1', PAPER_AUTO_EXIT_ENABLED: '1' },
      now: () => Date.parse('2026-08-04T04:20:30.000Z'),
    })
    const result = await orchestrator.runOnce()
    assert.equal(result.lastResult.lifecycle.state, S.MONITORING)
    assert.match(result.lastResult.exitIdentity.clientOrderId, /^gs-pa-exit-/)
    assert.equal(result.lastResult.exitIdentity.quantity, 1)
    assert.equal(result.lastResult.safety.brokerContactAllowed, false)
    assert.equal(result.lastResult.safety.orderPlacementAllowed, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('uses the gated injected submission boundary for ENTER and exact-position EXIT', () => {
  const source = fs.readFileSync(
    new URL('../src/scanner/paper_auto_execution_orchestrator.mjs', import.meta.url),
    'utf8',
  )
  assert.match(source, /import \{ submitPaperAutoOrder \} from '.\/paper_auto_execution_submission_boundary\.mjs'/)
  assert.match(source, /submitPaperAutoOrder\(\{[\s\S]*?phase: 'enter'/)
  assert.match(source, /submitPaperAutoOrder\(\{[\s\S]*?phase: 'exit'/)
  assert.match(source, /quantity: lifecycle\.filledQuantity/)
  assert.doesNotMatch(source, /fetch\(|https?:\/\/|setInterval\(|setTimeout\(|axios|alpaca/i)
})
