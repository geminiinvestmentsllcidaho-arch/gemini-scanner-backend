import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionMechanicalEnterOnlyRunner } from '../src/scanner/paper_auto_execution_mechanical_enter_only_runner.mjs'

test('submits one ENTER, reconciles the position, and never prepares EXIT', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enter-only-runner-'))
  try {
    const store = new PaperAutoExecutionLifecycleStore({ filePath: path.join(dir, 'lifecycle.json') })
    let submissions = 0
    const runner = createPaperAutoExecutionMechanicalEnterOnlyRunner({
      lifecycleStore: store,
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

test('emits fail-open Admin incident when ENTER-only run stays incomplete', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enter-only-incident-'))
  try {
    const store = new PaperAutoExecutionLifecycleStore({ filePath: path.join(dir, 'lifecycle.json') })
    const incidents = []
    const runner = createPaperAutoExecutionMechanicalEnterOnlyRunner({
      lifecycleStore: store,
      env: { PAPER_AUTO_COMPOSITION_ENABLED: '0' },
      getScanSnapshot: async () => ({ candidates: [] }),
      incidentEmitter: async (incident) => { incidents.push(incident); throw new Error('notification_down') },
      wait: async () => {}, maxCycles: 2, pollIntervalMs: 250,
    })
    const result = await runner.run()
    assert.equal(result.status, 'MECHANICAL_ENTER_ONLY_INCOMPLETE_FAIL_CLOSED')
    assert.equal(result.ok, false)
    assert.equal(incidents.length, 1)
    assert.equal(incidents[0].failureCode, 'mechanical_enter_only_bounded_not_completed')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
