import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaperTradeReadinessReport,
  buildPaperTradeReadinessReportPanel
} from '../src/scanner/paper_trade_readiness_report.mjs';

test('paper trade readiness report route payload stays broker-blocked and safe', () => {
  const report = buildPaperTradeReadinessReport({
    intentLedgerPath: '/tmp/gemini_nonexistent_readiness_route_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_readiness_route_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_readiness_route_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_readiness_route_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_readiness_route_audit_test.jsonl'
  });

  assert.equal(report.ok, true);
  assert.equal(report.version, 'paper_trade_readiness_report_v1');
  assert.equal(report.paperTradingLiveReady, false);
  assert.equal(report.brokerExecutionBlocked, true);
  assert.equal(report.gates.brokerAdapterEnabled, false);
  assert.equal(report.gates.brokerContactAllowed, false);
  assert.equal(report.gates.orderPlacementAllowed, false);
  assert.equal(report.gates.accountMutationAllowed, false);
  assert.equal(report.safety.localJsonlOnly, true);
});

test('paper trade readiness report panel route payload stays broker-blocked and safe', () => {
  const panel = buildPaperTradeReadinessReportPanel({
    intentLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_route_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_route_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_route_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_route_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_route_audit_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_readiness_report_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.summary.paperTradingLiveReady, false);
  assert.equal(panel.summary.brokerExecutionBlocked, true);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
