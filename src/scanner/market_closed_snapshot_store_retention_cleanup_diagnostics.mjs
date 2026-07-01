import fs from "node:fs";
import path from "node:path";

export const VERSION = "market_closed_snapshot_store_retention_cleanup_diagnostics_v1";

function n(v, d, min = 1, max = 10000) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(min, Math.min(max, Math.trunc(x))) : d;
}

function iso(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function tsFromName(name) {
  const s = String(name);
  const e = s.match(/(?:^|[^0-9])([1-9][0-9]{12})(?:[^0-9]|$)/);
  if (e) return Number(e[1]);
  const m = s.match(/([0-9]{4})[-_]?([0-9]{2})[-_]?([0-9]{2})(?:[T_-]?([0-9]{2})[-_]?([0-9]{2})[-_]?([0-9]{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  const t = Date.parse(`${y}-${mo}-${d}T${hh}:${mm}:${ss}.000Z`);
  return Number.isFinite(t) ? t : null;
}

function storeDir(opt = {}) {
  if (opt.storeDir || process.env.MARKET_CLOSED_SCANNER_SNAPSHOT_STORE_DIR) {
    return path.resolve(opt.storeDir || process.env.MARKET_CLOSED_SCANNER_SNAPSHOT_STORE_DIR);
  }
  const dirs = [
    "runs/market_closed_scanner_snapshot_store",
    "runs/market_closed_scanner_snapshot_store_v1",
    "runs/market_closed_scanner_snapshots",
    "runs/market_closed_snapshot_store",
    "runs/scanner_snapshots"
  ].map((p) => path.resolve(p));
  return dirs.find((d) => fs.existsSync(d)) || dirs[0];
}

function files(root, max = 2000) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const stack = [{ d: root, depth: 0 }];
  while (stack.length && out.length < max) {
    const cur = stack.pop();
    let es = [];
    try { es = fs.readdirSync(cur.d, { withFileTypes: true }); } catch { continue; }
    for (const e of es.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(cur.d, e.name);
      if (e.isDirectory() && cur.depth < 2 && !e.name.startsWith(".")) stack.push({ d: p, depth: cur.depth + 1 });
      if (!e.isFile()) continue;
      let st;
      try { st = fs.statSync(p); } catch { continue; }
      const snapMs = tsFromName(e.name) ?? st.mtimeMs;
      out.push({
        relativePath: path.relative(root, p).split(path.sep).join("/"),
        path: p.split(path.sep).join("/"),
        sizeBytes: st.size,
        snapshotTsMs: snapMs,
        snapshotTsIso: iso(snapMs),
        jsonLike: [".json", ".jsonl"].includes(path.extname(e.name).toLowerCase())
      });
      if (out.length >= max) break;
    }
  }
  return out;
}

export function buildMarketClosedSnapshotStoreRetentionCleanupDiagnostics(opt = {}) {
  const nowMs = Number.isFinite(Number(opt.nowMs)) ? Number(opt.nowMs) : Date.now();
  const retentionDays = n(opt.retentionDays ?? process.env.MARKET_CLOSED_SNAPSHOT_RETENTION_DAYS, 30, 1, 3650);
  const limit = n(opt.limit, 25, 1, 250);
  const maxScanFiles = n(opt.maxScanFiles, 2000, 1, 10000);
  const root = storeDir(opt);
  const all = files(root, maxScanFiles).sort((a, b) => b.snapshotTsMs - a.snapshotTsMs);
  const json = all.filter((f) => f.jsonLike);
  const cutoffMs = nowMs - retentionDays * 86400000;
  const old = json.filter((f) => f.snapshotTsMs < cutoffMs).sort((a, b) => a.snapshotTsMs - b.snapshotTsMs);
  const issues = [];
  if (!fs.existsSync(root)) issues.push("snapshot_store_directory_missing");
  if (old.length) issues.push("retention_cleanup_candidates_detected_read_only");
  if (all.length >= maxScanFiles) issues.push("max_scan_files_reached");
  return {
    ok: true,
    version: VERSION,
    status: "read_only_retention_cleanup_diagnostics",
    displayState: "READ_ONLY",
    finalDecision: "NO_DELETE_ACTION_TAKEN",
    diagnosticsOnly: true,
    monitorOnly: true,
    localStoreOnly: true,
    readOnly: true,
    noExecutionControls: true,
    orderPlacementAllowed: false,
    readyForOrderPlacement: false,
    cleanupDeletionAllowed: false,
    cleanupExecutionAllowed: false,
    deletionRequiresExplicitApproval: true,
    deleteCommandsGenerated: false,
    retentionPolicy: { retentionDays, cutoffMs, cutoffIso: iso(cutoffMs), maxScanFiles },
    store: {
      path: root.split(path.sep).join("/"),
      exists: fs.existsSync(root),
      fileCount: all.length,
      jsonFileCount: json.length,
      totalBytes: all.reduce((s, f) => s + f.sizeBytes, 0),
      jsonBytes: json.reduce((s, f) => s + f.sizeBytes, 0)
    },
    cleanupPreview: {
      candidateCount: old.length,
      candidateBytes: old.reduce((s, f) => s + f.sizeBytes, 0),
      deletionPerformed: false,
      deleteCommands: [],
      candidates: old.slice(0, limit).map((f) => ({
        relativePath: f.relativePath,
        sizeBytes: f.sizeBytes,
        snapshotTsIso: f.snapshotTsIso,
        ageDays: Math.max(0, Math.floor((nowMs - f.snapshotTsMs) / 86400000))
      }))
    },
    samples: { newestFiles: all.slice(0, limit).map((f) => ({ relativePath: f.relativePath, sizeBytes: f.sizeBytes, snapshotTsIso: f.snapshotTsIso })) },
    issues,
    generatedAt: iso(nowMs)
  };
}

export function buildMarketClosedSnapshotStoreRetentionCleanupPanel(opt = {}) {
  const r = buildMarketClosedSnapshotStoreRetentionCleanupDiagnostics(opt);
  return {
    ...r,
    panelType: "operator_dashboard_card",
    title: "Market Closed Snapshot Store Retention/Cleanup Diagnostics",
    subtitle: "Read-only retention review. No deletion controls are exposed.",
    severity: r.cleanupPreview.candidateCount ? "info" : "normal",
    summary: {
      storeExists: r.store.exists,
      fileCount: r.store.fileCount,
      jsonFileCount: r.store.jsonFileCount,
      retentionDays: r.retentionPolicy.retentionDays,
      cleanupCandidateCount: r.cleanupPreview.candidateCount,
      deletionPerformed: false
    }
  };
}

export default buildMarketClosedSnapshotStoreRetentionCleanupDiagnostics;
