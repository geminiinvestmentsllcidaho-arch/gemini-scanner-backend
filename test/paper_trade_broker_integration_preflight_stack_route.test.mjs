import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluatePaperTradeBrokerIntegrationPreflightStack,
  readPaperTradeBrokerIntegrationPreflightStackPanel
} from '../src/scanner/paper_trade_broker_integration_preflight_stack.mjs';

test('paper broker integration preflight stack route payload stays blocked and safe', () => {
  const stack = evaluatePaperTradeBrokerIntegrationPreflightStack();

  assert.equal(stack.ok, true);
  assert.equal(stack.version, 'paper_trade_broker_integration_preflight_stack_v1');
  assert.equal(stack.buildCount, 50);
  assert.equal(stack.status, 'blocked_by_design');
  assert.equal(stack.brokerIntegrationAllowed, false);
  assert.equal(stack.brokerContactAllowed, false);
  assert.equal(stack.orderPlacementAllowed, false);
  assert.equal(stack.accountMutationAllowed, false);
  assert.equal(stack.safety.localJsonlOnly, true);
});

test('paper broker integration preflight stack panel route payload stays blocked and safe', () => {
  const panel = readPaperTradeBrokerIntegrationPreflightStackPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_broker_integration_preflight_stack_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.buildCount, 50);
  assert.equal(panel.status, 'blocked_by_design');
  assert.equal(panel.summary.brokerIntegrationAllowed, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
