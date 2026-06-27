import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPaperTradeIntent } from '../src/scanner/paper_trade_intent_creation_store.mjs';
import {
  PAPER_TRADE_INTENT_CREATION_DASHBOARD_PANEL_VERSION,
  readPaperTradeIntentCreationDashboardPanel
} from '../src/scanner/paper_trade_intent_creation_dashboard_panel.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-intent-creation-panel-')), 'ledger.jsonl');
}

test('paper intent creation panel reports empty state as neutral monitor-only card', () => {
  const ledgerPath = tmpLedger();
  const panel = readPaperTradeIntentCreationDashboardPanel({ ledgerPath });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_TRADE_INTENT_CREATION_DASHBOARD_PANEL_VERSION);
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.severity, 'neutral');
  assert.equal(panel.recordCount, 0);
  assert.equal(panel.summary.latestIntentId, null);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});

test('paper intent creation panel exposes compact latest created intent summary', () => {
  const ledgerPath = tmpLedger();

  createPaperTradeIntent(
    {
      readinessGateStatus: 'passed',
      symbol: 'AAPL',
      action: 'buy',
      entryPrice: 123.45
    },
    {
      ledgerPath,
      now: new Date('2026-06-26T12:00:00.000Z'),
      source: 'unit_test'
    }
  );

  const panel = readPaperTradeIntentCreationDashboardPanel({ ledgerPath });

  assert.equal(panel.status, 'created');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.recordCount, 1);
  assert.equal(panel.summary.latestSymbol, 'AAPL');
  assert.equal(panel.summary.latestAction, 'buy');
  assert.equal(panel.summary.latestEntryPrice, 123.45);
  assert.equal(panel.metrics.latestSymbol, 'AAPL');
  assert.equal(panel.metrics.latestAction, 'buy');
  assert.equal(panel.metrics.latestEntryPrice, 123.45);
  assert.ok(panel.badges.some((badge) => badge.label === 'Broker Contact' && badge.value === false));
});
