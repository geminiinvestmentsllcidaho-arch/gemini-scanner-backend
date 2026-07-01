import fs from "node:fs";
import path from "node:path";
import { buildMarketClosedSnapshotDiagnostics } from "./market_closed_scanner_snapshot_diagnostics.mjs";

const VERSION = "market_closed_scanner_snapshot_store_v1";
const DEFAULT_LEDGER = path.join(process.cwd(), "runs", "market_closed_scanner_snapshot_store.jsonl");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeString(value, max = 120) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, max);
}

function limitArray(value, max = 5) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

export function buildMarketClosedSnapshotStoreRecord(source = {}, options = {}) {
  const diag = isObject(source) && source.ok === true ? source : buildMarketClosedSnapshotDiagnostics({ skipScriptCheck: true });
  const scanner = isObject(diag.scanner) ? diag.scanner : {};
  const top = limitArray(scanner.top, 5);
  const topSymbols = top.map((item) => isObject(item) ? safeString(item.symbol, 20) : safeString(item, 20)).filter(Boolean);

  return {
    ok: true,
    version: VERSION,
    ts: safeString(options.nowIso, 64) || new Date().toISOString(),
    monitorOnly: true,
    diagnosticsOnly: true,
    localStoreOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
    sourceVersion: safeString(diag.version, 80),
    displayState: safeString(diag.displayState, 40) || "CAUTION",
    scannerHealth: safeString(scanner.scannerHealth, 40),
    rankingConfidence: Number.isFinite(scanner.rankingConfidence) ? scanner.rankingConfidence : null,
    totalRankings: Number.isFinite(scanner.totalRankings) ? scanner.totalRankings : 0,
    topSymbols,
    issues: limitArray(diag.issues, 10).map(x => safeString(x, 80)).filter(Boolean)
  };
}

export function appendMarketClosedSnapshotRecord(source = {}, options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER;
  const record = buildMarketClosedSnapshotStoreRecord(source, options);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, JSON.stringify(record) + "\n", "utf8");
  return { ...record, ledgerPath, appended: true };
}
