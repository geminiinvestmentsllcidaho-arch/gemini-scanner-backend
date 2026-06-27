import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_BROKER_ADAPTER_GUARD_VERSION,
  evaluatePaperTradeBrokerAdapterGuard,
  readPaperTradeBrokerAdapterGuardPanel
} from '../src/scanner/paper_trade_broker_adapter_guard.mjs';

test('paper broker adapter guard blocks broker execution by design', () => {
  const result = evaluatePaperTradeBrokerAdapterGuard({
    orderTicket: {
      symbol: 'AAPL',
      side: 'buy',
      qty: '10',
      type: 'market',
      time_in_force: 'day'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADE_BROKER_ADAPTER_GUARD_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.previewOnly, true);
  assert.equal(result.paperOnly, true);
  assert.equal(result.status, 'blocked');
  assert.equal(result.brokerAdapterEnabled, false);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
  assert.equal(result.executionAllowed, false);
  assert.ok(result.reasons.includes('broker_adapter_disabled'));
  assert.ok(result.reasons.includes('operator_broker_approval_missing'));
  assert.equal(result.adapter.name, 'disabled_paper_broker_adapter');
  assert.equal(result.adapter.broker, 'none');
  assert.equal(result.adapter.endpoint, null);
  assert.equal(result.adapter.requestBody, null);
  assert.equal(result.adapter.disabledByDesign, true);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
});

test('paper broker adapter guard normalizes supplied ticket without allowing execution', () => {
  const result = evaluatePaperTradeBrokerAdapterGuard({
    ticket: {
      symbol: 'MSFT',
      side: 'sell',
      quantity: 20,
      orderType: 'market',
      timeInForce: 'day'
    }
  });

  assert.equal(result.normalized.hasTicket, true);
  assert.equal(result.normalized.symbol, 'MSFT');
  assert.equal(result.normalized.side, 'sell');
  assert.equal(result.normalized.qty, 20);
  assert.equal(result.normalized.type, 'market');
  assert.equal(result.normalized.timeInForce, 'day');
  assert.equal(result.executionAllowed, false);
});

test('paper broker adapter guard panel exposes operator dashboard card', () => {
  const panel = readPaperTradeBrokerAdapterGuardPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_broker_adapter_guard_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'blocked');
  assert.equal(panel.severity, 'blocked');
  assert.equal(panel.summary.brokerAdapterEnabled, false);
  assert.equal(panel.summary.brokerContactAllowed, false);
  assert.equal(panel.summary.orderPlacementAllowed, false);
  assert.equal(panel.summary.accountMutationAllowed, false);
  assert.equal(panel.summary.executionAllowed, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
