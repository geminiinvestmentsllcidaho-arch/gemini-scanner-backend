import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_OPERATOR_GO_NO_GO_VERSION,
  buildPaperTradeOperatorGoNoGo,
  buildPaperTradeOperatorGoNoGoPanel
} from '../src/scanner/paper_trade_operator_go_no_go.mjs';

test('paper operator go no-go stays final no-go with empty local lifecycle', () => {
  const decision = buildPaperTradeOperatorGoNoGo({
    intentLedgerPath: '/tmp/gemini_nonexistent_go_no_go_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_go_no_go_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_go_no_go_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_go_no_go_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_go_no_go_audit_test.jsonl'
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.version, PAPER_TRADE_OPERATOR_GO_NO_GO_VERSION);
  assert.equal(decision.operatorStatus, 'no_go');
  assert.equal(decision.localSimulationGo, false);
  assert.equal(decision.brokerIntegrationGo, false);
  assert.equal(decision.paperTradingLiveGo, false);
  assert.equal(decision.finalGo, false);
  assert.ok(decision.reasons.includes('local_lifecycle_not_complete'));
  assert.ok(decision.reasons.includes('broker_adapter_approval_required'));
  assert.equal(decision.gates.brokerExecutionBlocked, true);
  assert.equal(decision.gates.brokerAdapterEnabled, false);
  assert.equal(decision.gates.brokerContactAllowed, false);
  assert.equal(decision.gates.orderPlacementAllowed, false);
  assert.equal(decision.gates.accountMutationAllowed, false);
  assert.equal(decision.safety.brokerContact, false);
  assert.equal(decision.safety.orderPlacement, false);
  assert.equal(decision.safety.accountMutation, false);
});

test('paper operator go no-go panel exposes blocked operator card', () => {
  const panel = buildPaperTradeOperatorGoNoGoPanel({
    intentLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_audit_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_operator_go_no_go_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'no_go');
  assert.equal(panel.severity, 'blocked');
  assert.equal(panel.summary.localSimulationGo, false);
  assert.equal(panel.summary.brokerIntegrationGo, false);
  assert.equal(panel.summary.paperTradingLiveGo, false);
  assert.equal(panel.summary.finalGo, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
