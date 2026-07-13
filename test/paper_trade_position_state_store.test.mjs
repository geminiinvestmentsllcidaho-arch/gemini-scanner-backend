import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_POSITION_STATE_STORE_VERSION,
  readPaperTradePositionStateRecords,
  readPaperTradePositionStateStoreDashboard,
  storePaperTradePositionState
} from '../src/scanner/paper_trade_position_state_store.mjs';
import {
  PAPER_TRADE_POSITION_STATE_STORE_PANEL_VERSION,
  readPaperTradePositionStateStorePanel
} from '../src/scanner/paper_trade_position_state_store_panel.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-position-state-store-')), 'ledger.jsonl');
}

function positionPreview() {
  return {
    version: 'paper_trade_position_state_preview_v1',
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: 'computed',
    sourceLedgerPath: '/tmp/source-fills.jsonl',
    sourceRecordCount: 2,
    ignoredRecordCount: 0,
    positionCount: 1,
    openPositionCount: 1,
    closedPositionCount: 0,
    totalCostBasis: 750,
    totalRealizedPnl: 50,
    positions: [
      {
        symbol: 'MSFT',
        qty: 15,
        avgEntryPrice: 50,
        costBasis: 750,
        realizedPnl: 50,
        lastFillPrice: 60,
        lastFillId: 'fill_2',
        lastUpdatedAt: '2026-06-26T12:01:00.000Z',
        fillCount: 2
      }
    ],
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
      localJsonlOnly: true
    }
  };
}

test('paper position state store writes local snapshot JSONL only', () => {
  const storeLedgerPath = tmpLedger();

  const result = storePaperTradePositionState({
    storeLedgerPath,
    now: new Date('2026-06-26T12:02:00.000Z'),
    positionPreview: positionPreview()
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADE_POSITION_STATE_STORE_VERSION);
  assert.equal(result.status, 'stored');
  assert.equal(result.snapshotStored, true);
  assert.equal(result.wroteRecord, true);
  assert.equal(result.recordCount, 1);
  assert.equal(result.record.status, 'computed');
  assert.equal(result.record.positionCount, 1);
  assert.equal(result.record.openPositionCount, 1);
  assert.equal(result.record.totalCostBasis, 750);
  assert.equal(result.record.totalRealizedPnl, 50);
  assert.equal(result.record.positions[0].symbol, 'MSFT');
  assert.equal(result.record.brokerContact, false);
  assert.equal(result.record.orderPlacement, false);
  assert.equal(result.record.accountMutation, false);
  assert.equal(result.record.executionRequested, false);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);

  const records = readPaperTradePositionStateRecords(storeLedgerPath);
  assert.equal(records.length, 1);
  assert.equal(records[0].snapshotId, result.record.snapshotId);
});

test('paper position state store dashboard exposes latest snapshot safely', () => {
  const storeLedgerPath = tmpLedger();

  const result = storePaperTradePositionState({
    storeLedgerPath,
    now: new Date('2026-06-26T12:02:00.000Z'),
    positionPreview: positionPreview()
  });

  const dashboard = readPaperTradePositionStateStoreDashboard({
    storeLedgerPath
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, PAPER_TRADE_POSITION_STATE_STORE_VERSION);
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.recordCount, 1);
  assert.equal(dashboard.hasRecords, true);
  assert.equal(dashboard.latestStatus, 'stored');
  assert.equal(dashboard.latestRecord.positionCount, 1);
  assert.equal(dashboard.latestRecord.totalRealizedPnl, 50);
  assert.equal(dashboard.records.length, 1);
  assert.equal(dashboard.records[0].snapshotId, result.record.snapshotId);
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.orderPlacement, false);
  assert.equal(dashboard.safety.accountMutation, false);
});

test('paper position state store panel exposes operator dashboard card', () => {
  const storeLedgerPath = tmpLedger();

  storePaperTradePositionState({
    storeLedgerPath,
    now: new Date('2026-06-26T12:02:00.000Z'),
    positionPreview: positionPreview()
  });

  const panel = readPaperTradePositionStateStorePanel({ storeLedgerPath });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_TRADE_POSITION_STATE_STORE_PANEL_VERSION);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'stored');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.recordCount, 1);
  assert.equal(panel.summary.latestPositionCount, 1);
  assert.equal(panel.summary.latestOpenPositionCount, 1);
  assert.equal(panel.summary.latestTotalCostBasis, 750);
  assert.equal(panel.summary.latestTotalRealizedPnl, 50);
  assert.equal(panel.metrics.latestTotalRealizedPnl, 50);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});


test('skips duplicate paper position snapshots when state is unchanged', () => {
  const storeLedgerPath = tmpLedger();
  const preview = positionPreview();

  const first = storePaperTradePositionState({
    storeLedgerPath,
    now: new Date('2026-06-26T12:02:00.000Z'),
    positionPreview: preview
  });
  const second = storePaperTradePositionState({
    storeLedgerPath,
    now: new Date('2026-06-26T12:03:00.000Z'),
    positionPreview: preview
  });

  assert.equal(first.snapshotStored, true);
  assert.equal(second.status, 'unchanged');
  assert.equal(second.snapshotStored, false);
  assert.equal(second.wroteRecord, false);
  assert.equal(second.unchanged, true);
  assert.equal(second.recordCount, 1);
  assert.equal(readPaperTradePositionStateRecords(storeLedgerPath).length, 1);
});
