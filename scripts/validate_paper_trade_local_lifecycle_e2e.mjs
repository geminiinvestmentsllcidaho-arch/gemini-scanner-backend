import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { auditPaperTradeLifecycleRun } from '../src/scanner/paper_trade_lifecycle_runner_audit.mjs';

function tmpLedger(prefix) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), prefix)), 'ledger.jsonl');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildPaths(prefix) {
  return {
    auditLedgerPath: tmpLedger(`${prefix}-audit-`),
    intentLedgerPath: tmpLedger(`${prefix}-intent-`),
    ticketLedgerPath: tmpLedger(`${prefix}-ticket-`),
    fillLedgerPath: tmpLedger(`${prefix}-fill-`),
    positionLedgerPath: tmpLedger(`${prefix}-position-`)
  };
}

function ledgerExists(filePath) {
  return fs.existsSync(filePath);
}

function countLedger(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).length;
}

const blockedPaths = buildPaths('paper-local-e2e-blocked');
const completePaths = buildPaths('paper-local-e2e-complete');

const blocked = auditPaperTradeLifecycleRun({
  ...blockedPaths,
  now: new Date('2026-06-26T12:00:00.000Z'),
  plan: {
    readinessGateStatus: 'blocked'
  }
});

assert(blocked.ok === true, 'blocked e2e not ok');
assert(blocked.auditRecord.status === 'blocked_or_partial', 'blocked e2e status mismatch');
assert(blocked.auditRecord.lifecycleComplete === false, 'blocked e2e lifecycle unexpectedly complete');
assert(blocked.auditRecord.intentCreated === false, 'blocked e2e created intent');
assert(blocked.auditRecord.ticketStored === false, 'blocked e2e stored ticket');
assert(blocked.auditRecord.fillStored === false, 'blocked e2e stored fill');
assert(blocked.auditRecord.positionStored === false, 'blocked e2e stored position');
assert(blocked.auditRecord.wroteAnyRecord === false, 'blocked e2e wrote lifecycle record');
assert(ledgerExists(blockedPaths.auditLedgerPath) === true, 'blocked e2e audit ledger missing');
assert(ledgerExists(blockedPaths.intentLedgerPath) === false, 'blocked e2e intent ledger exists');
assert(ledgerExists(blockedPaths.ticketLedgerPath) === false, 'blocked e2e ticket ledger exists');
assert(ledgerExists(blockedPaths.fillLedgerPath) === false, 'blocked e2e fill ledger exists');
assert(ledgerExists(blockedPaths.positionLedgerPath) === false, 'blocked e2e position ledger exists');

const complete = auditPaperTradeLifecycleRun({
  ...completePaths,
  now: new Date('2026-06-26T12:01:00.000Z'),
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

assert(complete.ok === true, 'complete e2e not ok');
assert(complete.auditRecord.status === 'complete_local_simulation', 'complete e2e status mismatch');
assert(complete.auditRecord.lifecycleComplete === true, 'complete e2e lifecycle not complete');
assert(complete.auditRecord.intentCreated === true, 'complete e2e did not create intent');
assert(complete.auditRecord.ticketStored === true, 'complete e2e did not store ticket');
assert(complete.auditRecord.fillStored === true, 'complete e2e did not store fill');
assert(complete.auditRecord.positionStored === true, 'complete e2e did not store position');
assert(complete.auditRecord.wroteAnyRecord === true, 'complete e2e did not write records');
assert(complete.auditRecord.positionSummary.openPositionCount === 1, 'complete e2e open position mismatch');
assert(complete.auditRecord.positionSummary.totalCostBasis === 1010, 'complete e2e cost basis mismatch');
assert(complete.auditRecord.safety.brokerContact === false, 'complete e2e broker contact safety failed');
assert(complete.auditRecord.safety.orderPlacement === false, 'complete e2e order placement safety failed');
assert(complete.auditRecord.safety.accountMutation === false, 'complete e2e account mutation safety failed');

for (const filePath of Object.values(completePaths)) {
  assert(ledgerExists(filePath) === true, `complete e2e missing ledger ${filePath}`);
  assert(countLedger(filePath) === 1, `complete e2e ledger count mismatch ${filePath}`);
}

const result = {
  ok: true,
  version: 'paper_trade_local_lifecycle_e2e_validation_v1',
  monitorOnly: true,
  paperOnly: true,
  blocked: {
    status: blocked.auditRecord.status,
    lifecycleComplete: blocked.auditRecord.lifecycleComplete,
    wroteAnyRecord: blocked.auditRecord.wroteAnyRecord,
    auditRecords: countLedger(blockedPaths.auditLedgerPath),
    intentRecords: countLedger(blockedPaths.intentLedgerPath),
    ticketRecords: countLedger(blockedPaths.ticketLedgerPath),
    fillRecords: countLedger(blockedPaths.fillLedgerPath),
    positionRecords: countLedger(blockedPaths.positionLedgerPath)
  },
  complete: {
    status: complete.auditRecord.status,
    lifecycleComplete: complete.auditRecord.lifecycleComplete,
    wroteAnyRecord: complete.auditRecord.wroteAnyRecord,
    auditRecords: countLedger(completePaths.auditLedgerPath),
    intentRecords: countLedger(completePaths.intentLedgerPath),
    ticketRecords: countLedger(completePaths.ticketLedgerPath),
    fillRecords: countLedger(completePaths.fillLedgerPath),
    positionRecords: countLedger(completePaths.positionLedgerPath),
    openPositionCount: complete.auditRecord.positionSummary.openPositionCount,
    totalCostBasis: complete.auditRecord.positionSummary.totalCostBasis,
    totalRealizedPnl: complete.auditRecord.positionSummary.totalRealizedPnl
  },
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

console.log(JSON.stringify(result, null, 2));
