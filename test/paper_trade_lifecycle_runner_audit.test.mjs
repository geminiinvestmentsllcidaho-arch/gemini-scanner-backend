import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_VERSION,
  auditPaperTradeLifecycleRun,
  readPaperTradeLifecycleRunnerAuditDashboard,
  readPaperTradeLifecycleRunnerAuditRecords
} from '../src/scanner/paper_trade_lifecycle_runner_audit.mjs';
import {
  PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_PANEL_VERSION,
  readPaperTradeLifecycleRunnerAuditPanel
} from '../src/scanner/paper_trade_lifecycle_runner_audit_panel.mjs';

function tmpLedger(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), name)), 'ledger.jsonl');
}

function paths() {
  return {
    auditLedgerPath: tmpLedger('paper-lifecycle-audit-'),
    intentLedgerPath: tmpLedger('paper-lifecycle-audit-intent-'),
    ticketLedgerPath: tmpLedger('paper-lifecycle-audit-ticket-'),
    fillLedgerPath: tmpLedger('paper-lifecycle-audit-fill-'),
    positionLedgerPath: tmpLedger('paper-lifecycle-audit-position-')
  };
}

test('paper lifecycle runner audit records blocked lifecycle safely', () => {
  const p = paths();

  const result = auditPaperTradeLifecycleRun({
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'blocked'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_VERSION);
  assert.equal(result.wroteAuditRecord, true);
  assert.equal(result.auditRecordCount, 1);
  assert.equal(result.auditRecord.status, 'blocked_or_partial');
  assert.equal(result.auditRecord.lifecycleComplete, false);
  assert.equal(result.auditRecord.intentCreated, false);
  assert.equal(result.auditRecord.ticketStored, false);
  assert.equal(result.auditRecord.fillStored, false);
  assert.equal(result.auditRecord.positionStored, false);
  assert.equal(result.auditRecord.wroteAnyRecord, false);
  assert.equal(fs.existsSync(p.auditLedgerPath), true);
  assert.equal(fs.existsSync(p.intentLedgerPath), false);
  assert.equal(fs.existsSync(p.ticketLedgerPath), false);
  assert.equal(fs.existsSync(p.fillLedgerPath), false);
  assert.equal(fs.existsSync(p.positionLedgerPath), false);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
});

test('paper lifecycle runner audit records complete local simulation safely', () => {
  const p = paths();

  const result = auditPaperTradeLifecycleRun({
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPrice: 101,
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1,
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 100
    }
  });

  assert.equal(result.auditRecord.status, 'complete_local_simulation');
  assert.equal(result.auditRecord.lifecycleComplete, true);
  assert.equal(result.auditRecord.intentCreated, true);
  assert.equal(result.auditRecord.ticketStored, true);
  assert.equal(result.auditRecord.fillStored, true);
  assert.equal(result.auditRecord.positionStored, true);
  assert.equal(result.auditRecord.wroteAnyRecord, true);
  assert.ok(result.auditRecord.latestIds.intentId);
  assert.ok(result.auditRecord.latestIds.ticketId);
  assert.ok(result.auditRecord.latestIds.fillId);
  assert.ok(result.auditRecord.latestIds.positionSnapshotId);
  assert.equal(result.auditRecord.positionSummary.openPositionCount, 1);
  assert.equal(result.auditRecord.positionSummary.totalCostBasis, 1010);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);

  const records = readPaperTradeLifecycleRunnerAuditRecords(p.auditLedgerPath);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'complete_local_simulation');
});

test('paper lifecycle runner audit dashboard and panel expose latest record safely', () => {
  const p = paths();

  auditPaperTradeLifecycleRun({
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'blocked'
    }
  });

  const dashboard = readPaperTradeLifecycleRunnerAuditDashboard({
    auditLedgerPath: p.auditLedgerPath
  });
  const panel = readPaperTradeLifecycleRunnerAuditPanel({
    auditLedgerPath: p.auditLedgerPath
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_VERSION);
  assert.equal(dashboard.recordCount, 1);
  assert.equal(dashboard.latestStatus, 'blocked_or_partial');
  assert.equal(dashboard.safety.brokerContact, false);
  assert.equal(dashboard.safety.orderPlacement, false);

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_PANEL_VERSION);
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.status, 'blocked_or_partial');
  assert.equal(panel.severity, 'blocked');
  assert.equal(panel.summary.lifecycleComplete, false);
  assert.equal(panel.summary.wroteAnyRecord, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.accountMutation, false);
});
