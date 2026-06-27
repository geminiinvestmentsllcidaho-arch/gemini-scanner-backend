import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_INTENT_CREATION_RUNNER_PANEL_VERSION,
  readPaperTradeIntentCreationRunnerPanel
} from '../src/scanner/paper_trade_intent_creation_runner_panel.mjs';

test('paper intent creation runner panel stays preview-only and non-writing when blocked', () => {
  const panel = readPaperTradeIntentCreationRunnerPanel({
    plan: {
      readinessGateStatus: 'blocked'
    },
    now: new Date('2026-06-26T12:00:00.000Z')
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_TRADE_INTENT_CREATION_RUNNER_PANEL_VERSION);
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.mode, 'preview');
  assert.equal(panel.status, 'blocked');
  assert.equal(panel.severity, 'blocked');
  assert.equal(panel.intentCreated, false);
  assert.equal(panel.wroteRecord, false);
  assert.equal(panel.summary.intentCreated, false);
  assert.equal(panel.summary.wroteRecord, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});

test('paper intent creation runner panel shows would-create state without writing', () => {
  const panel = readPaperTradeIntentCreationRunnerPanel({
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 123.45
    },
    now: new Date('2026-06-26T12:00:00.000Z')
  });

  assert.equal(panel.status, 'created');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.intentWouldBeCreated, true);
  assert.equal(panel.intentCreated, false);
  assert.equal(panel.wroteRecord, false);
  assert.equal(panel.summary.symbol, 'AAPL');
  assert.equal(panel.summary.action, 'buy');
  assert.equal(panel.summary.entryPrice, 123.45);
  assert.ok(panel.badges.some((badge) => badge.label === 'Ledger Write' && badge.value === false));
});
