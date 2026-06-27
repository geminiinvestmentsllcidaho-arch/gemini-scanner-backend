import fs from "node:fs";
import path from "node:path";

export const PAPER_TRADE_INTENT_AUDIT_STORE_VERSION = "paper_trade_intent_audit_store_v1";

export function getDefaultPaperTradeIntentAuditPath({ cwd = process.cwd() } = {}) {
  return path.join(cwd, "runs", "paper_trade_intent_audit_store.jsonl");
}

function safeJsonValue(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function normalizeReasons(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .map((reason) => String(reason || "").trim())
    .filter(Boolean);
}

export function createPaperTradeIntentAuditRecord({
  type = "snapshot",
  source = "unknown",
  plannerSnapshot = null,
  dashboardSnapshot = null,
  paperIntent = null,
  status = "unknown",
  reasons = [],
  meta = {},
  nowIso = new Date().toISOString(),
} = {}) {
  return {
    ok: true,
    version: PAPER_TRADE_INTENT_AUDIT_STORE_VERSION,
    monitorOnly: true,
    safety: {
      noOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noBrokerExecution: true,
      noAccountMutation: true,
    },
    recordType: String(type || "snapshot"),
    source: String(source || "unknown"),
    status: String(status || "unknown"),
    reasons: normalizeReasons(reasons),
    plannerSnapshot: safeJsonValue(plannerSnapshot),
    dashboardSnapshot: safeJsonValue(dashboardSnapshot),
    paperIntent: safeJsonValue(paperIntent),
    meta: safeJsonValue(meta),
    createdAt: nowIso,
  };
}

export function appendPaperTradeIntentAuditRecord(record, {
  auditPath = getDefaultPaperTradeIntentAuditPath(),
} = {}) {
  const finalRecord = {
    ...record,
    version: record?.version || PAPER_TRADE_INTENT_AUDIT_STORE_VERSION,
    monitorOnly: true,
  };

  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify(finalRecord)}\n`, "utf8");

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_AUDIT_STORE_VERSION,
    monitorOnly: true,
    auditPath,
    record: finalRecord,
  };
}

export function recordPaperTradeIntentSnapshot({
  plannerSnapshot = null,
  dashboardSnapshot = null,
  paperIntent = null,
  source = "paper_trade_intent_audit_store",
  status,
  reasons,
  meta = {},
  auditPath = getDefaultPaperTradeIntentAuditPath(),
  nowIso = new Date().toISOString(),
} = {}) {
  const inferredStatus =
    status ||
    dashboardSnapshot?.paperTradeIntentStatus ||
    dashboardSnapshot?.readinessGateStatus ||
    plannerSnapshot?.paperTradeIntentStatus ||
    plannerSnapshot?.readinessGateStatus ||
    "unknown";

  const inferredReasons =
    reasons ||
    dashboardSnapshot?.blockReasons ||
    dashboardSnapshot?.reasons ||
    plannerSnapshot?.blockReasons ||
    plannerSnapshot?.reasons ||
    [];

  const record = createPaperTradeIntentAuditRecord({
    type: paperIntent ? "paper_intent" : "snapshot",
    source,
    plannerSnapshot,
    dashboardSnapshot,
    paperIntent,
    status: inferredStatus,
    reasons: inferredReasons,
    meta,
    nowIso,
  });

  return appendPaperTradeIntentAuditRecord(record, { auditPath });
}

export function readPaperTradeIntentAuditRecords({
  auditPath = getDefaultPaperTradeIntentAuditPath(),
  limit = 50,
} = {}) {
  if (!fs.existsSync(auditPath)) {
    return {
      ok: true,
      version: PAPER_TRADE_INTENT_AUDIT_STORE_VERSION,
      monitorOnly: true,
      auditPath,
      exists: false,
      records: [],
      totalRecords: 0,
      malformedRecords: 0,
    };
  }

  const raw = fs.readFileSync(auditPath, "utf8");
  const lines = raw.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  const records = [];
  let malformedRecords = 0;

  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      malformedRecords += 1;
    }
  }

  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 50;

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_AUDIT_STORE_VERSION,
    monitorOnly: true,
    auditPath,
    exists: true,
    records: safeLimit === 0 ? [] : records.slice(-safeLimit),
    totalRecords: records.length,
    malformedRecords,
  };
}

export function getPaperTradeIntentAuditSummary({
  auditPath = getDefaultPaperTradeIntentAuditPath(),
  limit = 10,
} = {}) {
  const readResult = readPaperTradeIntentAuditRecords({ auditPath, limit });
  const latestRecord = readResult.records.at(-1) || null;

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_AUDIT_STORE_VERSION,
    monitorOnly: true,
    auditPath,
    exists: readResult.exists,
    totalRecords: readResult.totalRecords,
    malformedRecords: readResult.malformedRecords,
    latestStatus: latestRecord?.status || null,
    latestRecordType: latestRecord?.recordType || null,
    latestCreatedAt: latestRecord?.createdAt || null,
    latestReasons: latestRecord?.reasons || [],
    records: readResult.records,
    safety: {
      noOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noBrokerExecution: true,
      noAccountMutation: true,
    },
  };
}
