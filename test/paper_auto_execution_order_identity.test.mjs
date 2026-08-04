import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPaperAutoOrderIdentity,
  assertExactPaperAutoOrderIdentity,
} from '../src/scanner/paper_auto_execution_order_identity.mjs'

test('builds deterministic immutable enter and exit identities', () => {
  const enterA = buildPaperAutoOrderIdentity({
    lifecycleId: 'life-1',
    phase: 'enter',
    symbol: 'spy',
    quantity: 1,
    side: 'buy',
  })
  const enterB = buildPaperAutoOrderIdentity({
    lifecycleId: 'life-1',
    phase: 'enter',
    symbol: 'SPY',
    quantity: 1,
    side: 'buy',
  })
  const exit = buildPaperAutoOrderIdentity({
    lifecycleId: 'life-1',
    phase: 'exit',
    symbol: 'SPY',
    quantity: 1,
    side: 'sell',
  })

  assert.equal(enterA.digest, enterB.digest)
  assert.equal(enterA.clientOrderId, enterB.clientOrderId)
  assert.notEqual(enterA.digest, exit.digest)
  assert.match(enterA.clientOrderId, /^gs-pa-enter-[a-f0-9]{24}$/)
})

test('rejects wrong phase, side, symbol, and quantity', () => {
  assert.throws(() => buildPaperAutoOrderIdentity({
    lifecycleId: 'life-1', phase: 'enter', symbol: 'SPY', quantity: 1, side: 'sell',
  }), /enter_side_must_be_buy/)
  assert.throws(() => buildPaperAutoOrderIdentity({
    lifecycleId: 'life-1', phase: 'exit', symbol: 'SPY', quantity: 1, side: 'buy',
  }), /exit_side_must_be_sell/)
  assert.throws(() => buildPaperAutoOrderIdentity({
    lifecycleId: 'life-1', phase: 'enter', symbol: '', quantity: 1, side: 'buy',
  }), /symbol_invalid/)
  assert.throws(() => buildPaperAutoOrderIdentity({
    lifecycleId: 'life-1', phase: 'enter', symbol: 'SPY', quantity: 0, side: 'buy',
  }), /quantity_invalid/)
})

test('exact identity assertion rejects symbol, quantity, phase, or lifecycle drift', () => {
  const expected = {
    lifecycleId: 'life-1', phase: 'exit', symbol: 'SPY', quantity: 1, side: 'sell',
  }
  assert.equal(assertExactPaperAutoOrderIdentity(expected, { ...expected }), true)
  assert.throws(() => assertExactPaperAutoOrderIdentity(expected, { ...expected, symbol: 'AAPL' }), /identity_mismatch/)
  assert.throws(() => assertExactPaperAutoOrderIdentity(expected, { ...expected, quantity: 2 }), /identity_mismatch/)
  assert.throws(() => assertExactPaperAutoOrderIdentity(expected, {
    lifecycleId: 'life-2', phase: 'exit', symbol: 'SPY', quantity: 1, side: 'sell',
  }), /identity_mismatch/)
})

test('identity module performs no network or broker contact', () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    throw new Error('network forbidden')
  }
  try {
    buildPaperAutoOrderIdentity({
      lifecycleId: 'life-1', phase: 'enter', symbol: 'SPY', quantity: 1, side: 'buy',
    })
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
