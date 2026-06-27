import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaperTradePositionStatePreview,
  buildPaperTradePositionStatePreviewPanel
} from '../src/scanner/paper_trade_position_state_preview.mjs';

test('paper position state preview route payload stays local-only and safe', () => {
  const preview = buildPaperTradePositionStatePreview({
    ledgerPath: '/tmp/gemini_nonexistent_position_state_preview_route_test.jsonl'
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.version, 'paper_trade_position_state_preview_v1');
  assert.equal(preview.monitorOnly, true);
  assert.equal(preview.status, 'empty');
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
  assert.equal(preview.safety.localJsonlOnly, true);
});

test('paper position state preview panel route payload stays local-only and safe', () => {
  const panel = buildPaperTradePositionStatePreviewPanel({
    ledgerPath: '/tmp/gemini_nonexistent_position_state_preview_panel_route_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_position_state_preview_panel_v1');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});
