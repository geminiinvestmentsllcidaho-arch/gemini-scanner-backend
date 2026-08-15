import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPaperScaleActionIdentity,
  preflightPaperScaleAction,
  reconcilePaperScaleActionFill,
} from '../src/scanner/paper_auto_execution_scale_action_model.mjs'

const lifecycle = overrides => ({
  lifecycleId: 'life-scale-1',
  state: 'MONITORING',
  selectedSymbol: 'ABC',
  filledQuantity: 8,
  brokerPositionIdentity: 'ABC:8',
  enterClientOrderId: 'enter-original',
  exitClientOrderId: null,
  ...overrides,
})

test('builds deterministic distinct whole-share SCALE-IN and SCALE-OUT identities', () => {
  const scaleIn = buildPaperScaleActionIdentity({
    lifecycleId: 'life-scale-1', action: 'scale_in', symbol: 'ABC', fromQuantity: 2, targetQuantity: 7, actionSequence: 1,
  })
  const again = buildPaperScaleActionIdentity({
    lifecycleId: 'life-scale-1', action: 'scale_in', symbol: 'abc', fromQuantity: 2, targetQuantity: 7, actionSequence: 1,
  })
  const scaleOut = buildPaperScaleActionIdentity({
    lifecycleId: 'life-scale-1', action: 'scale_out', symbol: 'ABC', fromQuantity: 8, targetQuantity: 6, actionSequence: 1,
  })
  assert.equal(scaleIn.clientOrderId, again.clientOrderId)
  assert.match(scaleIn.clientOrderId, /^gs-pa-scalein-[a-f0-9]{20}$/)
  assert.match(scaleOut.clientOrderId, /^gs-pa-scaleout-[a-f0-9]{20}$/)
  assert.equal(scaleIn.quantity, 5)
  assert.equal(scaleIn.side, 'buy')
  assert.equal(scaleOut.quantity, 2)
  assert.equal(scaleOut.side, 'sell')
  assert.notEqual(scaleIn.clientOrderId, scaleOut.clientOrderId)
})

test('action sequence prevents repeated-transition client-order-id collisions while remaining deterministic', () => {
  const first = buildPaperScaleActionIdentity({
    lifecycleId: 'life-scale-1', action: 'scale_out', symbol: 'ABC',
    fromQuantity: 8, targetQuantity: 6, actionSequence: 1,
  })
  const same = buildPaperScaleActionIdentity({
    lifecycleId: 'life-scale-1', action: 'scale_out', symbol: 'abc',
    fromQuantity: 8, targetQuantity: 6, actionSequence: 1,
  })
  const later = buildPaperScaleActionIdentity({
    lifecycleId: 'life-scale-1', action: 'scale_out', symbol: 'ABC',
    fromQuantity: 8, targetQuantity: 6, actionSequence: 2,
  })
  assert.equal(first.clientOrderId, same.clientOrderId)
  assert.notEqual(first.clientOrderId, later.clientOrderId)
  assert.equal(first.actionSequence, 1)
  assert.equal(later.actionSequence, 2)
  assert.throws(() => buildPaperScaleActionIdentity({
    lifecycleId: 'life-scale-1', action: 'scale_out', symbol: 'ABC',
    fromQuantity: 8, targetQuantity: 6,
  }), /action_sequence_required/)
})

test('fails closed for non-whole or directionally invalid scale quantities', () => {
  assert.throws(() => buildPaperScaleActionIdentity({
    lifecycleId: 'x', action: 'scale_in', symbol: 'ABC', fromQuantity: 2.5, targetQuantity: 7, actionSequence: 1,
  }), /whole_quantity/)
  assert.throws(() => buildPaperScaleActionIdentity({
    lifecycleId: 'x', action: 'scale_in', symbol: 'ABC', fromQuantity: 7, targetQuantity: 7, actionSequence: 1,
  }), /target_must_increase/)
  assert.throws(() => buildPaperScaleActionIdentity({
    lifecycleId: 'x', action: 'scale_out', symbol: 'ABC', fromQuantity: 8, targetQuantity: 9, actionSequence: 1,
  }), /target_must_reduce/)
})

