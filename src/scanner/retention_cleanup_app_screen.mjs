import { buildMarketClosedSnapshotStoreRetentionCleanupPanel } from "./market_closed_snapshot_store_retention_cleanup_diagnostics.mjs";

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

function sourcePanel(options = {}) {
  if (options.panel && typeof options.panel === "object") return options.panel;
  try {
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

function normalizeFile(file = {}, index = 0) {
  const name = file.name ?? file.filename ?? file.file ?? file.path ?? file.relativePath ?? `file_${index + 1}`;
  const ageDays = file.ageDays ?? file.fileAgeDays ?? file.daysOld ?? file.age ?? null;
  const eligible = file.eligible ?? file.cleanupEligible ?? file.wouldDelete ?? file.previewOnly ?? false;
  const ts = file.ts ?? file.createdAt ?? file.updatedAt ?? file.mtime ?? file.fileMtime ?? file.sourceTs ?? "unknown";
  return {
    index: index + 1,
    name: clean(name, `file_${index + 1}`),
    ageDays: ageDays === null ? null : num(ageDays, 0),
    status: clean(file.status ?? file.displayState ?? (eligible ? "preview_cleanup_candidate" : "retained"), "retained"),
    ts: clean(ts),
    previewOnly: true,
    eligibleForCleanup: Boolean(eligible),
  };
}

export function buildRetentionCleanupAppScreen(options = {}) {
  const panel = sourcePanel(options);
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  const allFiles = fileListFrom(panel).map(normalizeFile);
  const visibleLimit = Math.max(1, num(options.limit, 10));
  const visibleFiles = allFiles.slice(0, visibleLimit);
  const candidateCount = num(panel.candidateCount ?? panel.cleanupCandidateCount ?? panel.fileCount ?? allFiles.length, allFiles.length);
  const retentionDays = num(panel.retentionDays ?? panel.inputs?.retentionDays ?? options.retentionDays, 30);

  return {
    ok: panel.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Retention Cleanup Preview",
    subtitle: "Read-only local snapshot retention cleanup preview.",
    displayState: "RETENTION_CLEANUP_APP_SCREEN_READY_READONLY",
    sourceVersion: panel.version ?? null,
    sourceDisplayState: panel.displayState ?? null,
    retentionDays,
    candidateCount,
    visibleCount: visibleFiles.length,
    files: visibleFiles,
    summaryCards: [
      { label: "Candidates", value: String(candidateCount) },
      { label: "Visible", value: String(visibleFiles.length) },
      { label: "Retention Days", value: String(retentionDays) },
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
  return `<article class="file"><b>${esc(file.name)}</b><p>${esc(file.status)}</p><p>ageDays=${esc(file.ageDays ?? "unknown")}</p><small>${esc(file.ts)}</small></article>`;
}

export function renderRetentionCleanupAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map(cardHtml).join("") || `<article class="card"><b>No cleanup candidates</b><p>No local snapshot files are eligible for cleanup.</p></article>`;
  const files = arr(screen.files).map(fileHtml).join("") || `<article class="file"><b>No files</b><p>No retention cleanup candidates are available.</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Retention Cleanup Preview")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.file,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.file b{font-size:18px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title ?? "Retention Cleanup Preview")}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section>${files}</section><section class="safety"><span class="pill">Read-only</span><span class="pill">Preview only</span><span class="pill">No file deletion</span><span class="pill">No broker contact</span><p>fileDeleted=${esc(screen.fileDeleted)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refreshScript(screen)}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-broker-adapter-approval-record-tool">Paper Broker Adapter Approval Record Tool</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildRetentionCleanupAppScreen;
