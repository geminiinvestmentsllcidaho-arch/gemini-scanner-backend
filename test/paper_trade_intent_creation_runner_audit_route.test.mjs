import test from 'node:test';
import assert from 'node:assert/strict';

import { readPaperTradeIntentCreationRunnerAuditDashboard } from '../src/scanner/paper_trade_intent_creation_runner_audit.mjs';
import { readPaperTradeIntentCreationRunnerAuditPanel } from '../src/scanner/paper_trade_intent_creation_runner_audit_panel.mjs';

test('paper intent creation runner audit dashboard route payload stays monitor-only', () => {
  const dashboard = readPaperTradeIntentCreationRunnerAuditDashboard({
    auditLedgerPath: '/tmp/gemini_nonexistent_creation_runner_audit_route_test.jsonl'
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, 'paper_trade_intent_creation_runner_audit_v1');
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.latestStatus, 'empty');
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.orderPlacement, false);
  assert.equal(dashboard.safety.accountMutation, false);
  assert.equal(dashboard.safety.localJsonlOnly, true);
});

test('paper intent creation runner audit panel route payload stays monitor-only', () => {
  const panel = readPaperTradeIntentCreationRunnerAuditPanel({
    auditLedgerPath: '/tmp/gemini_nonexistent_creation_runner_audit_panel_route_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_intent_creation_runner_audit_panel_v1');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});
