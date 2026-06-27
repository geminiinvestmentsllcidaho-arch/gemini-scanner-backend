import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_FILL_SIMULATION_STORE_VERSION,
  readPaperTradeFillSimulationRecords,
  readPaperTradeFillSimulationStoreDashboard,
  storePaperTradeFillSimulation
} from '../src/scanner/paper_trade_fill_simulation_store.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-fill-simulation-store-')), 'ledger.jsonl');
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

test('paper fill simulation store blocks and does not write when fill preview is not ready', () => {
  const ledgerPath = tmpLedger();

  const result = storePaperTradeFillSimulation({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPreview: {
      version: 'paper_trade_fill_simulation_preview_v1',
      fillReady: false,
      reasonCount: 1,
      reasons: ['paper_order_ticket_missing'],
      simulatedFill: null
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADE_FILL_SIMULATION_STORE_VERSION);
  assert.equal(result.status, 'blocked');
  assert.equal(result.fillStored, false);
  assert.equal(result.wroteRecord, false);
  assert.deepEqual(result.reasons, ['paper_order_ticket_missing']);
  assert.equal(fs.existsSync(ledgerPath), false);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
});

test('paper fill simulation store writes local JSONL only when fill preview is ready', () => {
  const ledgerPath = tmpLedger();

  const result = storePaperTradeFillSimulation({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPreview: readyFillPreview()
  });

  assert.equal(result.status, 'stored');
  assert.equal(result.fillReady, true);
  assert.equal(result.fillStored, true);
  assert.equal(result.wroteRecord, true);
  assert.equal(result.recordCount, 1);
  assert.equal(result.record.symbol, 'AAPL');
  assert.equal(result.record.side, 'buy');
  assert.equal(result.record.qty, 10);
  assert.equal(result.record.fillPrice, 123.45);
  assert.equal(result.record.filledNotional, 1234.5);
  assert.equal(result.record.fillStatus, 'filled');
  assert.equal(result.record.executionAdapter, 'none');
  assert.equal(result.record.broker, 'none');
  assert.equal(result.record.brokerContact, false);
  assert.equal(result.record.orderPlacement, false);
  assert.equal(result.record.accountMutation, false);
  assert.equal(result.record.executionRequested, false);

  const records = readPaperTradeFillSimulationRecords(ledgerPath);
  assert.equal(records.length, 1);
  assert.equal(records[0].symbol, 'AAPL');
});

test('paper fill simulation store dashboard exposes latest local fill safely', () => {
  const ledgerPath = tmpLedger();

  storePaperTradeFillSimulation({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPreview: readyFillPreview('MSFT', 'sell', 20, 50)
  });

  const dashboard = readPaperTradeFillSimulationStoreDashboard({ ledgerPath });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, PAPER_TRADE_FILL_SIMULATION_STORE_VERSION);
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.previewOnly, true);
  assert.equal(dashboard.paperOnly, true);
  assert.equal(dashboard.recordCount, 1);
  assert.equal(dashboard.hasRecords, true);
  assert.equal(dashboard.latestStatus, 'stored');
  assert.equal(dashboard.latestRecord.symbol, 'MSFT');
  assert.equal(dashboard.latestRecord.side, 'sell');
  assert.equal(dashboard.latestRecord.qty, 20);
  assert.equal(dashboard.latestRecord.fillPrice, 50);
  assert.equal(dashboard.latestRecord.filledNotional, 1000);
  assert.equal(dashboard.latestRecord.brokerContact, false);
  assert.equal(dashboard.latestRecord.orderPlacement, false);
  assert.equal(dashboard.latestRecord.accountMutation, false);
});
