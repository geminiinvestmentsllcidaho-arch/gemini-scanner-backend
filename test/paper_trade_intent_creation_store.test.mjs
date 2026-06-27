import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createPaperTradeIntent,
  evaluatePaperTradeIntentCreation,
  readPaperTradeIntentCreationRecords,
  PAPER_TRADE_INTENT_CREATION_STORE_VERSION
} from '../src/scanner/paper_trade_intent_creation_store.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-intent-store-')), 'ledger.jsonl');
}

test('paper intent creation store blocks incomplete intent and does not write ledger', () => {
  const ledgerPath = tmpLedger();

  const result = createPaperTradeIntent(
    {
      readinessGateStatus: 'blocked'
    },
    { ledgerPath, now: new Date('2026-06-26T12:00:00.000Z') }
  );

  assert.equal(result.version, PAPER_TRADE_INTENT_CREATION_STORE_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.status, 'blocked');
  assert.equal(result.intentWouldBeCreated, false);
  assert.equal(result.intentCreated, false);
  assert.equal(result.wroteRecord, false);
  assert.deepEqual(result.reasons, [
    'readiness_gate_blocked',
    'candidate_symbol_missing',
    'action_not_tradeable',
    'entry_price_missing'
  ]);
  assert.equal(fs.existsSync(ledgerPath), false);
});

test('paper intent creation store writes local JSONL only when all creation gates are valid', () => {
  const ledgerPath = tmpLedger();

  const result = createPaperTradeIntent(
    {
      readinessGateStatus: 'passed',
      candidateSymbol: 'aapl',
      action: 'BUY',
      entryPrice: '123.45'
    },
    {
      ledgerPath,
      now: new Date('2026-06-26T12:00:00.000Z'),
      source: 'unit_test'
    }
  );

  assert.equal(result.status, 'created');
  assert.equal(result.intentWouldBeCreated, true);
  assert.equal(result.intentCreated, true);
  assert.equal(result.wroteRecord, true);
  assert.equal(result.recordCount, 1);
  assert.equal(result.record.symbol, 'AAPL');
  assert.equal(result.record.action, 'buy');
  assert.equal(result.record.entryPrice, 123.45);
  assert.equal(result.record.monitorOnly, true);
  assert.equal(result.record.brokerContact, false);
  assert.equal(result.record.orderPlacement, false);
  assert.equal(result.record.accountMutation, false);
  assert.equal(result.record.executionRequested, false);

  const records = readPaperTradeIntentCreationRecords(ledgerPath);
  assert.equal(records.length, 1);
  assert.equal(records[0].symbol, 'AAPL');
});

test('paper intent creation evaluator accepts nested readiness/candidate/plan input', () => {
  const result = evaluatePaperTradeIntentCreation(
    {
      readinessGate: { ok: true },
      candidate: {
        symbol: 'msft',
        tradeAction: 'sell',
        price: 98.76
      }
    },
    { now: new Date('2026-06-26T12:00:00.000Z') }
  );

  assert.equal(result.status, 'created');
  assert.equal(result.normalized.symbol, 'MSFT');
  assert.equal(result.normalized.action, 'sell');
  assert.equal(result.normalized.entryPrice, 98.76);
  assert.deepEqual(result.reasons, []);
});

test('paper intent creation store appends deterministic local records without broker flags', () => {
  const ledgerPath = tmpLedger();

  createPaperIntent('NVDA', ledgerPath);
  createPaperIntent('SPY', ledgerPath);

  const records = readPaperTradeIntentCreationRecords(ledgerPath);

  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.symbol), ['NVDA', 'SPY']);
  assert.ok(records.every((record) => record.version === PAPER_TRADE_INTENT_CREATION_STORE_VERSION));
  assert.ok(records.every((record) => record.monitorOnly === true));
  assert.ok(records.every((record) => record.brokerContact === false));
  assert.ok(records.every((record) => record.orderPlacement === false));
  assert.ok(records.every((record) => record.accountMutation === false));
});

function createPaperIntent(symbol, ledgerPath) {
  return createPaperTradeIntent(
    {
      canCreateIntent: true,
      symbol,
      action: 'buy',
      entryPrice: 10
    },
    {
      ledgerPath,
      now: new Date(`2026-06-26T12:00:0${symbol === 'NVDA' ? '1' : '2'}.000Z`)
    }
  );
}
