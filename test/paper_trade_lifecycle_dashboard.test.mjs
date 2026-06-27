import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPaperTradeIntent } from '../src/scanner/paper_trade_intent_creation_store.mjs';
import { storePaperTradeOrderTicket } from '../src/scanner/paper_trade_order_ticket_store.mjs';
import { storePaperTradeFillSimulation } from '../src/scanner/paper_trade_fill_simulation_store.mjs';
import { storePaperTradePositionState } from '../src/scanner/paper_trade_position_state_store.mjs';
import {
  PAPER_TRADE_LIFECYCLE_DASHBOARD_VERSION,
  readPaperTradeLifecycleDashboard,
  readPaperTradeLifecycleDashboardPanel
} from '../src/scanner/paper_trade_lifecycle_dashboard.mjs';

function tmpLedger(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), name)), 'ledger.jsonl');
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

function readyFillPreview() {
  return {
    version: 'paper_trade_fill_simulation_preview_v1',
    fillReady: true,
    reasonCount: 0,
    reasons: [],
    sourceTicketId: 'paper_ticket_test',
    sourceIntentId: 'paper_intent_test',
    simulatedFill: {
      sourceTicketId: 'paper_ticket_test',
      sourceIntentId: 'paper_intent_test',
      symbol: 'AAPL',
      side: 'buy',
      qty: 10,
      fillPrice: 100,
      filledNotional: 1000,
      fillStatus: 'filled',
      fillType: 'local_simulated_market_fill',
      broker: 'none',
      executionAdapter: 'none',
      previewOnly: true,
      paperOnly: true
    }
  };
}

function positionPreview() {
  return {
    version: 'paper_trade_position_state_preview_v1',
    status: 'computed',
    sourceLedgerPath: '/tmp/source-fills.jsonl',
    sourceRecordCount: 1,
    ignoredRecordCount: 0,
    positionCount: 1,
    openPositionCount: 1,
    closedPositionCount: 0,
    totalCostBasis: 1000,
    totalRealizedPnl: 0,
    positions: [
      {
        symbol: 'AAPL',
        qty: 10,
        avgEntryPrice: 100,
        costBasis: 1000,
        realizedPnl: 0,
        lastFillPrice: 100,
        lastFillId: 'paper_fill_test',
        lastUpdatedAt: '2026-06-26T12:00:00.000Z',
        fillCount: 1
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

test('paper lifecycle dashboard reports empty local lifecycle safely', () => {
  const dashboard = readPaperTradeLifecycleDashboard({
    intentLedgerPath: tmpLedger('paper-lifecycle-intent-empty-'),
    ticketLedgerPath: tmpLedger('paper-lifecycle-ticket-empty-'),
    fillLedgerPath: tmpLedger('paper-lifecycle-fill-empty-'),
    positionLedgerPath: tmpLedger('paper-lifecycle-position-empty-')
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, PAPER_TRADE_LIFECYCLE_DASHBOARD_VERSION);
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.lifecycleStatus, 'empty');
  assert.equal(dashboard.totalRecords, 0);
  assert.equal(dashboard.stages.intent.latestStatus, 'empty');
  assert.equal(dashboard.stages.orderTicket.latestStatus, 'empty');
  assert.equal(dashboard.stages.fillSimulation.latestStatus, 'empty');
  assert.equal(dashboard.stages.positionState.latestStatus, 'empty');
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.orderPlacement, false);
  assert.equal(dashboard.safety.accountMutation, false);
});

test('paper lifecycle dashboard reports complete local simulation from all stores', () => {
  const intentLedgerPath = tmpLedger('paper-lifecycle-intent-');
  const ticketLedgerPath = tmpLedger('paper-lifecycle-ticket-');
  const fillLedgerPath = tmpLedger('paper-lifecycle-fill-');
  const positionLedgerPath = tmpLedger('paper-lifecycle-position-');

  createPaperTradeIntent(
    {
      readinessGateStatus: 'passed',
      symbol: 'AAPL',
      action: 'buy',
      entryPrice: 100
    },
    {
      ledgerPath: intentLedgerPath,
      now: new Date('2026-06-26T12:00:00.000Z')
    }
  );

  storePaperTradeOrderTicket({
    ledgerPath: ticketLedgerPath,
    now: new Date('2026-06-26T12:01:00.000Z'),
    ticketPreview: readyTicketPreview()
  });

  storePaperTradeFillSimulation({
    ledgerPath: fillLedgerPath,
    now: new Date('2026-06-26T12:02:00.000Z'),
    fillPreview: readyFillPreview()
  });

  storePaperTradePositionState({
    storeLedgerPath: positionLedgerPath,
    now: new Date('2026-06-26T12:03:00.000Z'),
    positionPreview: positionPreview()
  });

  const dashboard = readPaperTradeLifecycleDashboard({
    intentLedgerPath,
    ticketLedgerPath,
    fillLedgerPath,
    positionLedgerPath
  });

  assert.equal(dashboard.lifecycleStatus, 'complete_local_simulation');
  assert.equal(dashboard.totalRecords, 4);
  assert.equal(dashboard.stages.intent.latestStatus, 'created');
  assert.equal(dashboard.stages.orderTicket.latestStatus, 'stored');
  assert.equal(dashboard.stages.fillSimulation.latestStatus, 'stored');
  assert.equal(dashboard.stages.positionState.latestStatus, 'stored');
  assert.equal(dashboard.stages.positionState.positionCount, 1);
  assert.equal(dashboard.stages.positionState.totalCostBasis, 1000);
  assert.equal(dashboard.stages.positionState.totalRealizedPnl, 0);
});

test('paper lifecycle dashboard panel exposes operator dashboard card', () => {
  const panel = readPaperTradeLifecycleDashboardPanel({
    intentLedgerPath: tmpLedger('paper-lifecycle-panel-intent-empty-'),
    ticketLedgerPath: tmpLedger('paper-lifecycle-panel-ticket-empty-'),
    fillLedgerPath: tmpLedger('paper-lifecycle-panel-fill-empty-'),
    positionLedgerPath: tmpLedger('paper-lifecycle-panel-position-empty-')
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_lifecycle_dashboard_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.status, 'empty');
  assert.equal(panel.severity, 'neutral');
  assert.equal(panel.summary.lifecycleStatus, 'empty');
  assert.equal(panel.metrics.totalRecords, 0);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});
