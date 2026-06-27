import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_SIZING_PREVIEW_VERSION,
  buildPaperTradeSizingPreview,
  buildPaperTradeSizingPreviewPanel
} from '../src/scanner/paper_trade_sizing_preview.mjs';

test('paper trade sizing preview blocks when payload is not ready', () => {
  const preview = buildPaperTradeSizingPreview({
    payloadPreview: {
      version: 'paper_trade_execution_payload_preview_v1',
      payloadReady: false,
      reasons: ['paper_intent_missing'],
      normalized: {
        symbol: '',
        side: null,
        entryPrice: null
      },
      sourceIntentId: null,
      executionPayload: null
    }
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.version, PAPER_TRADE_SIZING_PREVIEW_VERSION);
  assert.equal(preview.monitorOnly, true);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.status, 'blocked');
  assert.equal(preview.sizingReady, false);
  assert.ok(preview.reasons.includes('paper_intent_missing'));
  assert.ok(preview.reasons.includes('execution_payload_not_ready'));
  assert.ok(preview.reasons.includes('entry_price_missing_for_sizing'));
  assert.equal(preview.sizedExecutionPayload, null);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper trade sizing preview creates deterministic local sizing from ready payload', () => {
  const preview = buildPaperTradeSizingPreview({
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1,
    payloadPreview: {
      version: 'paper_trade_execution_payload_preview_v1',
      payloadReady: true,
      reasons: [],
      sourceIntentId: 'paper_intent_test',
      normalized: {
        symbol: 'AAPL',
        side: 'buy',
        entryPrice: 100
      },
      executionPayload: {
        symbol: 'AAPL',
        side: 'buy',
        orderType: 'market',
        timeInForce: 'day',
        entryReferencePrice: 100,
        executionAdapter: 'none',
        broker: 'none',
        previewOnly: true,
        paperOnly: true
      }
    }
  });

  assert.equal(preview.status, 'ready');
  assert.equal(preview.sizingReady, true);
  assert.deepEqual(preview.reasons, []);
  assert.equal(preview.sizingModel.paperEquity, 10000);
  assert.equal(preview.sizingModel.riskBudget, 50);
  assert.equal(preview.sizingModel.maxNotional, 1000);
  assert.equal(preview.sizingModel.riskBasedQty, 25);
  assert.equal(preview.sizingModel.maxNotionalQty, 10);
  assert.equal(preview.sizingModel.quantity, 10);
  assert.equal(preview.sizingModel.notional, 1000);
  assert.equal(preview.sizedExecutionPayload.symbol, 'AAPL');
  assert.equal(preview.sizedExecutionPayload.side, 'buy');
  assert.equal(preview.sizedExecutionPayload.quantity, 10);
  assert.equal(preview.sizedExecutionPayload.notional, 1000);
  assert.equal(preview.sizedExecutionPayload.executionAdapter, 'none');
  assert.equal(preview.sizedExecutionPayload.broker, 'none');
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
});

test('paper trade sizing preview panel exposes operator dashboard card', () => {
  const panel = buildPaperTradeSizingPreviewPanel({
    payloadPreview: {
      version: 'paper_trade_execution_payload_preview_v1',
      payloadReady: true,
      reasons: [],
      sourceIntentId: 'paper_intent_test',
      normalized: {
        symbol: 'MSFT',
        side: 'sell',
        entryPrice: 50
      },
      executionPayload: {
        symbol: 'MSFT',
        side: 'sell',
        orderType: 'market',
        timeInForce: 'day',
        entryReferencePrice: 50,
        executionAdapter: 'none',
        broker: 'none',
        previewOnly: true,
        paperOnly: true
      }
    },
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_sizing_preview_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'ready');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.sizingReady, true);
  assert.equal(panel.summary.symbol, 'MSFT');
  assert.equal(panel.summary.side, 'sell');
  assert.equal(panel.summary.entryPrice, 50);
  assert.equal(panel.summary.quantity, 20);
  assert.equal(panel.summary.notional, 1000);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
});
