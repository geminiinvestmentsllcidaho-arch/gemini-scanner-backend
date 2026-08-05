import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaperAutoExecutionAlpacaPaperAdapter } from '../src/scanner/paper_auto_execution_alpaca_paper_adapter.mjs'
import { submitPaperAutoOrder } from '../src/scanner/paper_auto_execution_submission_boundary.mjs'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const baseEnv = {
  PAPER_AUTO_ALPACA_ADAPTER_ENABLED: '1',
  PAPER_AUTO_ALPACA_PAPER_BASE_URL: 'https://paper-api.alpaca.markets',
  ALPACA_KEY: 'validated-key',
  ALPACA_SECRET: 'validated-secret',
  APCA_API_KEY_ID: 'stale-key',
  APCA_API_SECRET_KEY: 'stale-secret',
}

test('paper adapter prefers validated ALPACA_KEY and ALPACA_SECRET aliases', async () => {
  let headers
  const adapter = createPaperAutoExecutionAlpacaPaperAdapter({
    env: baseEnv,
    fetchImpl: async (_url, init) => {
      headers = init.headers
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'broker-order-1' }) }
    },
  })
  const result = await adapter.submitPaperOrder({
    symbol: 'BTG', qty: 1, side: 'buy', type: 'market',
    timeInForce: 'day', clientOrderId: 'client-1', paperOnly: true,
  })
  assert.equal(result.orderSubmitted, true)
  assert.equal(headers['APCA-API-KEY-ID'], 'validated-key')
  assert.equal(headers['APCA-API-SECRET-KEY'], 'validated-secret')
})

test('known broker HTTP rejection is classified as rejected, not ambiguous', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-reject-'))
  try {
    const store = new PaperAutoExecutionLifecycleStore({ filePath: path.join(dir, 'lifecycle.json') })
    store.create({ selectedSymbol: 'BTG', scannerEvidence: { symbol: 'BTG' } })
    const adapter = createPaperAutoExecutionAlpacaPaperAdapter({
      env: baseEnv,
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'unauthorized.' }),
      }),
    })
    const result = await submitPaperAutoOrder({
      lifecycleStore: store,
      phase: 'enter',
      quantity: 1,
      submitPaperOrder: adapter.submitPaperOrder,
      env: {
        PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
        PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
      },
    })
    assert.equal(result.status, 'SUBMISSION_REJECTED')
    assert.equal(result.lifecycle.state, 'FAILED_NEEDS_REVIEW')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
