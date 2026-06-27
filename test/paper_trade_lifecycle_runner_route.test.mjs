import test from 'node:test';
import assert from 'node:assert/strict';

import {
  previewPaperTradeLifecycleRun,
  readPaperTradeLifecycleRunnerPanel
} from '../src/scanner/paper_trade_lifecycle_runner.mjs';

test('paper lifecycle runner route payload stays preview-only and safe', () => {
  const preview = previewPaperTradeLifecycleRun({
    intentLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_intent_route_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_ticket_route_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_fill_route_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_position_route_test.jsonl'
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.version, 'paper_trade_lifecycle_runner_v1');
  assert.equal(preview.mode, 'preview');
  assert.equal(preview.wroteAnyRecord, false);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
  assert.equal(preview.safety.localJsonlOnly, true);
});

test('paper lifecycle runner panel route payload stays preview-only and safe', () => {
  const panel = readPaperTradeLifecycleRunnerPanel({
    intentLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_panel_intent_route_test.jsonl',
    ticketLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_panel_ticket_route_test.jsonl',
    fillLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_panel_fill_route_test.jsonl',
    positionLedgerPath: '/tmp/gemini_nonexistent_lifecycle_runner_panel_position_route_test.jsonl'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_lifecycle_runner_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.summary.wroteAnyRecord, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});
