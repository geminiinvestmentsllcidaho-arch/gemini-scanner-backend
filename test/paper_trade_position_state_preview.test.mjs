import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_POSITION_STATE_PREVIEW_VERSION,
  buildPaperTradePositionStatePreview,
  buildPaperTradePositionStatePreviewPanel
} from '../src/scanner/paper_trade_position_state_preview.mjs';

test('paper position state preview reports empty local fill ledger safely', () => {
  const preview = buildPaperTradePositionStatePreview({ records: [] });

  assert.equal(preview.ok, true);
  assert.equal(preview.version, PAPER_TRADE_POSITION_STATE_PREVIEW_VERSION);
  assert.equal(preview.monitorOnly, true);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.paperOnly, true);
  assert.equal(preview.status, 'empty');
  assert.equal(preview.positionCount, 0);
  assert.equal(preview.openPositionCount, 0);
  assert.equal(preview.totalCostBasis, 0);
  assert.equal(preview.totalRealizedPnl, 0);
  assert.deepEqual(preview.positions, []);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper position state preview computes buy position from local fills', () => {
  const preview = buildPaperTradePositionStatePreview({
    records: [
      {
        fillId: 'fill_1',
        createdAt: '2026-06-26T12:00:00.000Z',
        symbol: 'AAPL',
        side: 'buy',
        qty: 10,
        fillPrice: 100
      },
      {
        fillId: 'fill_2',
        createdAt: '2026-06-26T12:01:00.000Z',
        symbol: 'AAPL',
        side: 'buy',
        qty: 5,
        fillPrice: 110
      }
    ]
  });

  assert.equal(preview.status, 'computed');
  assert.equal(preview.positionCount, 1);
  assert.equal(preview.openPositionCount, 1);
  assert.equal(preview.totalCostBasis, 1550);
  assert.equal(preview.totalRealizedPnl, 0);
  assert.equal(preview.positions[0].symbol, 'AAPL');
  assert.equal(preview.positions[0].qty, 15);
  assert.equal(preview.positions[0].avgEntryPrice, 103.3333);
  assert.equal(preview.positions[0].costBasis, 1550);
  assert.equal(preview.positions[0].lastFillId, 'fill_2');
});

test('paper position state preview computes realized pnl after sell fill', () => {
  const preview = buildPaperTradePositionStatePreview({
    records: [
      {
        fillId: 'fill_1',
        createdAt: '2026-06-26T12:00:00.000Z',
        symbol: 'MSFT',
        side: 'buy',
        qty: 20,
        fillPrice: 50
      },
      {
        fillId: 'fill_2',
        createdAt: '2026-06-26T12:01:00.000Z',
        symbol: 'MSFT',
        side: 'sell',
        qty: 5,
        fillPrice: 60
      }
    ]
  });

  assert.equal(preview.positionCount, 1);
  assert.equal(preview.openPositionCount, 1);
  assert.equal(preview.totalCostBasis, 750);
  assert.equal(preview.totalRealizedPnl, 50);
  assert.equal(preview.positions[0].symbol, 'MSFT');
  assert.equal(preview.positions[0].qty, 15);
  assert.equal(preview.positions[0].avgEntryPrice, 50);
  assert.equal(preview.positions[0].realizedPnl, 50);
});

test('paper position state preview panel exposes operator dashboard card', () => {
  const panel = buildPaperTradePositionStatePreviewPanel({
    records: [
      {
        fillId: 'fill_1',
        createdAt: '2026-06-26T12:00:00.000Z',
        symbol: 'AAPL',
        side: 'buy',
        qty: 10,
        fillPrice: 100
      }
    ]
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_position_state_preview_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'computed');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.positionCount, 1);
  assert.equal(panel.openPositionCount, 1);
  assert.equal(panel.summary.latestSymbol, 'AAPL');
  assert.equal(panel.summary.latestQty, 10);
  assert.equal(panel.summary.latestAvgEntryPrice, 100);
  assert.equal(panel.metrics.totalCostBasis, 1000);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
