import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluatePaperTradeExecutionControlStack,
  readPaperTradeExecutionControlStackPanel
} from '../src/scanner/paper_trade_execution_control_stack.mjs';

test('paper execution control stack route payload stays blocked and safe', () => {
  const stack = evaluatePaperTradeExecutionControlStack();

  assert.equal(stack.ok, true);
  assert.equal(stack.version, 'paper_trade_execution_control_stack_v1');
  assert.equal(stack.buildCount, 20);
  assert.equal(stack.status, 'blocked');
  assert.equal(stack.executionAllowed, false);
  assert.equal(stack.brokerContactAllowed, false);
  assert.equal(stack.orderPlacementAllowed, false);
  assert.equal(stack.accountMutationAllowed, false);
  assert.equal(stack.safety.localJsonlOnly, true);
});

test('paper execution control stack panel route payload stays blocked and safe', () => {
  const panel = readPaperTradeExecutionControlStackPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_execution_control_stack_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.buildCount, 20);
  assert.equal(panel.status, 'blocked');
  assert.equal(panel.summary.executionAllowed, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
