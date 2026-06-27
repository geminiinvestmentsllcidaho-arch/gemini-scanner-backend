import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_VERSION,
  auditPaperTradeIntentCreationRun,
  readPaperTradeIntentCreationRunnerAuditDashboard,
  readPaperTradeIntentCreationRunnerAuditRecords
} from '../src/scanner/paper_trade_intent_creation_runner_audit.mjs';

function tmpLedger(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), name)), 'ledger.jsonl');
}

test('paper intent creation runner audit records blocked runner check without creating intent ledger', () => {
  const ledgerPath = tmpLedger('paper-intent-creation-runner-audit-intent-');
  const auditLedgerPath = tmpLedger('paper-intent-creation-runner-audit-');

  const result = auditPaperTradeIntentCreationRun({
    ledgerPath,
    auditLedgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'blocked'
    }
  });

  assert.equal(result.version, PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.wroteAuditRecord, true);
  assert.equal(result.auditRecordCount, 1);
  assert.equal(result.runner.status, 'blocked');
  assert.equal(result.runner.intentCreated, false);
  assert.equal(result.runner.wroteRecord, false);
  assert.equal(fs.existsSync(ledgerPath), false);
  assert.equal(fs.existsSync(auditLedgerPath), true);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.accountMutation, false);
  assert.equal(result.safety.localJsonlOnly, true);

  const records = readPaperTradeIntentCreationRunnerAuditRecords(auditLedgerPath);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'blocked');
  assert.equal(records[0].intentCreated, false);
  assert.equal(records[0].wroteRecord, false);
});

test('paper intent creation runner audit records created local intent when all gates pass', () => {
  const ledgerPath = tmpLedger('paper-intent-creation-runner-audit-intent-');
  const auditLedgerPath = tmpLedger('paper-intent-creation-runner-audit-');

  const result = auditPaperTradeIntentCreationRun({
    ledgerPath,
    auditLedgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 123.45
    }
  });

  assert.equal(result.runner.status, 'created');
  assert.equal(result.runner.intentCreated, true);
  assert.equal(result.runner.wroteRecord, true);
  assert.equal(result.auditRecord.status, 'created');
  assert.equal(result.auditRecord.intentCreated, true);
  assert.equal(result.auditRecord.wroteRecord, true);
  assert.ok(result.auditRecord.createdIntentId);
  assert.equal(result.auditRecord.normalized.symbol, 'AAPL');

  const intentRecords = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(intentRecords.length, 1);

  const auditRecords = readPaperTradeIntentCreationRunnerAuditRecords(auditLedgerPath);
  assert.equal(auditRecords.length, 1);
  assert.equal(auditRecords[0].status, 'created');
});

test('paper intent creation runner audit dashboard exposes latest local audit record', () => {
  const ledgerPath = tmpLedger('paper-intent-creation-runner-audit-intent-');
  const auditLedgerPath = tmpLedger('paper-intent-creation-runner-audit-');

  auditPaperTradeIntentCreationRun({
    ledgerPath,
    auditLedgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'blocked'
    }
  });

  const dashboard = readPaperTradeIntentCreationRunnerAuditDashboard({
    auditLedgerPath
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_VERSION);
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.recordCount, 1);
  assert.equal(dashboard.hasRecords, true);
  assert.equal(dashboard.latestStatus, 'blocked');
  assert.equal(dashboard.latestRecord.status, 'blocked');
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.accountMutation, false);
});
