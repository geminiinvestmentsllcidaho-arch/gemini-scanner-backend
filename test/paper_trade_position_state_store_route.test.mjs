import test from 'node:test';
import assert from 'node:assert/strict';

import { readPaperTradePositionStateStoreDashboard } from '../src/scanner/paper_trade_position_state_store.mjs';
import { readPaperTradePositionStateStorePanel } from '../src/scanner/paper_trade_position_state_store_panel.mjs';

test('paper position state store dashboard route payload stays local-only and safe', () => {
  const dashboard = readPaperTradePositionStateStoreDashboard({
    storeLedgerPath: '/tmp/gemini_nonexistent_position_state_store_route_test.jsonl'
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, 'paper_trade_position_state_store_v1');
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.latestStatus, 'empty');
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.orderPlacement, false);
  assert.equal(dashboard.safety.accountMutation, false);
  assert.equal(dashboard.safety.localJsonlOnly, true);
});

test('paper position state store panel route payload stays local-only and safe', () => {
  const panel = readPaperTradePositionStateStorePanel({
    storeLedgerPath: '/tmp/gemini_nonexistent_position_state_store_panel_route_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_position_state_store_panel_v1');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});
