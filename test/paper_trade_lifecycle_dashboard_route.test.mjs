import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readPaperTradeLifecycleDashboard,
  readPaperTradeLifecycleDashboardPanel
} from '../src/scanner/paper_trade_lifecycle_dashboard.mjs';

test('paper lifecycle dashboard route payload stays local-only and safe', () => {
  const dashboard = readPaperTradeLifecycleDashboard({
    intentLedgerPath: '/tmp/gemini_nonexistent_lifecycle_intent_route_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_lifecycle_ticket_route_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_lifecycle_fill_route_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_lifecycle_position_route_test.jsonl'
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, 'paper_trade_lifecycle_dashboard_v1');
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.lifecycleStatus, 'empty');
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.orderPlacement, false);
  assert.equal(dashboard.safety.accountMutation, false);
  assert.equal(dashboard.safety.localJsonlOnly, true);
});

test('paper lifecycle dashboard panel route payload stays local-only and safe', () => {
  const panel = readPaperTradeLifecycleDashboardPanel({
    intentLedgerPath: '/tmp/gemini_nonexistent_lifecycle_panel_intent_route_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_lifecycle_panel_ticket_route_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_lifecycle_panel_fill_route_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_lifecycle_panel_position_route_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_lifecycle_dashboard_panel_v1');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});
