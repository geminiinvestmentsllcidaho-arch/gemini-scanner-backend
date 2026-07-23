import fs from 'node:fs';
import path from 'node:path';

import { runPaperTradeLifecycle } from './paper_trade_lifecycle_runner.mjs';

export const PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_VERSION =
  'paper_trade_lifecycle_runner_audit_v1';

export const DEFAULT_PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_LEDGER_PATH =
  process.env.PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_LEDGER_PATH ||
  path.join(process.cwd(), 'runs', 'paper_trade_lifecycle_runner_audit.jsonl');

export function readPaperTradeLifecycleRunnerAuditRecords(
  ledgerPath = DEFAULT_PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_LEDGER_PATH
) {
  if (!fs.existsSync(ledgerPath)) return [];

  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function auditPaperTradeLifecycleRun(options = {}) {
  const auditLedgerPath =
    options.auditLedgerPath ||
    DEFAULT_PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_LEDGER_PATH;

  const now = options.now instanceof Date ? options.now : new Date();

  const run = runPaperTradeLifecycle({
    ...options,
    now
  });

  const record = {
    version: PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_VERSION,
    createdAt: now.toISOString(),
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    runnerVersion: run.version,
    mode: run.mode,
    status: run.status,
    lifecycleComplete: run.lifecycleComplete,
    lifecycleRecovered: run.lifecycleRecovered === true,
    lifecycleReplayNoop: run.lifecycleReplayNoop === true,
    intentCreated: run.intentCreated,
    ticketStored: run.ticketStored,
    fillStored: run.fillStored,
    positionStored: run.positionStored,
    wroteAnyRecord: run.wroteAnyRecord,
    paths: run.paths,
    stageStatuses: {
      intentCreation: run.stages.intentCreation?.status || 'unknown',
      orderTicketPreview: run.stages.orderTicketPreview?.status || 'unknown',
      orderTicketStore: run.stages.orderTicketStore?.status || 'unknown',
      fillSimulationPreview: run.stages.fillSimulationPreview?.status || 'unknown',
      fillSimulationStore: run.stages.fillSimulationStore?.status || 'unknown',
      positionStatePreview: run.stages.positionStatePreview?.status || 'unknown',
      positionStateStore: run.stages.positionStateStore?.status || 'unknown'
    },
    stageWrites: {
      intentCreation: run.stages.intentCreation?.wroteRecord === true,
      orderTicketStore: run.stages.orderTicketStore?.wroteRecord === true,
      fillSimulationStore: run.stages.fillSimulationStore?.wroteRecord === true,
      positionStateStore: run.stages.positionStateStore?.wroteRecord === true
    },
    recovery: {
      recovered: run.lifecycleRecovered === true,
      replayNoop: run.lifecycleReplayNoop === true,
      resumedFromIntent:
        run.stages.intentCreation?.creation?.duplicateReason ===
        'intent_already_created',
      resumedFromTicket:
        run.stages.orderTicketStore?.duplicateReason ===
        'source_intent_already_ticketed',
      resumedFromFill:
        run.stages.fillSimulationStore?.duplicateReason ===
        'source_ticket_already_filled',
      positionAlreadyStored:
        run.stages.positionStateStore?.reason === 'position_state_already_stored'
    },
    latestIds: {
      intentId:
        run.stages.intentCreation?.creation?.record?.intentId ||
        run.stages.intentCreation?.creation?.intent?.intentId ||
        null,
      ticketId: run.stages.orderTicketStore?.record?.ticketId || null,
      fillId: run.stages.fillSimulationStore?.record?.fillId || null,
      positionSnapshotId: run.stages.positionStateStore?.record?.snapshotId || null
    },
    positionSummary: {
      positionCount: run.stages.positionStateStore?.record?.positionCount ?? 0,
      openPositionCount: run.stages.positionStateStore?.record?.openPositionCount ?? 0,
      totalCostBasis: run.stages.positionStateStore?.record?.totalCostBasis ?? 0,
      totalRealizedPnl: run.stages.positionStateStore?.record?.totalRealizedPnl ?? 0
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

  fs.mkdirSync(path.dirname(auditLedgerPath), { recursive: true });
  fs.appendFileSync(auditLedgerPath, `${JSON.stringify(record)}\n`);

  return {
    ok: true,
    version: PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    auditLedgerPath,
    wroteAuditRecord: true,
    auditRecordCount: readPaperTradeLifecycleRunnerAuditRecords(auditLedgerPath).length,
    run,
    auditRecord: record,
    safety: record.safety
  };
}

export function readPaperTradeLifecycleRunnerAuditDashboard(options = {}) {
  const auditLedgerPath =
    options.auditLedgerPath ||
    options.ledgerPath ||
    DEFAULT_PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_LEDGER_PATH;

  const records = readPaperTradeLifecycleRunnerAuditRecords(auditLedgerPath);
  const latestRecord = records.length ? records[records.length - 1] : null;

  return {
    ok: true,
    version: PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
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
