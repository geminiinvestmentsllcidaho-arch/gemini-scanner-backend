import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_FILL_SIMULATION_STORE_VERSION,
  readPaperTradeFillSimulationRecords,
  readPaperTradeFillSimulationRecordsIfAvailable,
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


test("available fill reader distinguishes a missing ledger from an empty existing ledger", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-fill-availability-"));
  const ledgerPath = path.join(dir, "fills.jsonl");

  assert.equal(
    readPaperTradeFillSimulationRecordsIfAvailable(ledgerPath),
    null,
  );

  fs.writeFileSync(ledgerPath, "");
  assert.deepEqual(
    readPaperTradeFillSimulationRecordsIfAvailable(ledgerPath),
    [],
  );
});

test("available fill reader surfaces malformed complete JSONL records", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-fill-malformed-"));
  const ledgerPath = path.join(dir, "fills.jsonl");
  fs.writeFileSync(ledgerPath, '{"fillId":"ok"}\nnot-json\n');

  assert.throws(
    () => readPaperTradeFillSimulationRecordsIfAvailable(ledgerPath),
    SyntaxError,
  );
});


test("does not append a second fill for the same source ticket", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-fill-dedupe-"));
  const ledgerPath = path.join(dir, "fills.jsonl");
  const preview = readyFillPreview("SOFI");

  const first = storePaperTradeFillSimulation({
    ledgerPath,
    fillPreview: preview,
    now: new Date("2026-07-22T14:00:00.000Z"),
  });
  const second = storePaperTradeFillSimulation({
    ledgerPath,
    fillPreview: preview,
    now: new Date("2026-07-22T14:01:00.000Z"),
  });

  assert.equal(first.status, "stored");
  assert.equal(first.fillStored, true);
  assert.equal(first.wroteRecord, true);
  assert.equal(second.status, "duplicate");
  assert.equal(second.fillStored, false);
  assert.equal(second.wroteRecord, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.duplicateReason, "source_ticket_already_filled");
  assert.equal(second.recordCount, 1);
  assert.equal(second.record.fillId, first.record.fillId);
  assert.equal(readPaperTradeFillSimulationRecords(ledgerPath).length, 1);
});

test("does not append a second fill for the same source intent through a different ticket", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-fill-intent-dedupe-"));
  const ledgerPath = path.join(dir, "fills.jsonl");
  const firstPreview = readyFillPreview("SOFI");
  const secondPreview = {
    ...firstPreview,
    simulatedFill: {
      ...firstPreview.simulatedFill,
      sourceTicketId: "paper_ticket_sofi_replayed",
    },
  };

  const first = storePaperTradeFillSimulation({
    ledgerPath,
    fillPreview: firstPreview,
    now: new Date("2026-07-22T14:00:00.000Z"),
  });
  const second = storePaperTradeFillSimulation({
    ledgerPath,
    fillPreview: secondPreview,
    now: new Date("2026-07-22T14:01:00.000Z"),
  });

  assert.equal(first.status, "stored");
  assert.equal(first.fillStored, true);
  assert.equal(first.wroteRecord, true);
  assert.equal(second.status, "duplicate");
  assert.equal(second.fillStored, false);
  assert.equal(second.wroteRecord, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.duplicateReason, "source_intent_already_filled");
  assert.deepEqual(second.reasons, ["source_intent_already_filled"]);
  assert.equal(second.recordCount, 1);
  assert.equal(second.record.fillId, first.record.fillId);
  assert.equal(readPaperTradeFillSimulationRecords(ledgerPath).length, 1);
  assert.equal(second.safety.brokerContact, false);
  assert.equal(second.safety.orderPlacement, false);
  assert.equal(second.safety.accountMutation, false);
});
