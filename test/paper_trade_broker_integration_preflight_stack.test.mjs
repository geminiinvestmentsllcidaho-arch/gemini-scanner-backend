import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_BROKER_INTEGRATION_PREFLIGHT_LAYER_IDS,
  PAPER_TRADE_BROKER_INTEGRATION_PREFLIGHT_STACK_VERSION,
  evaluatePaperTradeBrokerIntegrationPreflightStack,
  readPaperTradeBrokerIntegrationPreflightStackPanel
} from '../src/scanner/paper_trade_broker_integration_preflight_stack.mjs';

test('paper broker integration preflight stack exposes exactly 50 planned builds', () => {
  const stack = evaluatePaperTradeBrokerIntegrationPreflightStack();

  assert.equal(stack.ok, true);
  assert.equal(stack.version, PAPER_TRADE_BROKER_INTEGRATION_PREFLIGHT_STACK_VERSION);
  assert.equal(stack.monitorOnly, true);
  assert.equal(stack.previewOnly, true);
  assert.equal(stack.paperOnly, true);
  assert.equal(stack.stackType, 'next_50_broker_integration_preflight_builds');
  assert.equal(stack.buildCount, 50);
  assert.equal(stack.expectedBuildCount, 50);
  assert.equal(stack.layers.length, 50);
  assert.deepEqual(stack.layers.map((layer) => layer.id), PAPER_TRADE_BROKER_INTEGRATION_PREFLIGHT_LAYER_IDS);
  assert.equal(stack.status, 'blocked_by_design');
  assert.equal(stack.brokerIntegrationAllowed, false);
  assert.equal(stack.brokerAdapterEnabled, false);
  assert.equal(stack.brokerContactAllowed, false);
  assert.equal(stack.orderPlacementAllowed, false);
  assert.equal(stack.accountMutationAllowed, false);
  assert.equal(stack.executionAllowed, false);
  assert.equal(stack.safety.brokerContact, false);
  assert.equal(stack.safety.orderPlacement, false);
  assert.equal(stack.safety.accountMutation, false);
});

test('paper broker integration preflight stack layers are all blocked and safe', () => {
  const stack = evaluatePaperTradeBrokerIntegrationPreflightStack();

  for (const layer of stack.layers) {
    assert.equal(layer.blocked, true);
    assert.equal(layer.passed, false);
    assert.equal(layer.reasonCount, 1);
    assert.equal(layer.safety.brokerContact, false);
    assert.equal(layer.safety.orderPlacement, false);
    assert.equal(layer.safety.accountMutation, false);
  }

  assert.equal(stack.categoryCounts.safety_core, 6);
  assert.equal(stack.categoryCounts.risk_controls, 13);
  assert.equal(stack.categoryCounts.governance, 4);
});

test('paper broker integration preflight stack panel exposes operator dashboard card', () => {
  const panel = readPaperTradeBrokerIntegrationPreflightStackPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_broker_integration_preflight_stack_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'blocked_by_design');
  assert.equal(panel.severity, 'blocked');
  assert.equal(panel.buildCount, 50);
  assert.equal(panel.summary.brokerIntegrationAllowed, false);
  assert.equal(panel.summary.brokerContactAllowed, false);
  assert.equal(panel.summary.orderPlacementAllowed, false);
  assert.equal(panel.summary.accountMutationAllowed, false);
  assert.equal(panel.metrics.blockedLayerCount, 50);
  assert.equal(panel.metrics.passedLayerCount, 0);
  assert.equal(panel.badges.some((badge) => badge.label === '50 Builds' && badge.value === true), true);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
