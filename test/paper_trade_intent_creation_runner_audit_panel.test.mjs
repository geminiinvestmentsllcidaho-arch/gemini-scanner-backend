import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { auditPaperTradeIntentCreationRun } from '../src/scanner/paper_trade_intent_creation_runner_audit.mjs';
import {
  PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_PANEL_VERSION,
  readPaperTradeIntentCreationRunnerAuditPanel
} from '../src/scanner/paper_trade_intent_creation_runner_audit_panel.mjs';

function tmpLedger(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), name)), 'ledger.jsonl');
}

test('paper intent creation runner audit panel reports empty state safely', () => {
  const auditLedgerPath = tmpLedger('paper-intent-creation-runner-audit-panel-empty-');
  const panel = readPaperTradeIntentCreationRunnerAuditPanel({ auditLedgerPath });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_PANEL_VERSION);
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'empty');
  assert.equal(panel.severity, 'neutral');
  assert.equal(panel.recordCount, 0);
  assert.equal(panel.summary.latestIntentCreated, false);
  assert.equal(panel.summary.latestWroteRecord, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.accountMutation, false);
  assert.equal(panel.safety.localJsonlOnly, true);
});

test('paper intent creation runner audit panel exposes latest blocked audit record', () => {
  const ledgerPath = tmpLedger('paper-intent-creation-runner-audit-panel-intent-');
  const auditLedgerPath = tmpLedger('paper-intent-creation-runner-audit-panel-');

  auditPaperTradeIntentCreationRun({
    ledgerPath,
    auditLedgerPath,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'blocked'
    }
  });

  const panel = readPaperTradeIntentCreationRunnerAuditPanel({ auditLedgerPath });

  assert.equal(panel.status, 'blocked');
  assert.equal(panel.severity, 'blocked');
  assert.equal(panel.recordCount, 1);
  assert.equal(panel.summary.latestIntentCreated, false);
  assert.equal(panel.summary.latestWroteRecord, false);
  assert.deepEqual(panel.summary.latestReasons, [
    'readiness_gate_blocked',
    'candidate_symbol_missing',
    'action_not_tradeable',
    'entry_price_missing'
  ]);
});

test('paper intent creation runner audit panel exposes latest created audit record', () => {
  const ledgerPath = tmpLedger('paper-intent-creation-runner-audit-panel-intent-');
  const auditLedgerPath = tmpLedger('paper-intent-creation-runner-audit-panel-');

  auditPaperTradeIntentCreationRun({
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

  const panel = readPaperTradeIntentCreationRunnerAuditPanel({ auditLedgerPath });

  assert.equal(panel.status, 'created');
  assert.equal(panel.severity, 'info');
  assert.equal(panel.recordCount, 1);
  assert.equal(panel.summary.latestIntentCreated, true);
  assert.equal(panel.summary.latestWroteRecord, true);
  assert.equal(panel.summary.latestSymbol, 'AAPL');
  assert.equal(panel.summary.latestAction, 'buy');
  assert.equal(panel.summary.latestEntryPrice, 123.45);
});
