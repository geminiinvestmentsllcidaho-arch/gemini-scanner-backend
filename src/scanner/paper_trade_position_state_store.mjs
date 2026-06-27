import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildPaperTradePositionStatePreview } from './paper_trade_position_state_preview.mjs';

export const PAPER_TRADE_POSITION_STATE_STORE_VERSION =
  'paper_trade_position_state_store_v1';

export const DEFAULT_PAPER_TRADE_POSITION_STATE_LEDGER_PATH =
  process.env.PAPER_TRADE_POSITION_STATE_LEDGER_PATH ||
  path.join(process.cwd(), 'runs', 'paper_trade_position_state_store.jsonl');

export function readPaperTradePositionStateRecords(
  ledgerPath = DEFAULT_PAPER_TRADE_POSITION_STATE_LEDGER_PATH
) {
  if (!fs.existsSync(ledgerPath)) return [];

  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function createSnapshotRecord(positionPreview, now) {
  const ts = now.toISOString();

  const snapshotId = `paper_position_snapshot_${crypto
    .createHash('sha256')
    .update(`${positionPreview.sourceRecordCount}:${positionPreview.positionCount}:${positionPreview.totalCostBasis}:${positionPreview.totalRealizedPnl}:${ts}`)
    .digest('hex')
    .slice(0, 16)}`;

  return {
    version: PAPER_TRADE_POSITION_STATE_STORE_VERSION,
    snapshotId,
    createdAt: ts,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: positionPreview.status,
    sourceLedgerPath: positionPreview.sourceLedgerPath,
    sourceRecordCount: positionPreview.sourceRecordCount,
    ignoredRecordCount: positionPreview.ignoredRecordCount,
    positionCount: positionPreview.positionCount,
    openPositionCount: positionPreview.openPositionCount,
    closedPositionCount: positionPreview.closedPositionCount,
    totalCostBasis: positionPreview.totalCostBasis,
    totalRealizedPnl: positionPreview.totalRealizedPnl,
    positions: positionPreview.positions,
    brokerContact: false,
    orderPlacement: false,
    accountMutation: false,
    executionRequested: false
  };
}

export function storePaperTradePositionState(options = {}) {
  const ledgerPath =
    options.storeLedgerPath ||
    options.positionLedgerPath ||
    DEFAULT_PAPER_TRADE_POSITION_STATE_LEDGER_PATH;

  const now = options.now instanceof Date ? options.now : new Date();
  const positionPreview =
    options.positionPreview ||
    buildPaperTradePositionStatePreview({
      ...options,
      ledgerPath: options.fillLedgerPath || options.sourceLedgerPath || options.ledgerPath
    });

  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });

  const record = createSnapshotRecord(positionPreview, now);
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);

  return {
    ok: true,
    version: PAPER_TRADE_POSITION_STATE_STORE_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: 'stored',
    snapshotStored: true,
    wroteRecord: true,
    ledgerPath,
    recordCount: readPaperTradePositionStateRecords(ledgerPath).length,
    positionPreview,
    record,
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

export function readPaperTradePositionStateStoreDashboard(options = {}) {
  const ledgerPath =
    options.storeLedgerPath ||
    options.positionLedgerPath ||
    options.ledgerPath ||
    DEFAULT_PAPER_TRADE_POSITION_STATE_LEDGER_PATH;

  const records = readPaperTradePositionStateRecords(ledgerPath);
  const latestRecord = records.length ? records[records.length - 1] : null;

  return {
    ok: true,
    version: PAPER_TRADE_POSITION_STATE_STORE_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    ledgerPath,
    recordCount: records.length,
    hasRecords: records.length > 0,
    latestStatus: latestRecord ? 'stored' : 'empty',
    latestRecord,
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
