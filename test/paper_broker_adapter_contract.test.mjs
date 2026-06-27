import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_BROKER_ADAPTER_CONTRACT_VERSION,
  normalizePaperBrokerOrderRequest,
  validatePaperBrokerOrderRequest,
  buildPaperBrokerAdapterPreviewResponse,
  getPaperBrokerAdapterContractDiagnostics
} from '../src/scanner/paper_broker_adapter_contract.mjs';

test('paper broker adapter contract normalizes exact request shape', () => {
  const request = normalizePaperBrokerOrderRequest({
    symbol: ' aapl ',
    side: 'BUY',
    qty: '1',
    orderType: 'MARKET',
    time_in_force: 'DAY'
  }, { nowMs: 1700000000000 });

  assert.deepEqual(Object.keys(request), [
    'contractVersion',
    'symbol',
    'side',
    'qty',
    'notional',
    'orderType',
    'timeInForce',
    'limitPrice',
    'stopPrice',
    'auditId'
  ]);
  assert.equal(request.contractVersion, PAPER_BROKER_ADAPTER_CONTRACT_VERSION);
  assert.equal(request.symbol, 'AAPL');
  assert.equal(request.side, 'buy');
  assert.equal(request.qty, 1);
  assert.equal(request.notional, null);
  assert.equal(request.orderType, 'market');
  assert.equal(request.timeInForce, 'day');
  assert.equal(request.limitPrice, null);
  assert.equal(request.stopPrice, null);
  assert.equal(request.auditId, 'paper-broker-contract-AAPL-1700000000000');
});

test('paper broker adapter contract validates bad order shape', () => {
  const result = validatePaperBrokerOrderRequest({
    symbol: '',
    side: 'hold',
    qty: -1,
    notional: 50,
    orderType: 'wrong',
    timeInForce: 'wrong'
  });

  assert.equal(result.ok, false);
  assert.ok(result.blockReasons.includes('symbol_missing'));
  assert.ok(result.blockReasons.includes('side_not_tradeable'));
  assert.ok(result.blockReasons.includes('qty_not_positive'));
  assert.ok(result.blockReasons.includes('qty_and_notional_both_present'));
  assert.ok(result.blockReasons.includes('order_type_invalid'));
  assert.ok(result.blockReasons.includes('time_in_force_invalid'));
});

test('paper broker adapter contract locks preview response shape and blocks by default', () => {
  const result = buildPaperBrokerAdapterPreviewResponse({
    request: {
      symbol: 'MSFT',
      side: 'sell',
      qty: 2,
      orderType: 'market',
      timeInForce: 'day'
    },
    nowMs: 1700000000000
  });

  assert.deepEqual(Object.keys(result), [
    'ok',
    'version',
    'monitorOnly',
    'diagnosticsOnly',
    'adapterKind',
    'brokerContactAllowed',
    'orderPlacementAllowed',
    'accountMutationAllowed',
    'request',
    'preview',
    'ts'
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_BROKER_ADAPTER_CONTRACT_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.diagnosticsOnly, true);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
  assert.equal(result.preview.previewStatus, 'blocked');
  assert.equal(result.preview.blocked, true);
  assert.equal(result.preview.wouldContactBroker, false);
  assert.equal(result.preview.wouldPlaceOrder, false);
  assert.equal(result.preview.wouldMutateAccount, false);
  assert.ok(result.preview.blockReasons.includes('broker_contact_not_allowed'));
  assert.ok(result.preview.blockReasons.includes('order_placement_not_allowed'));
  assert.ok(result.preview.blockReasons.includes('account_mutation_not_allowed'));
});

test('paper broker adapter contract diagnostics is safe and deterministic', () => {
  const result = getPaperBrokerAdapterContractDiagnostics({ nowMs: 1700000000000 });

  assert.equal(result.ok, true);
  assert.equal(result.version, 'paper_broker_adapter_contract_v1');
  assert.equal(result.adapterKind, 'contract');
  assert.equal(result.request.symbol, 'AAPL');
  assert.equal(result.request.auditId, 'paper-broker-contract-AAPL-1700000000000');
  assert.equal(result.preview.previewStatus, 'blocked');
  assert.equal(result.preview.wouldContactBroker, false);
  assert.equal(result.preview.wouldPlaceOrder, false);
  assert.ok(result.preview.blockReasons.includes('contract_diagnostics_only'));
});
