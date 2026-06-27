import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPaperTradeIntent } from '../src/scanner/paper_trade_intent_creation_store.mjs';
import {
  PAPER_TRADE_EXECUTION_PAYLOAD_PREVIEW_VERSION,
  buildPaperTradeExecutionPayloadPreview,
  buildPaperTradeExecutionPayloadPreviewPanel
} from '../src/scanner/paper_trade_execution_payload_preview.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-execution-payload-preview-')), 'ledger.jsonl');
}

test('paper execution payload preview blocks when no local paper intent exists', () => {
  const ledgerPath = tmpLedger();
  const preview = buildPaperTradeExecutionPayloadPreview({ ledgerPath });

  assert.equal(preview.ok, true);
  assert.equal(preview.version, PAPER_TRADE_EXECUTION_PAYLOAD_PREVIEW_VERSION);
  assert.equal(preview.monitorOnly, true);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.status, 'blocked');
  assert.equal(preview.payloadReady, false);
  assert.deepEqual(preview.reasons, ['paper_intent_missing']);
  assert.equal(preview.executionPayload, null);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper execution payload preview builds local payload from latest paper intent without broker contact', () => {
  const ledgerPath = tmpLedger();

  createPaperTradeIntent(
    {
      readinessGateStatus: 'passed',
      symbol: 'AAPL',
      action: 'buy',
      entryPrice: 123.45
    },
    {
      ledgerPath,
      now: new Date('2026-06-26T12:00:00.000Z'),
      source: 'unit_test'
    }
  );

  const preview = buildPaperTradeExecutionPayloadPreview({ ledgerPath });

  assert.equal(preview.status, 'ready');
  assert.equal(preview.payloadReady, true);
  assert.deepEqual(preview.reasons, []);
  assert.equal(preview.normalized.symbol, 'AAPL');
  assert.equal(preview.normalized.side, 'buy');
  assert.equal(preview.normalized.entryPrice, 123.45);
  assert.equal(preview.executionPayload.symbol, 'AAPL');
  assert.equal(preview.executionPayload.side, 'buy');
  assert.equal(preview.executionPayload.orderType, 'market');
  assert.equal(preview.executionPayload.timeInForce, 'day');
  assert.equal(preview.executionPayload.executionAdapter, 'none');
  assert.equal(preview.executionPayload.broker, 'none');
  assert.equal(preview.executionPayload.previewOnly, true);
  assert.equal(preview.executionPayload.paperOnly, true);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper execution payload preview panel exposes operator dashboard card', () => {
  const panel = buildPaperTradeExecutionPayloadPreviewPanel({
    records: [
      {
        intentId: 'paper_intent_test',
        symbol: 'MSFT',
        action: 'sell',
        entryPrice: 222.22,
        createdAt: '2026-06-26T12:00:00.000Z'
      }
    ]
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_execution_payload_preview_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'ready');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.payloadReady, true);
  assert.equal(panel.summary.symbol, 'MSFT');
  assert.equal(panel.summary.side, 'sell');
  assert.equal(panel.summary.entryPrice, 222.22);
  assert.equal(panel.summary.executionAdapter, 'none');
  assert.equal(panel.summary.broker, 'none');
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
});
