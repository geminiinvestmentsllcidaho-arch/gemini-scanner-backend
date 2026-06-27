import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaperTradeModuleCompletionReport,
  buildPaperTradeModuleCompletionReportPanel
} from '../src/scanner/paper_trade_module_completion_report.mjs';

test('paper trade module completion route payload verifies module and stays safe', () => {
  const report = buildPaperTradeModuleCompletionReport({
    intentLedgerPath: '/tmp/gemini_nonexistent_module_route_intent.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_module_route_ticket.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_module_route_fill.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_module_route_position.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_module_route_audit.jsonl'
  });

  assert.equal(report.ok, true);
  assert.equal(report.version, 'paper_trade_module_completion_report_v1');
  assert.equal(report.moduleComplete, true);
  assert.equal(report.moduleBuildCount, 70);
  assert.equal(report.brokerIntegrationAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.safety.localJsonlOnly, true);
});

test('paper trade module completion panel route payload verifies module and stays safe', () => {
  const panel = buildPaperTradeModuleCompletionReportPanel({
    intentLedgerPath: '/tmp/gemini_nonexistent_module_panel_route_intent.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_module_panel_route_ticket.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_module_panel_route_fill.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_module_panel_route_position.jsonl',
    lifecycleAuditLedgerPath: '/tmp/gemini_nonexistent_module_panel_route_audit.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_module_completion_report_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.summary.moduleComplete, true);
  assert.equal(panel.summary.moduleBuildCount, 70);
  assert.equal(panel.summary.brokerIntegrationAllowed, false);
  assert.equal(panel.summary.orderPlacementAllowed, false);
  assert.equal(panel.summary.accountMutationAllowed, false);
});
