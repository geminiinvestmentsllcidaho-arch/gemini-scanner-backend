import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { storePaperTradeFillSimulation } from '../src/scanner/paper_trade_fill_simulation_store.mjs';
import {
  PAPER_TRADE_FILL_SIMULATION_STORE_PANEL_VERSION,
  readPaperTradeFillSimulationStorePanel
} from '../src/scanner/paper_trade_fill_simulation_store_panel.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-fill-simulation-store-panel-')), 'ledger.jsonl');
}

function readyFillPreview(symbol = 'AAPL', side = 'buy', qty = 10, fillPrice = 123.45) {
  return {
    version: 'paper_trade_fill_simulation_preview_v1',
    fillReady: true,
    reasonCount: 0,
    reasons: [],
    sourceTicketId: `paper_ticket_${symbol.toLowerCase()}`,
    sourceIntentId: `paper_intent_${symbol.toLowerCase()}`,
    simulatedFill: {
      sourceTicketId: `paper_ticket_${symbol.toLowerCase()}`,
      sourceIntentId: `paper_intent_${symbol.toLowerCase()}`,
      symbol,
      side,
      qty,
      fillPrice,
      filledNotional: Number((qty * fillPrice).toFixed(2)),
      fillStatus: 'filled',
      fillType: 'local_simulated_market_fill',
      broker: 'none',
      executionAdapter: 'none',
      previewOnly: true,
      paperOnly: true
    }
  };
}

test('paper fill simulation store panel reports empty local store safely', () => {
  const ledgerPath = tmpLedger();
  const panel = readPaperTradeFillSimulationStorePanel({ ledgerPath });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_TRADE_FILL_SIMULATION_STORE_PANEL_VERSION);
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.previewOnly, true);
  assert.equal(panel.paperOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.severity, 'neutral');
  assert.equal(panel.recordCount, 0);
  assert.equal(panel.summary.latestFillId, null);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});

test('paper fill simulation store panel exposes latest stored fill', () => {
  const ledgerPath = tmpLedger();

  storePaperTradeFillSimulation({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPreview: readyFillPreview('AAPL', 'buy', 10, 100)
  });

  storePaperTradeFillSimulation({
    ledgerPath,
    now: new Date('2026-06-26T12:01:00.000Z'),
    fillPreview: readyFillPreview('MSFT', 'sell', 20, 50)
  });

  const panel = readPaperTradeFillSimulationStorePanel({ ledgerPath });

  assert.equal(panel.status, 'stored');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.recordCount, 2);
  assert.equal(panel.summary.latestSymbol, 'MSFT');
  assert.equal(panel.summary.latestSide, 'sell');
  assert.equal(panel.summary.latestQty, 20);
  assert.equal(panel.summary.latestFillPrice, 50);
  assert.equal(panel.summary.latestFilledNotional, 1000);
  assert.equal(panel.summary.latestFillStatus, 'filled');
  assert.equal(panel.summary.latestFillType, 'local_simulated_market_fill');
  assert.equal(panel.summary.executionAdapter, 'none');
  assert.equal(panel.summary.broker, 'none');
  assert.equal(panel.metrics.latestSymbol, 'MSFT');
  assert.equal(panel.metrics.latestSide, 'sell');
  assert.equal(panel.metrics.latestQty, 20);
  assert.equal(panel.metrics.latestFilledNotional, 1000);
  assert.ok(panel.badges.some((badge) => badge.label === 'Order Placement' && badge.value === false));
});
