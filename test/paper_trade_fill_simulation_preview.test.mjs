import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TRADE_FILL_SIMULATION_PREVIEW_VERSION,
  buildPaperTradeFillSimulationPreview,
  buildPaperTradeFillSimulationPreviewPanel
} from '../src/scanner/paper_trade_fill_simulation_preview.mjs';

const ticket = {
  version: 'paper_trade_order_ticket_store_v1',
  ticketId: 'paper_ticket_test',
  sourceIntentId: 'paper_intent_test',
  symbol: 'AAPL',
  side: 'buy',
  type: 'market',
  qty: '10',
  time_in_force: 'day',
  executionAdapter: 'none',
  broker: 'none',
  brokerContact: false,
  orderPlacement: false,
  accountMutation: false
};

test('paper fill simulation preview blocks when no local ticket exists', () => {
  const preview = buildPaperTradeFillSimulationPreview({
    records: []
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.version, PAPER_TRADE_FILL_SIMULATION_PREVIEW_VERSION);
  assert.equal(preview.monitorOnly, true);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.paperOnly, true);
  assert.equal(preview.status, 'blocked');
  assert.equal(preview.fillReady, false);
  assert.deepEqual(preview.reasons, ['paper_order_ticket_missing']);
  assert.equal(preview.simulatedFill, null);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper fill simulation preview builds local fill preview from stored ticket', () => {
  const preview = buildPaperTradeFillSimulationPreview({
    records: [ticket],
    fillPrice: 123.45
  });

  assert.equal(preview.status, 'ready');
  assert.equal(preview.fillReady, true);
  assert.deepEqual(preview.reasons, []);
  assert.equal(preview.sourceTicketId, 'paper_ticket_test');
  assert.equal(preview.sourceIntentId, 'paper_intent_test');
  assert.equal(preview.normalized.symbol, 'AAPL');
  assert.equal(preview.normalized.side, 'buy');
  assert.equal(preview.normalized.qty, 10);
  assert.equal(preview.normalized.fillPrice, 123.45);
  assert.equal(preview.simulatedFill.symbol, 'AAPL');
  assert.equal(preview.simulatedFill.side, 'buy');
  assert.equal(preview.simulatedFill.qty, 10);
  assert.equal(preview.simulatedFill.fillPrice, 123.45);
  assert.equal(preview.simulatedFill.filledNotional, 1234.5);
  assert.equal(preview.simulatedFill.fillStatus, 'filled');
  assert.equal(preview.simulatedFill.fillType, 'local_simulated_market_fill');
  assert.equal(preview.simulatedFill.executionAdapter, 'none');
  assert.equal(preview.simulatedFill.broker, 'none');
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper fill simulation preview panel exposes operator dashboard card', () => {
  const panel = buildPaperTradeFillSimulationPreviewPanel({
    records: [
      {
        ...ticket,
        symbol: 'MSFT',
        side: 'sell',
        qty: '20'
      }
    ],
    fillPrice: 50
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_fill_simulation_preview_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'ready');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.fillReady, true);
  assert.equal(panel.summary.symbol, 'MSFT');
  assert.equal(panel.summary.side, 'sell');
  assert.equal(panel.summary.qty, 20);
  assert.equal(panel.summary.fillPrice, 50);
  assert.equal(panel.summary.filledNotional, 1000);
  assert.equal(panel.summary.executionAdapter, 'none');
  assert.equal(panel.summary.broker, 'none');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
});
