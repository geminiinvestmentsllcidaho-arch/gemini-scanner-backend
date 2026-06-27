import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { storePaperTradeOrderTicket } from '../src/scanner/paper_trade_order_ticket_store.mjs';
import {
  PAPER_TRADE_ORDER_TICKET_STORE_PANEL_VERSION,
  readPaperTradeOrderTicketStorePanel
} from '../src/scanner/paper_trade_order_ticket_store_panel.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-order-ticket-store-panel-')), 'ledger.jsonl');
}

function readyTicketPreview(symbol = 'AAPL', side = 'buy', qty = '10') {
  return {
    version: 'paper_trade_order_ticket_preview_v1',
    ticketReady: true,
    reasonCount: 0,
    reasons: [],
    sourceIntentId: `paper_intent_${symbol.toLowerCase()}`,
    orderTicket: {
      symbol,
      side,
      type: 'market',
      qty,
      time_in_force: 'day',
      client_order_id: null,
      extended_hours: false,
      order_class: 'simple',
      sourceIntentId: `paper_intent_${symbol.toLowerCase()}`,
      previewOnly: true,
      paperOnly: true,
      executionAdapter: 'none',
      broker: 'none'
    }
  };
}

test('paper order ticket store panel reports empty local store safely', () => {
  const ledgerPath = tmpLedger();
  const panel = readPaperTradeOrderTicketStorePanel({ ledgerPath });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_TRADE_ORDER_TICKET_STORE_PANEL_VERSION);
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.previewOnly, true);
  assert.equal(panel.paperOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.severity, 'neutral');
  assert.equal(panel.recordCount, 0);
  assert.equal(panel.summary.latestTicketId, null);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});

test('paper order ticket store panel exposes latest stored ticket', () => {
  const ledgerPath = tmpLedger();

  storePaperTradeOrderTicket({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    ticketPreview: readyTicketPreview('AAPL', 'buy', '10')
  });

  storePaperTradeOrderTicket({
    ledgerPath,
    now: new Date('2026-06-26T12:01:00.000Z'),
    ticketPreview: readyTicketPreview('MSFT', 'sell', '20')
  });

  const panel = readPaperTradeOrderTicketStorePanel({ ledgerPath });

  assert.equal(panel.status, 'stored');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.recordCount, 2);
  assert.equal(panel.summary.latestSymbol, 'MSFT');
  assert.equal(panel.summary.latestSide, 'sell');
  assert.equal(panel.summary.latestType, 'market');
  assert.equal(panel.summary.latestQty, '20');
  assert.equal(panel.summary.latestTimeInForce, 'day');
  assert.equal(panel.summary.executionAdapter, 'none');
  assert.equal(panel.summary.broker, 'none');
  assert.equal(panel.metrics.latestSymbol, 'MSFT');
  assert.equal(panel.metrics.latestSide, 'sell');
  assert.ok(panel.badges.some((badge) => badge.label === 'Order Placement' && badge.value === false));
});
