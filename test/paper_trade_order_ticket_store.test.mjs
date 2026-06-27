import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_ORDER_TICKET_STORE_VERSION,
  readPaperTradeOrderTicketRecords,
  readPaperTradeOrderTicketStoreDashboard,
  storePaperTradeOrderTicket
} from '../src/scanner/paper_trade_order_ticket_store.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-order-ticket-store-')), 'ledger.jsonl');
}

function readyTicketPreview() {
  return {
    version: 'paper_trade_order_ticket_preview_v1',
    ticketReady: true,
    reasonCount: 0,
    reasons: [],
    sourceIntentId: 'paper_intent_test',
    orderTicket: {
      symbol: 'AAPL',
      side: 'buy',
      type: 'market',
      qty: '10',
      time_in_force: 'day',
      client_order_id: null,
      extended_hours: false,
      order_class: 'simple',
      sourceIntentId: 'paper_intent_test',
      previewOnly: true,
      paperOnly: true,
      executionAdapter: 'none',
      broker: 'none'
    }
  };
}

test('paper order ticket store blocks and does not write when ticket preview is not ready', () => {
  const ledgerPath = tmpLedger();

  const result = storePaperTradeOrderTicket({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    ticketPreview: {
      version: 'paper_trade_order_ticket_preview_v1',
      ticketReady: false,
      reasonCount: 2,
      reasons: ['paper_intent_missing', 'paper_trade_sizing_not_ready'],
      orderTicket: null
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADE_ORDER_TICKET_STORE_VERSION);
  assert.equal(result.status, 'blocked');
  assert.equal(result.ticketStored, false);
  assert.equal(result.wroteRecord, false);
  assert.deepEqual(result.reasons, ['paper_intent_missing', 'paper_trade_sizing_not_ready']);
  assert.equal(fs.existsSync(ledgerPath), false);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
});

test('paper order ticket store writes local JSONL only when ticket preview is ready', () => {
  const ledgerPath = tmpLedger();

  const result = storePaperTradeOrderTicket({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    ticketPreview: readyTicketPreview()
  });

  assert.equal(result.status, 'stored');
  assert.equal(result.ticketReady, true);
  assert.equal(result.ticketStored, true);
  assert.equal(result.wroteRecord, true);
  assert.equal(result.recordCount, 1);
  assert.equal(result.record.symbol, 'AAPL');
  assert.equal(result.record.side, 'buy');
  assert.equal(result.record.type, 'market');
  assert.equal(result.record.qty, '10');
  assert.equal(result.record.time_in_force, 'day');
  assert.equal(result.record.executionAdapter, 'none');
  assert.equal(result.record.broker, 'none');
  assert.equal(result.record.brokerContact, false);
  assert.equal(result.record.orderPlacement, false);
  assert.equal(result.record.accountMutation, false);
  assert.equal(result.record.executionRequested, false);

  const records = readPaperTradeOrderTicketRecords(ledgerPath);
  assert.equal(records.length, 1);
  assert.equal(records[0].symbol, 'AAPL');
});

test('paper order ticket store dashboard exposes latest local ticket safely', () => {
  const ledgerPath = tmpLedger();

  storePaperTradeOrderTicket({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    ticketPreview: readyTicketPreview()
  });

  const dashboard = readPaperTradeOrderTicketStoreDashboard({ ledgerPath });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, PAPER_TRADE_ORDER_TICKET_STORE_VERSION);
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.previewOnly, true);
  assert.equal(dashboard.paperOnly, true);
  assert.equal(dashboard.recordCount, 1);
  assert.equal(dashboard.hasRecords, true);
  assert.equal(dashboard.latestStatus, 'stored');
  assert.equal(dashboard.latestRecord.symbol, 'AAPL');
  assert.equal(dashboard.latestRecord.brokerContact, false);
  assert.equal(dashboard.latestRecord.orderPlacement, false);
  assert.equal(dashboard.latestRecord.accountMutation, false);
});
