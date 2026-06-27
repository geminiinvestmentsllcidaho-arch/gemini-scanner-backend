import fs from 'node:fs';
import path from 'node:path';

import { runPaperTradeIntentCreation } from './paper_trade_intent_creation_runner.mjs';

export const PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_VERSION =
  'paper_trade_intent_creation_runner_audit_v1';

export const DEFAULT_PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_LEDGER_PATH =
  process.env.PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_LEDGER_PATH ||
  path.join(process.cwd(), 'runs', 'paper_trade_intent_creation_runner_audit.jsonl');

export function readPaperTradeIntentCreationRunnerAuditRecords(
  ledgerPath = DEFAULT_PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_LEDGER_PATH
) {
  if (!fs.existsSync(ledgerPath)) return [];

  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function auditPaperTradeIntentCreationRun(options = {}) {
  const auditLedgerPath =
    options.auditLedgerPath ||
    DEFAULT_PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_LEDGER_PATH;

  const result = runPaperTradeIntentCreation(options);

  const record = {
    version: PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_VERSION,
    ts:
      options.now instanceof Date
        ? options.now.toISOString()
        : new Date().toISOString(),
    monitorOnly: true,
    runnerVersion: result.version,
    status: result.status,
    intentWouldBeCreated: result.intentWouldBeCreated,
    intentCreated: result.intentCreated,
    wroteRecord: result.wroteRecord,
    recordCount: result.recordCount ?? 0,
    ledgerPath: result.ledgerPath,
    plannerStatus: result.plannerStatus,
    plannerReasons: result.plannerReasons,
    creationReasons: result.creation?.reasons || [],
    normalized: result.creation?.normalized || {},
    createdIntentId: result.creation?.record?.intentId || null,
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

  fs.mkdirSync(path.dirname(auditLedgerPath), { recursive: true });
  fs.appendFileSync(auditLedgerPath, `${JSON.stringify(record)}\n`);

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_VERSION,
    monitorOnly: true,
    auditLedgerPath,
    wroteAuditRecord: true,
    auditRecordCount:
      readPaperTradeIntentCreationRunnerAuditRecords(auditLedgerPath).length,
    runner: result,
    auditRecord: record,
    safety: record.safety
  };
}

export function readPaperTradeIntentCreationRunnerAuditDashboard(options = {}) {
  const auditLedgerPath =
    options.auditLedgerPath ||
    DEFAULT_PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_LEDGER_PATH;

  const records =
    readPaperTradeIntentCreationRunnerAuditRecords(auditLedgerPath);
  const latestRecord = records.length ? records[records.length - 1] : null;

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_VERSION,
    monitorOnly: true,
    auditLedgerPath,
    recordCount: records.length,
    hasRecords: records.length > 0,
    latestStatus: latestRecord?.status || 'empty',
    latestRecord,
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
