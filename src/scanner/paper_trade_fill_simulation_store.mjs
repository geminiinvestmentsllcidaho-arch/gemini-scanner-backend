import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildPaperTradeFillSimulationPreview } from './paper_trade_fill_simulation_preview.mjs';

export const PAPER_TRADE_FILL_SIMULATION_STORE_VERSION =
  'paper_trade_fill_simulation_store_v1';

export const DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH =
  process.env.PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH ||
  path.join(process.cwd(), 'runs', 'paper_trade_fill_simulation_store.jsonl');

export function readPaperTradeFillSimulationRecords(
  ledgerPath = DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH
) {
  if (!fs.existsSync(ledgerPath)) return [];

  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function readPaperTradeFillSimulationRecordsIfAvailable(
  ledgerPath = DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH
) {
  if (!fs.existsSync(ledgerPath)) return null;
  return readPaperTradeFillSimulationRecords(ledgerPath);
}

function createFillRecord(fillPreview, now) {
  const fill = fillPreview.simulatedFill;
  const ts = now.toISOString();

  const fillId = `paper_fill_${crypto
    .createHash('sha256')
    .update(`${fill.sourceTicketId}:${fill.symbol}:${fill.side}:${fill.qty}:${fill.fillPrice}:${ts}`)
    .digest('hex')
    .slice(0, 16)}`;

  return {
    version: PAPER_TRADE_FILL_SIMULATION_STORE_VERSION,
    fillId,
    createdAt: ts,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    sourceTicketId: fill.sourceTicketId,
    sourceIntentId: fill.sourceIntentId || null,
    symbol: fill.symbol,
    side: fill.side,
    qty: fill.qty,
    fillPrice: fill.fillPrice,
    filledNotional: fill.filledNotional,
    fillStatus: fill.fillStatus,
    fillType: fill.fillType,
    executionAdapter: 'none',
    broker: 'none',
    brokerContact: false,
    orderPlacement: false,
    accountMutation: false,
    executionRequested: false
  };
}

export function storePaperTradeFillSimulation(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH;

  const now = options.now instanceof Date ? options.now : new Date();
  const fillPreview =
    options.fillPreview || buildPaperTradeFillSimulationPreview(options);

  if (!fillPreview.fillReady) {
    return {
      ok: true,
      version: PAPER_TRADE_FILL_SIMULATION_STORE_VERSION,
      monitorOnly: true,
      previewOnly: true,
      paperOnly: true,
      status: 'blocked',
      fillReady: false,
      fillStored: false,
      wroteRecord: false,
      reasonCount: fillPreview.reasonCount,
      reasons: fillPreview.reasons,
      ledgerPath,
      recordCount: readPaperTradeFillSimulationRecords(ledgerPath).length,
      fillPreview,
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

  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });

  const record = createFillRecord(fillPreview, now);
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);

  return {
    ok: true,
    version: PAPER_TRADE_FILL_SIMULATION_STORE_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: 'stored',
    fillReady: true,
    fillStored: true,
    wroteRecord: true,
    reasonCount: 0,
    reasons: [],
    ledgerPath,
    recordCount: readPaperTradeFillSimulationRecords(ledgerPath).length,
    fillPreview,
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

export function readPaperTradeFillSimulationStoreDashboard(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH;

  const records = readPaperTradeFillSimulationRecords(ledgerPath);
  const latestRecord = records.length ? records[records.length - 1] : null;

  return {
    ok: true,
    version: PAPER_TRADE_FILL_SIMULATION_STORE_VERSION,
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
