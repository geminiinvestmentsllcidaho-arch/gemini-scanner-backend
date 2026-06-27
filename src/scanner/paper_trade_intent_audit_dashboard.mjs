import * as auditDashboardFs from "node:fs";
import * as auditDashboardPath from "node:path";
import fs from 'node:fs';
import path from 'node:path';

const PAPER_TRADE_INTENT_AUDIT_DASHBOARD_LEDGER_PATH = auditDashboardPath.resolve(process.cwd(), "runs", "paper_trade_intent_audit_store.jsonl");

function getPaperTradeIntentAuditDashboardLedgerRecordCount(filePath = PAPER_TRADE_INTENT_AUDIT_DASHBOARD_LEDGER_PATH) {
  try {
    if (!auditDashboardFs.existsSync(filePath)) return 0;
    const raw = auditDashboardFs.readFileSync(filePath, "utf8").trim();
    if (!raw) return 0;
    return raw.split(/\r?\n/).filter(Boolean).length;
  } catch {
    return 0;
  }
}


export const PAPER_TRADE_INTENT_AUDIT_DASHBOARD_VERSION = 'paper_trade_intent_audit_dashboard_v1';
export const DEFAULT_PAPER_TRADE_INTENT_AUDIT_LEDGER = path.join(process.cwd(), 'runs', 'paper_trade_intent_audit_store.jsonl');

function safeParseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function normalizeReasons(record) {
  const direct = record?.latestReasons ?? record?.reasons ?? record?.blockReasons ?? record?.blockReason;
  if (Array.isArray(direct)) return direct.filter(Boolean).map(String);
  if (typeof direct === 'string' && direct.trim()) return [direct.trim()];

  const nested = record?.dashboard?.latestReasons ?? record?.planner?.blockReasons ?? record?.snapshot?.latestReasons;
  if (Array.isArray(nested)) return nested.filter(Boolean).map(String);
  if (typeof nested === 'string' && nested.trim()) return [nested.trim()];

  return [];
}

function normalizeStatus(record) {
  const status =
    record?.latestStatus ??
    record?.status ??
    record?.paperTradeIntentStatus ??
    record?.dashboard?.latestStatus ??
    record?.dashboard?.paperTradeIntentStatus ??
    record?.planner?.paperTradeIntentStatus ??
    record?.snapshot?.latestStatus;

  if (typeof status === 'string' && status.trim()) return status.trim();

  const blocked =
    record?.blocked ??
    record?.dashboard?.blocked ??
    record?.planner?.blocked ??
    record?.snapshot?.blocked;

  if (blocked === true) return 'blocked';
  if (blocked === false) return 'clear';

  return 'unknown';
}

function normalizeTs(record) {
  const ts =
    record?.ts ??
    record?.timestamp ??
    record?.createdAt ??
    record?.recordedAt ??
    record?.dashboard?.ts ??
    record?.planner?.ts ??
    record?.snapshot?.ts;

  return typeof ts === 'string' && ts.trim() ? ts.trim() : null;
}

export function buildPaperTradeIntentAuditDashboard(input = {}) {
  const ledgerPath = input.ledgerPath ?? DEFAULT_PAPER_TRADE_INTENT_AUDIT_LEDGER;
  const recentLimit = Number.isFinite(input.recentLimit) ? Math.max(1, Math.min(250, Math.trunc(input.recentLimit))) : 25;

  const exists = fs.existsSync(ledgerPath);
  const raw = exists ? fs.readFileSync(ledgerPath, 'utf8') : '';
  const records = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(safeParseJsonLine)
    .filter(Boolean);

  const normalized = records.map((record, index) => ({
    index,
    ts: normalizeTs(record),
    status: normalizeStatus(record),
    reasons: normalizeReasons(record),
    monitorOnly: record?.monitorOnly !== false,
    raw: record,
  }));

  const latest = normalized.at(-1) ?? null;
  const recentRecords = normalized.slice(-recentLimit).reverse();

  const statusCounts = normalized.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  const reasonCounts = normalized.reduce((acc, item) => {
    for (const reason of item.reasons) acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_AUDIT_DASHBOARD_VERSION,
    monitorOnly: true,
    route: '/diagnostics/paper-trade-intent-audit-dashboard',
    ledger: {
      path: path.relative(process.cwd(), ledgerPath),
      exists,
      recordCount: normalized.length,
    },
    latestStatus: latest?.status ?? 'none',
    latestReasons: latest?.reasons ?? [],
    latestTs: latest?.ts ?? null,
    statusCounts,
    reasonCounts,
    recentRecords,
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
    },
  };
}

export default buildPaperTradeIntentAuditDashboard;
