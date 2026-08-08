import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionRuntimeBridge } from '../src/scanner/paper_auto_execution_runtime_bridge.mjs'

function storeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-runtime-'))
  const lifecycleStore = new PaperAutoExecutionLifecycleStore({
    filePath: path.join(dir, 'state.json'),
    clock: () => Date.parse('2026-08-04T06:00:00.000Z'),
    idFactory: () => 'runtime-life-1',
  })
  return { dir, lifecycleStore }
}

test('disabled by default and automatic start is prohibited', async () => {
  const { dir, lifecycleStore } = storeFixture()
  try {
    let calls = 0
    const bridge = createPaperAutoExecutionRuntimeBridge({
      lifecycleStore,
      submitPaperOrder: async () => { calls += 1 },
      env: {},
    })
    assert.equal(bridge.start().lastStatus, 'AUTOMATIC_START_PROHIBITED')
    const result = await bridge.runOnce()
    assert.equal(result.lastStatus, 'RUNTIME_BRIDGE_DISABLED_BY_ENV')
    assert.equal(result.started, false)
    assert.equal(calls, 0)
    assert.equal(lifecycleStore.load(), null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('bridge flag alone cannot bypass disabled composition', async () => {
  const { dir, lifecycleStore } = storeFixture()
  try {
    let calls = 0
    const bridge = createPaperAutoExecutionRuntimeBridge({
      lifecycleStore,
      submitPaperOrder: async () => { calls += 1 },
      env: { PAPER_AUTO_RUNTIME_BRIDGE_ENABLED: '1' },
    })
    const result = await bridge.runOnce()
    assert.equal(result.lastStatus, 'COMPOSITION_DISABLED_BY_ENV')
    assert.equal(calls, 0)
    assert.equal(lifecycleStore.load(), null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('explicit run once delegates through all existing gates without scheduling', async () => {
  const { dir, lifecycleStore } = storeFixture()
  try {
    let calls = 0
    const bridge = createPaperAutoExecutionRuntimeBridge({
      lifecycleStore,
      getScanSnapshot: async () => ({
        candidates: [{ symbol: 'AAPL', state: 'ENTER', buyRecommendation: true, blockers: [], score: 90 }],
      }),
      submitPaperOrder: async () => {
        calls += 1
        return { orderSubmitted: true, orderId: 'paper-order-1' }
      },
      env: {
        PAPER_AUTO_RUNTIME_BRIDGE_ENABLED: '1',
        PAPER_AUTO_COMPOSITION_ENABLED: '1',
        PAPER_AUTO_ORCHESTRATOR_ENABLED: '1',
        PAPER_AUTO_ENTER_ENABLED: '1',
        PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
        PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
      },
    })
    const result = await bridge.runOnce()
    assert.equal(result.started, false)
    assert.equal(result.cycles, 1)
    assert.equal(result.lastStatus, 'COMPOSITION_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
    assert.equal(calls, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('source contains no timer, server wiring, network, or direct broker implementation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_runtime_bridge.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /setInterval|setTimeout|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
  assert.match(source, /serverIntegrated: false/)
  assert.match(source, /automaticStartAllowed: false/)
})
