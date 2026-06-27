import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildPaperTradeOrderTicketPreview } from './paper_trade_order_ticket_preview.mjs';

export const PAPER_TRADE_ORDER_TICKET_STORE_VERSION =
  'paper_trade_order_ticket_store_v1';

export const DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH =
  process.env.PAPER_TRADE_ORDER_TICKET_LEDGER_PATH ||
  path.join(process.cwd(), 'runs', 'paper_trade_order_ticket_store.jsonl');

export function readPaperTradeOrderTicketRecords(
  ledgerPath = DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH
) {
  if (!fs.existsSync(ledgerPath)) return [];

  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function createTicketRecord(ticketPreview, now) {
  const ticket = ticketPreview.orderTicket;
  const ts = now.toISOString();

  const ticketId = `paper_ticket_${crypto
    .createHash('sha256')
    .update(`${ticket.symbol}:${ticket.side}:${ticket.qty}:${ticket.sourceIntentId || ''}:${ts}`)
    .digest('hex')
    .slice(0, 16)}`;

  return {
    version: PAPER_TRADE_ORDER_TICKET_STORE_VERSION,
    ticketId,
    createdAt: ts,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    sourceIntentId: ticket.sourceIntentId || null,
    symbol: ticket.symbol,
    side: ticket.side,
    type: ticket.type,
    qty: ticket.qty,
    time_in_force: ticket.time_in_force,
    extended_hours: ticket.extended_hours,
    order_class: ticket.order_class,
    client_order_id: ticket.client_order_id,
    executionAdapter: 'none',
    broker: 'none',
    brokerContact: false,
    orderPlacement: false,
    accountMutation: false,
    executionRequested: false
  };
}

export function storePaperTradeOrderTicket(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH;

  const now = options.now instanceof Date ? options.now : new Date();
  const ticketPreview =
    options.ticketPreview || buildPaperTradeOrderTicketPreview(options);

  if (!ticketPreview.ticketReady) {
    return {
      ok: true,
      version: PAPER_TRADE_ORDER_TICKET_STORE_VERSION,
      monitorOnly: true,
      previewOnly: true,
      paperOnly: true,
      status: 'blocked',
      ticketReady: false,
      ticketStored: false,
      wroteRecord: false,
      reasonCount: ticketPreview.reasonCount,
      reasons: ticketPreview.reasons,
      ledgerPath,
      recordCount: readPaperTradeOrderTicketRecords(ledgerPath).length,
      ticketPreview,
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

  const record = createTicketRecord(ticketPreview, now);
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);

  return {
    ok: true,
    version: PAPER_TRADE_ORDER_TICKET_STORE_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: 'stored',
    ticketReady: true,
    ticketStored: true,
    wroteRecord: true,
    reasonCount: 0,
    reasons: [],
    ledgerPath,
    recordCount: readPaperTradeOrderTicketRecords(ledgerPath).length,
    ticketPreview,
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

export function readPaperTradeOrderTicketStoreDashboard(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH;

  const records = readPaperTradeOrderTicketRecords(ledgerPath);
  const latestRecord = records.length ? records[records.length - 1] : null;

  return {
    ok: true,
    version: PAPER_TRADE_ORDER_TICKET_STORE_VERSION,
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
