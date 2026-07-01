import fs from "node:fs";
import path from "node:path";

export const VERSION = "market_closed_scanner_snapshot_store_reader_v1";
export const PANEL_VERSION = "market_closed_scanner_snapshot_store_panel_v1";

function clampLimit(value = 25) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 25;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isStoreFile(name) {
  const s = String(name || "").toLowerCase();
  return s.endsWith(".json")
    && s.includes("market")
    && s.includes("closed")
    && s.includes("scanner")
    && s.includes("snapshot")
    && s.includes("store");
}

function recordsFrom(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.records)) return parsed.records;
  if (Array.isArray(parsed?.appends)) return parsed.appends;
  if (Array.isArray(parsed?.snapshots)) return parsed.snapshots;
  return parsed && typeof parsed === "object" ? [parsed] : [];
}

function listStoreFiles(storeDir) {
  if (!fs.existsSync(storeDir)) return [];
  return fs.readdirSync(storeDir)
    .filter(isStoreFile)
    .map((file) => {
      const fullPath = path.join(storeDir, file);
      const st = fs.statSync(fullPath);
      return { file, fullPath, mtimeMs: st.mtimeMs, sizeBytes: st.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.file.localeCompare(a.file));
}

function readRecords(file) {
  const raw = fs.readFileSync(file.fullPath, "utf8").trim();
  if (!raw) return [];
  try {
    return recordsFrom(JSON.parse(raw));
  } catch {
    return raw.split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try { return recordsFrom(JSON.parse(line)); }
        catch { return []; }
      });
  }
}

function recordTime(record, file) {
  const value = record?.ts
    || record?.time
    || record?.timestamp
    || record?.createdAt
    || record?.appendedAt
    || record?.sourceTs
    || file.mtimeMs;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : file.mtimeMs;
}

function safetyFlag(record, key, defaultValue = false) {
  if (record?.[key] === true) return true;
  if (record?.safety?.[key] === true) return true;
  if (record?.[key] === false) return false;
  if (record?.safety?.[key] === false) return false;
  return defaultValue;
}

function summarizeRecord(record, file, index) {
  const rankings = safeArray(record?.rankings).length
    ? safeArray(record.rankings)
    : safeArray(record?.scannerRankings);
  const issues = safeArray(record?.issues).length
    ? safeArray(record.issues)
    : safeArray(record?.safetyIssues);

  return {
    index,
    file: file.file,
    ts: new Date(recordTime(record, file)).toISOString(),
    recordId: record?.recordId || record?.id || null,
    status: record?.status || record?.displayState || "stored",
    session: record?.session || record?.scannerSession || "unknown",
    rankingCount: rankings.length,
    topSymbols: rankings.slice(0, 5).map((item) => item?.symbol).filter(Boolean),
    issueCount: issues.length,
    issues: issues.slice(0, 10),
    safety: {
      localStoreOnly: safetyFlag(record, "localStoreOnly", true) !== false,
      orderPlacementAllowed: safetyFlag(record, "orderPlacementAllowed"),
      brokerContactAllowed: safetyFlag(record, "brokerContactAllowed"),
      liveTradingAllowed: safetyFlag(record, "liveTradingAllowed"),
      autoTradingAllowed: safetyFlag(record, "autoTradingAllowed"),
      accountMutationAllowed: safetyFlag(record, "accountMutationAllowed")
    }
  };
}

export function getStoreHistory(options = {}) {
  const storeDir = options.storeDir || path.join(process.cwd(), "runs");
  const max = clampLimit(options.limit);
  const files = listStoreFiles(storeDir);
  const records = [];
  const errors = [];

  for (const file of files) {
    if (records.length >= max) break;
    try {
      for (const record of readRecords(file)) {
        if (records.length >= max) break;
        records.push(summarizeRecord(record, file, records.length));
      }
    } catch (err) {
      errors.push({ file: file.file, error: err?.message || String(err) });
    }
  }

  records.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));

  return {
    ok: true,
    version: VERSION,
    readerType: "market_closed_snapshot_store_history",
    reviewOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    noExecutionControls: true,
    localStoreOnly: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    storeDir,
    filesScanned: files.length,
    recordCount: records.length,
    errorCount: errors.length,
    limit: max,
    records,
    errors,
    ts: new Date().toISOString()
  };
}

export function getStorePanel(options = {}) {
  const history = getStoreHistory(options);
  const unsafeRecords = history.records.filter((record) => (
    record.safety.orderPlacementAllowed
    || record.safety.brokerContactAllowed
    || record.safety.liveTradingAllowed
    || record.safety.autoTradingAllowed
    || record.safety.accountMutationAllowed
  ));

  return {
    ok: true,
    version: PANEL_VERSION,
    panelType: "operator_dashboard_card",
    title: "Market Closed Scanner Snapshot Store",
    status: history.recordCount > 0 ? "store_ready_local_history" : "store_empty_local_history",
    displayState: unsafeRecords.length > 0 ? "NO_GO_SAFETY_FLAG_DRIFT" : "READ_ONLY",
    severity: unsafeRecords.length > 0 ? "blocked" : "info",
    finalDecision: "NO_ORDER_PLACEMENT_DIAGNOSTICS_ONLY",
    readyForOrderPlacement: false,
    reviewOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    noExecutionControls: true,
    localStoreOnly: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    historySummary: {
      filesScanned: history.filesScanned,
      recordCount: history.recordCount,
      errorCount: history.errorCount,
      limit: history.limit
    },
    latest: history.records[0] || null,
    records: history.records,
    safetyFlagDriftCount: unsafeRecords.length,
    ts: new Date().toISOString()
  };
}
