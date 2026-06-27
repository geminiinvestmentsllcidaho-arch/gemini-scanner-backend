import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_ORDER_INTENT_ADAPTER_PREVIEW_BRIDGE_VERSION,
  extractPaperOrderRequestFromIntent,
  previewPaperOrderIntentThroughAdapterBridge,
  getPaperOrderIntentAdapterPreviewBridgeDiagnostics
} from '../src/scanner/paper_order_intent_adapter_preview_bridge.mjs';

test('paper order intent bridge extracts intent into adapter contract request', () => {
  const request = extractPaperOrderRequestFromIntent({
    candidateSymbol: ' aapl ',
    action: 'BUY',
    plannedQty: '3',
    orderType: 'MARKET',
    timeInForce: 'DAY',
    intentAuditId: 'intent-123'
  }, { nowMs: 1700000000000 });

  assert.equal(request.contractVersion, 'paper_broker_adapter_contract_v1');
  assert.equal(request.symbol, 'AAPL');
  assert.equal(request.side, 'buy');
  assert.equal(request.qty, 3);
  assert.equal(request.notional, null);
  assert.equal(request.orderType, 'market');
  assert.equal(request.timeInForce, 'day');
  assert.equal(request.auditId, 'intent-123');
});

test('paper order intent bridge routes valid intent through null adapter and remains blocked', () => {
  const result = previewPaperOrderIntentThroughAdapterBridge({
    status: 'ready',
    symbol: 'MSFT',
    side: 'sell',
    qty: 2,
    orderType: 'market',
    timeInForce: 'day'
  }, { nowMs: 1700000000000 });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_ORDER_INTENT_ADAPTER_PREVIEW_BRIDGE_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.diagnosticsOnly, true);
  assert.equal(result.bridgeKind, 'intent_to_null_adapter_preview');
  assert.equal(result.adapterKind, 'null');
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.brokerIntegrationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.liveTradingAllowed, false);
  assert.equal(result.autoTradingAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
  assert.equal(result.contract.ok, true);
  assert.equal(result.adapterPreview.previewStatus, 'blocked');
  assert.equal(result.adapterPreview.blocked, true);
  assert.equal(result.adapterPreview.wouldContactBroker, false);
  assert.equal(result.adapterPreview.wouldPlaceOrder, false);
  assert.equal(result.adapterPreview.wouldMutateAccount, false);
  assert.ok(result.adapterPreview.blockReasons.includes('intent_adapter_preview_bridge_diagnostics_only'));
  assert.ok(result.adapterPreview.blockReasons.includes('broker_contact_blocked_by_null_adapter'));
  assert.ok(result.adapterPreview.blockReasons.includes('null_adapter_blocks_all_broker_contact'));
});

test('paper order intent bridge preserves invalid intent block reasons', () => {
  const result = previewPaperOrderIntentThroughAdapterBridge({
    status: 'blocked',
    blockReasons: ['readiness_gate_blocked'],
    symbol: '',
    action: 'hold'
  }, { nowMs: 1700000000000 });

  assert.equal(result.intent.status, 'blocked');
  assert.equal(result.intent.blocked, true);
  assert.equal(result.contract.ok, false);
  assert.ok(result.adapterPreview.blockReasons.includes('readiness_gate_blocked'));
  assert.ok(result.adapterPreview.blockReasons.includes('symbol_missing'));
  assert.ok(result.adapterPreview.blockReasons.includes('side_not_tradeable'));
  assert.ok(result.adapterPreview.blockReasons.includes('qty_or_notional_missing'));
  assert.equal(result.adapterPreview.wouldContactBroker, false);
  assert.equal(result.adapterPreview.wouldPlaceOrder, false);
});

test('paper order intent bridge diagnostics returns safe preview shape', async () => {
  const result = await getPaperOrderIntentAdapterPreviewBridgeDiagnostics({
    nowMs: 1700000000000,
    symbol: 'AAPL',
    side: 'buy',
    qty: 1
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, 'paper_order_intent_adapter_preview_bridge_v1');
  assert.equal(result.monitorOnly, true);
  assert.equal(result.diagnosticsOnly, true);
  assert.equal(result.adapterKind, 'null');
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.adapterPreview.previewStatus, 'blocked');
  assert.equal(result.adapterPreview.wouldContactBroker, false);
  assert.equal(result.adapterPreview.wouldPlaceOrder, false);
  assert.equal(typeof result.source.sourceAvailable, 'boolean');
});