test('preflight requires MONITORING exact broker quantity identity and no symbol order conflict', () => {
  const ready = preflightPaperScaleAction({
    lifecycle: lifecycle(),
    brokerPosition: { symbol: 'ABC', qty: 8 },
    openOrders: [],
    action: 'scale_out',
    targetQuantity: 6, actionSequence: 1,
  })
  assert.equal(ready.ok, true)
  assert.equal(ready.orderQuantity, 2)
  assert.equal(ready.orderPlacementAllowed, false)
  assert.equal(ready.liveTradingAllowed, false)

  assert.equal(preflightPaperScaleAction({
    lifecycle: lifecycle({ state: 'EXIT_TRIGGERED' }),
    brokerPosition: { symbol: 'ABC', qty: 8 },
    action: 'scale_out', targetQuantity: 6, actionSequence: 1,
  }).status, 'MONITORING_LIFECYCLE_REQUIRED')

  assert.equal(preflightPaperScaleAction({
    lifecycle: lifecycle(),
    brokerPosition: { symbol: 'ABC', qty: 7 },
    action: 'scale_out', targetQuantity: 6, actionSequence: 1,
  }).status, 'EXACT_BROKER_POSITION_REQUIRED')

  assert.equal(preflightPaperScaleAction({
    lifecycle: lifecycle(),
    brokerPosition: { symbol: 'ABC', qty: 8 },
    openOrders: [{ symbol: 'ABC', side: 'sell' }],
    action: 'scale_out', targetQuantity: 6, actionSequence: 1,
  }).status, 'SYMBOL_OPEN_ORDER_CONFLICT')
})

test('accepts broker asset id as lifecycle position identity when present', () => {
  const ready = preflightPaperScaleAction({
    lifecycle: lifecycle({ brokerPositionIdentity: 'asset-abc' }),
    brokerPosition: { symbol: 'ABC', qty: 8, assetId: 'asset-abc' },
    action: 'scale_in',
    targetQuantity: 10, actionSequence: 1,
  })
  assert.equal(ready.ok, true)
  assert.equal(ready.side, 'buy')
  assert.equal(ready.orderQuantity, 2)
})

test('reconciles exact SCALE-IN fill only after broker position reaches target quantity', () => {
  const life = lifecycle({ filledQuantity: 2, brokerPositionIdentity: 'ABC:2' })
  const identity = buildPaperScaleActionIdentity({
    lifecycleId: life.lifecycleId, action: 'scale_in', symbol: 'ABC', fromQuantity: 2, targetQuantity: 7, actionSequence: 1,
  })
  const result = reconcilePaperScaleActionFill({
    lifecycle: life,
    identity,
    order: { id: 'buy-scale', client_order_id: identity.clientOrderId, status: 'filled', filled_qty: 5, filled_at: '2026-08-14T15:00:00Z' },
    brokerPositionAfter: { symbol: 'ABC', qty: 7, asset_id: 'asset-abc', avg_entry_price: 10.25 },
  })
  assert.equal(result.ok, true)
  assert.equal(result.lifecyclePatch.filledQuantity, 7)
  assert.equal(result.lifecyclePatch.brokerPositionIdentity, 'asset-abc')
  assert.equal(result.lifecyclePatch.averageFillPrice, 10.25)
  assert.equal(result.lifecyclePatch.reconciliationEntry.actionSequence, 1)
  assert.equal(result.lifecycleMustRemainMonitoring, true)
  assert.equal(result.mainEnterIdentityUnchanged, true)
  assert.equal(result.mainExitIdentityUnchanged, true)
})

test('reconciles exact SCALE-OUT fill without terminating the round trip', () => {
  const life = lifecycle()
  const identity = buildPaperScaleActionIdentity({
    lifecycleId: life.lifecycleId, action: 'scale_out', symbol: 'ABC', fromQuantity: 8, targetQuantity: 6, actionSequence: 1,
  })
  const result = reconcilePaperScaleActionFill({
    lifecycle: life,
    identity,
    order: { id: 'sell-scale', clientOrderId: identity.clientOrderId, status: 'filled', filledQty: 2 },
    brokerPositionAfter: { symbol: 'ABC', qty: 6, averageEntryPrice: 9.75 },
  })
  assert.equal(result.ok, true)
  assert.equal(result.lifecyclePatch.filledQuantity, 6)
  assert.equal(result.lifecyclePatch.brokerPositionIdentity, 'ABC:6')
  assert.equal(result.lifecycleMustRemainMonitoring, true)
})

test('ambiguous fill or post-scale position mismatch fails closed without proposing a patch', () => {
  const life = lifecycle()
  const identity = buildPaperScaleActionIdentity({
    lifecycleId: life.lifecycleId, action: 'scale_out', symbol: 'ABC', fromQuantity: 8, targetQuantity: 6, actionSequence: 1,
  })
  const partial = reconcilePaperScaleActionFill({
    lifecycle: life,
    identity,
    order: { clientOrderId: identity.clientOrderId, status: 'partially_filled', filledQty: 1 },
    brokerPositionAfter: { symbol: 'ABC', qty: 7 },
  })
  assert.equal(partial.ok, false)
  assert.equal(partial.status, 'BROKER_SCALE_FILL_NOT_EXACT')
  assert.equal(partial.lifecyclePatch, undefined)

  const mismatch = reconcilePaperScaleActionFill({
    lifecycle: life,
    identity,
    order: { clientOrderId: identity.clientOrderId, status: 'filled', filledQty: 2 },
    brokerPositionAfter: { symbol: 'ABC', qty: 7 },
  })
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.status, 'BROKER_POST_SCALE_POSITION_NOT_EXACT')
})
