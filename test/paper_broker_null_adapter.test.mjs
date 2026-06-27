import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_BROKER_NULL_ADAPTER_VERSION,
  previewPaperBrokerNullOrder,
  getPaperBrokerNullAdapterDiagnostics
} from '../src/scanner/paper_broker_null_adapter.mjs';

test('paper broker null adapter always blocks broker contact and order placement', () => {
  const result = previewPaperBrokerNullOrder({
    symbol: 'aapl',
    side: 'buy',
    qty: 1,
    orderType: 'market',
    timeInForce: 'day'
  }, { nowMs: 1700000000000 });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_BROKER_NULL_ADAPTER_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.diagnosticsOnly, true);
  assert.equal(result.adapterKind, 'null');
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.liveTradingAllowed, false);
  assert.equal(result.autoTradingAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
  assert.equal(result.preview.previewStatus, 'blocked');
  assert.equal(result.preview.wouldContactBroker, false);
  assert.equal(result.preview.wouldPlaceOrder, false);
  assert.equal(result.preview.wouldMutateAccount, false);
  assert.equal(result.preview.blocked, true);
  assert.ok(result.preview.blockReasons.includes('null_adapter_blocks_all_broker_contact'));
  assert.ok(result.preview.blockReasons.includes('order_placement_disabled'));
  assert.ok(result.preview.blockReasons.includes('account_mutation_disabled'));
  assert.equal(result.request.symbol, 'AAPL');
  assert.equal(result.request.side, 'buy');
  assert.equal(result.request.qty, 1);
  assert.equal(result.request.notional, null);
  assert.equal(result.request.orderType, 'market');
  assert.equal(result.request.timeInForce, 'day');
});

test('paper broker null adapter reports invalid order shape without enabling execution', () => {
  const result = previewPaperBrokerNullOrder({
    symbol: '',
    side: 'hold',
    qty: -1,
    notional: 25,
    orderType: 'bad_type',
    timeInForce: 'bad_tif'
  }, { nowMs: 1700000000000 });

  assert.equal(result.preview.blocked, true);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.ok(result.preview.blockReasons.includes('symbol_missing'));
  assert.ok(result.preview.blockReasons.includes('side_not_tradeable'));
  assert.ok(result.preview.blockReasons.includes('qty_not_positive'));
  assert.ok(result.preview.blockReasons.includes('qty_and_notional_both_present'));
  assert.ok(result.preview.blockReasons.includes('order_type_invalid'));
  assert.ok(result.preview.blockReasons.includes('time_in_force_invalid'));
});

test('paper broker null adapter diagnostics returns deterministic safe preview shape', () => {
  const result = getPaperBrokerNullAdapterDiagnostics({ nowMs: 1700000000000 });

  assert.equal(result.ok, true);
  assert.equal(result.version, 'paper_broker_null_adapter_v1');
  assert.equal(result.adapterKind, 'null');
  assert.equal(result.preview.previewStatus, 'blocked');
  assert.equal(result.preview.wouldContactBroker, false);
  assert.equal(result.preview.wouldPlaceOrder, false);
  assert.equal(result.request.auditId, 'null-paper-AAPL-1700000000000');
});
