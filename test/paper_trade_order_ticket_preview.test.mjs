import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_ORDER_TICKET_PREVIEW_VERSION,
  buildPaperTradeOrderTicketPreview,
  buildPaperTradeOrderTicketPreviewPanel
} from '../src/scanner/paper_trade_order_ticket_preview.mjs';

test('paper trade order ticket preview blocks when sizing is not ready', () => {
  const preview = buildPaperTradeOrderTicketPreview({
    sizingPreview: {
      version: 'paper_trade_sizing_preview_v1',
      sizingReady: false,
      reasons: ['paper_intent_missing'],
      sourceIntentId: null,
      normalized: {
        symbol: '',
        side: null,
        entryPrice: null
      },
      sizingModel: {
        quantity: 0,
        notional: 0
      },
      sizedExecutionPayload: null
    }
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.version, PAPER_TRADE_ORDER_TICKET_PREVIEW_VERSION);
  assert.equal(preview.monitorOnly, true);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.status, 'blocked');
  assert.equal(preview.ticketReady, false);
  assert.ok(preview.reasons.includes('paper_intent_missing'));
  assert.ok(preview.reasons.includes('paper_trade_sizing_not_ready'));
  assert.ok(preview.reasons.includes('sized_execution_payload_missing'));
  assert.equal(preview.orderTicket, null);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper trade order ticket preview builds broker-style ticket without broker contact', () => {
  const preview = buildPaperTradeOrderTicketPreview({
    sizingPreview: {
      version: 'paper_trade_sizing_preview_v1',
      sizingReady: true,
      reasons: [],
      sourceIntentId: 'paper_intent_test',
      normalized: {
        symbol: 'AAPL',
        side: 'buy',
        entryPrice: 100
      },
      sizingModel: {
        quantity: 10,
        notional: 1000
      },
      sizedExecutionPayload: {
        symbol: 'AAPL',
        side: 'buy',
        orderType: 'market',
        timeInForce: 'day',
        quantity: 10,
        notional: 1000,
        entryReferencePrice: 100,
        executionAdapter: 'none',
        broker: 'none',
        previewOnly: true,
        paperOnly: true
      }
    }
  });

  assert.equal(preview.status, 'ready');
  assert.equal(preview.ticketReady, true);
  assert.deepEqual(preview.reasons, []);
  assert.equal(preview.orderTicket.symbol, 'AAPL');
  assert.equal(preview.orderTicket.side, 'buy');
  assert.equal(preview.orderTicket.type, 'market');
  assert.equal(preview.orderTicket.qty, '10');
  assert.equal(preview.orderTicket.time_in_force, 'day');
  assert.equal(preview.orderTicket.extended_hours, false);
  assert.equal(preview.orderTicket.order_class, 'simple');
  assert.equal(preview.orderTicket.executionAdapter, 'none');
  assert.equal(preview.orderTicket.broker, 'none');
  assert.equal(preview.orderTicket.previewOnly, true);
  assert.equal(preview.orderTicket.paperOnly, true);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
});

test('paper trade order ticket preview panel exposes operator dashboard card', () => {
  const panel = buildPaperTradeOrderTicketPreviewPanel({
    sizingPreview: {
      version: 'paper_trade_sizing_preview_v1',
      sizingReady: true,
      reasons: [],
      sourceIntentId: 'paper_intent_test',
      normalized: {
        symbol: 'MSFT',
        side: 'sell',
        entryPrice: 50
      },
      sizingModel: {
        quantity: 20,
        notional: 1000
      },
      sizedExecutionPayload: {
        symbol: 'MSFT',
        side: 'sell',
        orderType: 'market',
        timeInForce: 'day',
        quantity: 20,
        notional: 1000,
        entryReferencePrice: 50,
        executionAdapter: 'none',
        broker: 'none',
        previewOnly: true,
        paperOnly: true
      }
    }
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_order_ticket_preview_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'ready');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.ticketReady, true);
  assert.equal(panel.summary.symbol, 'MSFT');
  assert.equal(panel.summary.side, 'sell');
  assert.equal(panel.summary.quantity, 20);
  assert.equal(panel.summary.notional, 1000);
  assert.equal(panel.summary.orderType, 'market');
  assert.equal(panel.summary.timeInForce, 'day');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
});
