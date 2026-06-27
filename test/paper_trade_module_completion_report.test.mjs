import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_MODULE_COMPLETION_REPORT_VERSION,
  buildPaperTradeModuleCompletionReport,
  buildPaperTradeModuleCompletionReportPanel
} from '../src/scanner/paper_trade_module_completion_report.mjs';

function emptyPaths(prefix) {
  return {
    intentLedgerPath: `/tmp/gemini_nonexistent_${prefix}_intent.jsonl`,
    ticketLedgerPath: `/tmp/gemini_nonexistent_${prefix}_ticket.jsonl`,
    fillLedgerPath: `/tmp/gemini_nonexistent_${prefix}_fill.jsonl`,
    positionLedgerPath: `/tmp/gemini_nonexistent_${prefix}_position.jsonl`,
    lifecycleAuditLedgerPath: `/tmp/gemini_nonexistent_${prefix}_audit.jsonl`
  };
}

test('paper trade module completion report verifies full module while keeping broker blocked', () => {
  const report = buildPaperTradeModuleCompletionReport(emptyPaths('module_completion'));

  assert.equal(report.ok, true);
  assert.equal(report.version, PAPER_TRADE_MODULE_COMPLETION_REPORT_VERSION);
  assert.equal(report.monitorOnly, true);
  assert.equal(report.previewOnly, true);
  assert.equal(report.paperOnly, true);
  assert.equal(report.moduleName, 'paper_trade_local_lifecycle_and_broker_preflight');
  assert.equal(report.moduleStatus, 'module_complete_broker_integration_blocked');
  assert.equal(report.moduleComplete, true);
  assert.equal(report.moduleBuildCount, 70);
  assert.equal(report.expectedModuleBuildCount, 70);
  assert.equal(report.buildCountOk, true);
  assert.equal(report.actualBuilds.executionControlBuilds, 20);
  assert.equal(report.actualBuilds.brokerPreflightBuilds, 50);
  assert.equal(report.brokerIntegrationAllowed, false);
  assert.equal(report.brokerAdapterEnabled, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.paperTradingLiveReady, false);
  assert.equal(report.finalGo, false);
  assert.equal(report.completionSummary.safetyInvariantOk, true);
  assert.equal(report.safety.brokerContact, false);
  assert.equal(report.safety.orderPlacement, false);
  assert.equal(report.safety.accountMutation, false);
});

test('paper trade module completion report panel exposes operator dashboard card', () => {
  const panel = buildPaperTradeModuleCompletionReportPanel(emptyPaths('module_completion_panel'));

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_module_completion_report_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'module_complete_broker_integration_blocked');
  assert.equal(panel.severity, 'warning');
  assert.equal(panel.summary.moduleComplete, true);
  assert.equal(panel.summary.moduleBuildCount, 70);
  assert.equal(panel.summary.expectedModuleBuildCount, 70);
  assert.equal(panel.summary.brokerIntegrationAllowed, false);
  assert.equal(panel.summary.paperTradingLiveReady, false);
  assert.equal(panel.summary.finalGo, false);
  assert.equal(panel.badges.some((badge) => badge.label === '70 Builds Verified' && badge.value === true), true);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});

test('paper trade module completion report stays blocked with approval-like input', () => {
  const report = buildPaperTradeModuleCompletionReport({
    ...emptyPaths('module_completion_approval_like'),
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
    }
  });

  assert.equal(report.moduleComplete, true);
  assert.equal(report.brokerIntegrationAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.paperTradingLiveReady, false);
  assert.equal(report.finalGo, false);
  assert.equal(report.components.executionControl.executionAllowed, false);
  assert.equal(report.components.brokerGuard.executionAllowed, false);
});
