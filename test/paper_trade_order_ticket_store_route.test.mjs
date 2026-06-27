import test from 'node:test';
import assert from 'node:assert/strict';

import { readPaperTradeOrderTicketStoreDashboard } from '../src/scanner/paper_trade_order_ticket_store.mjs';
import { readPaperTradeOrderTicketStorePanel } from '../src/scanner/paper_trade_order_ticket_store_panel.mjs';

test('paper order ticket store dashboard route payload stays local-only and safe', () => {
  const dashboard = readPaperTradeOrderTicketStoreDashboard({
    ledgerPath: '/tmp/gemini_nonexistent_order_ticket_store_route_test.jsonl'
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, 'paper_trade_order_ticket_store_v1');
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.latestStatus, 'empty');
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.orderPlacement, false);
  assert.equal(dashboard.safety.accountMutation, false);
  assert.equal(dashboard.safety.localJsonlOnly, true);
});

test('paper order ticket store panel route payload stays local-only and safe', () => {
  const panel = readPaperTradeOrderTicketStorePanel({
    ledgerPath: '/tmp/gemini_nonexistent_order_ticket_store_panel_route_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_order_ticket_store_panel_v1');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});
