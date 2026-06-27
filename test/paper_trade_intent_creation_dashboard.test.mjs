import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createPaperTradeIntent } from '../src/scanner/paper_trade_intent_creation_store.mjs';
import {
  PAPER_TRADE_INTENT_CREATION_DASHBOARD_VERSION,
  readPaperTradeIntentCreationDashboard
} from '../src/scanner/paper_trade_intent_creation_dashboard.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-intent-creation-dashboard-')), 'ledger.jsonl');
}

test('paper intent creation dashboard reports empty local ledger safely', () => {
  const ledgerPath = tmpLedger();
  const result = readPaperTradeIntentCreationDashboard({ ledgerPath });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADE_INTENT_CREATION_DASHBOARD_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.recordCount, 0);
  assert.equal(result.hasRecords, false);
  assert.equal(result.latestRecord, null);
  assert.equal(result.latestStatus, 'empty');
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.accountMutation, false);
  assert.equal(result.safety.localJsonlOnly, true);
});

test('paper intent creation dashboard exposes latest created local paper intent', () => {
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

  createPaperTradeIntent(
    {
      readinessGateStatus: 'passed',
      symbol: 'MSFT',
      action: 'sell',
      entryPrice: 222.22
    },
    {
      ledgerPath,
      now: new Date('2026-06-26T12:01:00.000Z'),
      source: 'unit_test'
    }
  );

  const result = readPaperTradeIntentCreationDashboard({ ledgerPath });

  assert.equal(result.recordCount, 2);
  assert.equal(result.hasRecords, true);
  assert.equal(result.latestStatus, 'created');
  assert.equal(result.latestRecord.symbol, 'MSFT');
  assert.equal(result.latestRecord.action, 'sell');
  assert.equal(result.latestRecord.entryPrice, 222.22);
  assert.equal(result.latestRecord.brokerContact, false);
  assert.equal(result.latestRecord.orderPlacement, false);
  assert.equal(result.latestRecord.accountMutation, false);
});
