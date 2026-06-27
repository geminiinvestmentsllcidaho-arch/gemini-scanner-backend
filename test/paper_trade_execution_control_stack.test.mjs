import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_EXECUTION_CONTROL_STACK_LAYER_IDS,
  PAPER_TRADE_EXECUTION_CONTROL_STACK_VERSION,
  evaluatePaperTradeExecutionControlStack,
  readPaperTradeExecutionControlStackPanel
} from '../src/scanner/paper_trade_execution_control_stack.mjs';

test('paper execution control stack exposes exactly 20 safety builds', () => {
  const stack = evaluatePaperTradeExecutionControlStack();

  assert.equal(stack.ok, true);
  assert.equal(stack.version, PAPER_TRADE_EXECUTION_CONTROL_STACK_VERSION);
  assert.equal(stack.buildCount, 20);
  assert.equal(stack.expectedBuildCount, 20);
  assert.equal(stack.layers.length, 20);
  assert.deepEqual(stack.layers.map((layer) => layer.id), PAPER_TRADE_EXECUTION_CONTROL_STACK_LAYER_IDS);
  assert.equal(stack.status, 'blocked');
  assert.equal(stack.executionAllowed, false);
  assert.equal(stack.brokerAdapterEnabled, false);
  assert.equal(stack.brokerContactAllowed, false);
  assert.equal(stack.orderPlacementAllowed, false);
  assert.equal(stack.accountMutationAllowed, false);
  assert.equal(stack.safety.brokerContact, false);
  assert.equal(stack.safety.orderPlacement, false);
  assert.equal(stack.safety.accountMutation, false);
});

test('paper execution control stack still blocks even when ticket and approvals are present', () => {
  const stack = evaluatePaperTradeExecutionControlStack(
    {
      operatorBrokerApproval: true,
      paperExecutionEnabled: true,
      requiredAuditComplete: true,
      marketSession: 'open',
      orderTicket: {
        symbol: 'AAPL',
        side: 'buy',
        qty: '10',
        type: 'market',
        time_in_force: 'day',
        entryReferencePrice: 100,
        sourceIntentId: 'paper_intent_test',
        ticketId: 'paper_ticket_test'
      }
    },
    {
      maxQty: 100,
      maxNotional: 1000,
      dailyTradeLimit: 5,
      maxExposurePct: 0.1
    }
  );

  assert.equal(stack.buildCount, 20);
  assert.equal(stack.executionAllowed, false);
  assert.equal(stack.brokerAdapterEnabled, false);
  assert.equal(stack.blockedLayers.some((layer) => layer.id === 'broker_adapter_guard'), true);
  assert.equal(stack.layers.find((layer) => layer.id === 'operator_broker_approval_gate').status, 'passed');
  assert.equal(stack.layers.find((layer) => layer.id === 'order_ticket_schema_gate').status, 'passed');
  assert.equal(stack.layers.find((layer) => layer.id === 'broker_adapter_guard').status, 'blocked');
  assert.equal(stack.safety.brokerContact, false);
  assert.equal(stack.safety.orderPlacement, false);
  assert.equal(stack.safety.accountMutation, false);
});

test('paper execution control stack panel exposes operator dashboard card', () => {
  const panel = readPaperTradeExecutionControlStackPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_execution_control_stack_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'blocked');
  assert.equal(panel.severity, 'blocked');
  assert.equal(panel.buildCount, 20);
  assert.equal(panel.summary.executionAllowed, false);
  assert.equal(panel.summary.brokerContactAllowed, false);
  assert.equal(panel.summary.orderPlacementAllowed, false);
  assert.equal(panel.summary.accountMutationAllowed, false);
  assert.equal(panel.badges.some((badge) => badge.label === '20 Builds' && badge.value === true), true);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
