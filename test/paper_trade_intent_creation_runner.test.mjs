import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_INTENT_CREATION_RUNNER_VERSION,
  buildPaperTradeIntentCreationInput,
  previewPaperTradeIntentCreationFromPlan,
  runPaperTradeIntentCreation
} from '../src/scanner/paper_trade_intent_creation_runner.mjs';

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'paper-intent-creation-runner-')), 'ledger.jsonl');
}

test('paper intent creation runner normalizes planner payload into creation input', () => {
  const input = buildPaperTradeIntentCreationInput({
    readinessGate: { ok: true, status: 'passed' },
    candidate: {
      symbol: 'aapl',
      tradeAction: 'BUY',
      price: '123.45'
    }
  });

  assert.equal(input.readinessGateOk, true);
  assert.equal(input.readinessGateStatus, 'passed');
  assert.equal(input.candidateSymbol, 'aapl');
  assert.equal(input.action, 'BUY');
  assert.equal(input.entryPrice, '123.45');
  assert.equal(input.source, 'paper_trade_intent_creation_runner');
});

test('paper intent creation preview never writes local ledger', () => {
  const ledgerPath = tmpLedger();

  const preview = previewPaperTradeIntentCreationFromPlan(
    {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 123.45
    },
    { ledgerPath, now: new Date('2026-06-26T12:00:00.000Z') }
  );

  assert.equal(preview.version, PAPER_TRADE_INTENT_CREATION_RUNNER_VERSION);
  assert.equal(preview.monitorOnly, true);
  assert.equal(preview.mode, 'preview');
  assert.equal(preview.intentWouldBeCreated, true);
  assert.equal(preview.intentCreated, false);
  assert.equal(preview.wroteRecord, false);
  assert.equal(fs.existsSync(ledgerPath), false);
});

test('paper intent creation runner blocks incomplete planner payload and writes nothing', () => {
  const ledgerPath = tmpLedger();

  const result = runPaperTradeIntentCreation({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'blocked'
    }
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.intentWouldBeCreated, false);
  assert.equal(result.intentCreated, false);
  assert.equal(result.wroteRecord, false);
  assert.deepEqual(result.creation.reasons, [
    'readiness_gate_blocked',
    'candidate_symbol_missing',
    'action_not_tradeable',
    'entry_price_missing'
  ]);
  assert.equal(fs.existsSync(ledgerPath), false);
});

test('paper intent creation runner writes one local JSONL record only when planner is fully ready', () => {
  const ledgerPath = tmpLedger();

  const result = runPaperTradeIntentCreation({
    ledgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'MSFT',
      action: 'sell',
      entryPrice: 222.22
    }
  });

  assert.equal(result.status, 'created');
  assert.equal(result.intentWouldBeCreated, true);
  assert.equal(result.intentCreated, true);
  assert.equal(result.wroteRecord, true);
  assert.equal(result.recordCount, 1);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.accountMutation, false);
  assert.equal(result.safety.localJsonlOnly, true);

  const records = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length, 1);
  assert.equal(records[0].symbol, 'MSFT');
  assert.equal(records[0].action, 'sell');
  assert.equal(records[0].entryPrice, 222.22);
  assert.equal(records[0].brokerContact, false);
  assert.equal(records[0].accountMutation, false);
});
