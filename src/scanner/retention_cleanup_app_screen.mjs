import { buildMarketClosedSnapshotStoreRetentionCleanupPanel } from "./market_closed_snapshot_store_retention_cleanup_diagnostics.mjs";
import { inspectOpportunityFunnelAuditArchiveRetention } from "./opportunity_funnel_audit_store.mjs";

export const VERSION = "retention_cleanup_app_screen_v1";

const arr = (value) => Array.isArray(value) ? value : [];
const clean = (value, fallback = "unknown") => String(value ?? "").trim() || fallback;
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function formatBytes(value) {
  const bytes = Math.max(0, num(value, 0));
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let scaled = bytes;
  let unit = "B";
  for (const candidate of units) {
    scaled /= 1024;
    unit = candidate;
    if (scaled < 1024) break;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${unit}`;
}

function calculateAgeDays(ts, now) {
  const modifiedMs = Date.parse(String(ts ?? ""));
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now ?? ""));
  if (!Number.isFinite(modifiedMs) || !Number.isFinite(nowMs)) return null;
  return Math.max(0, Math.floor((nowMs - modifiedMs) / 86400000));
}

function friendlyStatus(value) {
  const status = clean(value, "unknown");
  const labels = {
    retained_within_policy: "Retained within policy",
    preview_cleanup_candidate: "Cleanup candidate (preview only)",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function sourcePanel(options = {}) {
  if (options.panel && typeof options.panel === "object") return options.panel;
  try {
    if (options.source === "opportunity_audit") {
      const retention = inspectOpportunityFunnelAuditArchiveRetention({
        archiveDir: options.archiveDir,
        retentionDays: options.retentionDays,
        maxArchives: options.maxArchives,
        maxTotalBytes: options.maxTotalBytes,
        now: options.now,
      });
      const candidateByName = new Map(
        arr(retention.candidates).map((candidate) => [candidate.name, candidate]),
      );
      const files = arr(retention.archives).map((archive) => {
        const candidate = candidateByName.get(archive.name);
        return {
          ...archive,
          reasons: candidate?.reasons ?? [],
          previewOnly: true,
          wouldDelete: false,
          status: candidate
            ? "preview_cleanup_candidate"
            : "retained_within_policy",
        };
      });
      return {
        ...retention,
        candidates: [],
        version: "opportunity_funnel_audit_archive_retention_preview_v1",
        displayState: String(retention.status ?? "unknown").toUpperCase(),
        title: "Opportunity Audit Archive Retention Preview",
        subtitle: "Read-only opportunity funnel audit archive retention preview.",
        files,
      };
    }
    return buildMarketClosedSnapshotStoreRetentionCleanupPanel({
      limit: options.limit,
      retentionDays: options.retentionDays,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      title: "Retention Cleanup Preview",
      displayState: "RETENTION_CLEANUP_APP_SOURCE_UNAVAILABLE",
      files: [],
      candidateCount: 0,
    };
  }
}

function fileListFrom(panel = {}) {
  return arr(panel.files)
    .concat(arr(panel.candidates))
    .concat(arr(panel.cleanupCandidates))
    .concat(arr(panel.filesToDelete))
    .concat(arr(panel.previewFiles))
    .concat(arr(panel.items));
}

function normalizeFile(file = {}, index = 0, now = new Date()) {
  const name = file.name ?? file.filename ?? file.file ?? file.path ?? file.relativePath ?? `file_${index + 1}`;
  const sourceTs = file.ts ?? file.createdAt ?? file.updatedAt ?? file.mtime ?? file.modifiedAt ?? file.fileMtime ?? file.sourceTs ?? "unknown";
  const suppliedAgeDays = file.ageDays ?? file.fileAgeDays ?? file.daysOld ?? file.age ?? null;
  const ageDays = suppliedAgeDays === null ? calculateAgeDays(sourceTs, now) : suppliedAgeDays;
  const eligible = file.eligible ?? file.cleanupEligible ?? file.wouldDelete ?? file.previewOnly ?? false;
  const ts = sourceTs;
  const reasons = arr(file.reasons).map((reason) => clean(reason)).filter(Boolean);
  return {
    index: index + 1,
    name: clean(name, `file_${index + 1}`),
    ageDays: ageDays === null ? null : num(ageDays, 0),
    status: clean(file.status ?? file.displayState ?? (reasons.length ? reasons.join(", ") : eligible ? "preview_cleanup_candidate" : "retained"), "retained"),
    ts: clean(ts),
    sizeBytes: num(file.sizeBytes ?? file.bytes, 0),
    sizeDisplay: formatBytes(file.sizeBytes ?? file.bytes),
    reasons,
    previewOnly: true,
    eligibleForCleanup: Boolean(eligible || reasons.length),
  };
}

export function buildRetentionCleanupAppScreen(options = {}) {
  const panel = sourcePanel(options);
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  const allFiles = fileListFrom(panel).map((file, index) => normalizeFile(file, index, options.now ?? new Date()));
  const visibleLimit = Math.max(1, num(options.limit, 10));
  const visibleFiles = allFiles.slice(0, visibleLimit);
  const candidateCount = num(panel.candidateCount ?? panel.cleanupCandidateCount ?? panel.fileCount ?? allFiles.length, allFiles.length);
  const retentionDays = num(panel.retentionDays ?? panel.inputs?.retentionDays ?? options.retentionDays, 30);
  const archiveCount = num(panel.archiveCount, allFiles.length);
  const totalBytes = num(panel.totalBytes, allFiles.reduce((sum, file) => sum + file.sizeBytes, 0));
  const maxArchives = num(panel.maxArchives, 0);
  const maxTotalBytes = num(panel.maxTotalBytes, 0);

  return {
    ok: panel.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: clean(panel.title, "Retention Cleanup Preview"),
    subtitle: clean(panel.subtitle, "read-only local snapshot retention cleanup preview."),
    displayState: "RETENTION_CLEANUP_APP_SCREEN_READY_READONLY",
    sourceVersion: panel.version ?? null,
    sourceDisplayState: panel.displayState ?? null,
    retentionDays,
    archiveCount,
    totalBytes,
    maxArchives,
    maxTotalBytes,
    candidateCount,
    visibleCount: visibleFiles.length,
    files: visibleFiles,
    summaryCards: [
      { label: "Archives", value: String(archiveCount) },
      { label: "Archive Storage", value: formatBytes(totalBytes), rawValue: totalBytes },
      { label: "Candidates", value: String(candidateCount) },
      { label: "Visible", value: String(visibleFiles.length) },
      { label: "Retention Days", value: String(retentionDays) },
      { label: "Max Archives", value: String(maxArchives || "not set") },
      { label: "Storage Limit", value: maxTotalBytes ? formatBytes(maxTotalBytes) : "not set", rawValue: maxTotalBytes },
    ],
    generatedAt: now,
    lastUpdatedAt: now,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: num(options.refreshIntervalSec ?? options.refresh, 30),
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    previewOnly: true,
    noExecutionControls: true,
    deletionAllowed: false,
    fileDeletionAllowed: false,
    fileDeleted: false,
    orderSubmitAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    orderSubmitted: false,
    brokerContactAttempted: false,
    accountMutationAttempted: false,
  };
}

function refreshScript(screen = {}) {
  if (screen.autoRefreshEnabled !== true) return "";
  const ms = Math.max(5, num(screen.refreshIntervalSec, 30)) * 1000;
  return `<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${JSON.stringify(ms)});</script>`;
}

function cardHtml(card = {}) {
  return `<article class="card"><span>${esc(card.label)}</span><b>${esc(card.value)}</b></article>`;
}

function fileHtml(file = {}) {
  const age = file.ageDays === null ? "Age unavailable" : `${file.ageDays} day${file.ageDays === 1 ? "" : "s"} old`;
  const reasons = arr(file.reasons).length
    ? `<p><strong>Reason:</strong> ${esc(arr(file.reasons).map(friendlyStatus).join(", "))}</p>`
    : "";
  return `<article class="file"><b>${esc(file.name)}</b><p>${esc(friendlyStatus(file.status))}</p><p>${esc(age)} - ${esc(file.sizeDisplay ?? formatBytes(file.sizeBytes))}</p>${reasons}<small>Modified: ${esc(file.ts)}</small></article>`;
}

export function renderRetentionCleanupAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map(cardHtml).join("") || `<article class="card"><b>No cleanup candidates</b><p>No local snapshot files are eligible for cleanup.</p></article>`;
  const files = arr(screen.files).map(fileHtml).join("") || `<article class="file"><b>No files</b><p>No retention cleanup candidates are available.</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Retention Cleanup Preview")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.file,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.file b{font-size:18px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title ?? "Retention Cleanup Preview")}</h1><p>${esc(screen.subtitle)}</p><p>${esc(friendlyStatus(screen.sourceDisplayState ?? screen.displayState))}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section>${files}</section><section class="safety"><span class="pill">read-only</span><span class="pill">Preview only</span><span class="pill">No file deletion</span><span class="pill">No broker contact</span><p>fileDeleted=${esc(screen.fileDeleted)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refreshScript(screen)}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildRetentionCleanupAppScreen;
