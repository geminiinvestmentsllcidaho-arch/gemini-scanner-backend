import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaperTradeOperatorGoNoGo,
  buildPaperTradeOperatorGoNoGoPanel
} from '../src/scanner/paper_trade_operator_go_no_go.mjs';

test('paper operator go no-go route payload stays final no-go and safe', () => {
  const decision = buildPaperTradeOperatorGoNoGo({
    intentLedgerPath: '/tmp/gemini_nonexistent_go_no_go_route_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_go_no_go_route_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_go_no_go_route_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_go_no_go_route_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_go_no_go_route_audit_test.jsonl'
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.version, 'paper_trade_operator_go_no_go_v1');
  assert.equal(decision.finalGo, false);
  assert.equal(decision.brokerIntegrationGo, false);
  assert.equal(decision.paperTradingLiveGo, false);
  assert.equal(decision.safety.brokerContact, false);
  assert.equal(decision.safety.orderPlacement, false);
  assert.equal(decision.safety.accountMutation, false);
});

test('paper operator go no-go panel route payload stays final no-go and safe', () => {
  const panel = buildPaperTradeOperatorGoNoGoPanel({
    intentLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_route_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_route_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_route_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_route_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_go_no_go_panel_route_audit_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_operator_go_no_go_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.summary.finalGo, false);
  assert.equal(panel.summary.brokerIntegrationGo, false);
  assert.equal(panel.summary.paperTradingLiveGo, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
});
