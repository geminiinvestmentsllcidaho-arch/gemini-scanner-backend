import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_READINESS_REPORT_VERSION,
  buildPaperTradeReadinessReport,
  buildPaperTradeReadinessReportPanel
} from '../src/scanner/paper_trade_readiness_report.mjs';

test('paper trade readiness report stays broker-blocked by design', () => {
  const report = buildPaperTradeReadinessReport({
    intentLedgerPath: '/tmp/gemini_nonexistent_readiness_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_readiness_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_readiness_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_readiness_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_readiness_audit_test.jsonl'
  });

  assert.equal(report.ok, true);
  assert.equal(report.version, PAPER_TRADE_READINESS_REPORT_VERSION);
  assert.equal(report.monitorOnly, true);
  assert.equal(report.previewOnly, true);
  assert.equal(report.paperOnly, true);
  assert.equal(report.finalStatus, 'not_ready_broker_blocked');
  assert.equal(report.paperTradingLiveReady, false);
  assert.equal(report.brokerExecutionBlocked, true);
  assert.equal(report.approvalRequiredBeforeBrokerIntegration, true);
  assert.equal(report.gates.executionControlBuildCount, 20);
  assert.equal(report.gates.brokerAdapterEnabled, false);
  assert.equal(report.gates.brokerContactAllowed, false);
  assert.equal(report.gates.orderPlacementAllowed, false);
  assert.equal(report.gates.accountMutationAllowed, false);
  assert.equal(report.gates.safetyInvariantOk, true);
  assert.equal(report.safety.brokerContact, false);
  assert.equal(report.safety.orderPlacement, false);
  assert.equal(report.safety.accountMutation, false);
});

test('paper trade readiness report detects complete local lifecycle but still blocks broker execution', () => {
  const report = buildPaperTradeReadinessReport({
    controlInput: {
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
    intentLedgerPath: '/tmp/gemini_nonexistent_readiness_local_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_readiness_local_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_readiness_local_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_readiness_local_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_readiness_local_audit_test.jsonl'
  });

  assert.equal(report.paperTradingLiveReady, false);
  assert.equal(report.brokerExecutionBlocked, true);
  assert.equal(report.components.controlStack.executionAllowed, false);
  assert.equal(report.components.brokerGuard.executionAllowed, false);
  assert.equal(report.safety.brokerContact, false);
  assert.equal(report.safety.orderPlacement, false);
});

test('paper trade readiness report panel exposes operator dashboard card', () => {
  const panel = buildPaperTradeReadinessReportPanel({
    intentLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_intent_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_ticket_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_fill_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_position_test.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_readiness_panel_audit_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_readiness_report_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'not_ready_broker_blocked');
  assert.equal(panel.summary.paperTradingLiveReady, false);
  assert.equal(panel.summary.brokerExecutionBlocked, true);
  assert.equal(panel.gates.executionControlBuildCount, 20);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
