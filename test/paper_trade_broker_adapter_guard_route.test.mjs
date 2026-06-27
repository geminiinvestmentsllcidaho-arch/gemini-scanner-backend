import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluatePaperTradeBrokerAdapterGuard,
  readPaperTradeBrokerAdapterGuardPanel
} from '../src/scanner/paper_trade_broker_adapter_guard.mjs';

test('paper broker adapter guard route payload stays blocked and safe', () => {
  const result = evaluatePaperTradeBrokerAdapterGuard();

  assert.equal(result.ok, true);
  assert.equal(result.version, 'paper_trade_broker_adapter_guard_v1');
  assert.equal(result.status, 'blocked');
  assert.equal(result.brokerAdapterEnabled, false);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
  assert.equal(result.executionAllowed, false);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
});

test('paper broker adapter guard panel route payload stays blocked and safe', () => {
  const panel = readPaperTradeBrokerAdapterGuardPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_broker_adapter_guard_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'blocked');
  assert.equal(panel.summary.executionAllowed, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
