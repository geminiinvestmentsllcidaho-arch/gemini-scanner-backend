import { getStorePanel } from "./market_closed_scanner_snapshot_store_reader.mjs";

export const VERSION = "snapshot_store_app_screen_v1";

const arr = (value) => Array.isArray(value) ? value : [];
const clean = (value, fallback = "unknown") => String(value ?? "").trim() || fallback;
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function sourcePanel(options = {}) {
  if (options.panel && typeof options.panel === "object") return options.panel;
  try {
    return getStorePanel({
      limit: options.limit,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      title: "Snapshot Store",
      displayState: "SNAPSHOT_STORE_APP_SOURCE_UNAVAILABLE",
      latest: [],
      recordCount: 0,
    };
  }
}

function normalizeRecord(record = {}, index = 0) {
  const symbol =
    record.symbol ??
    record.topSymbol ??
    record.snapshot?.topSymbol ??
    record.ranking?.symbol ??
    record.scanner?.top?.[0]?.symbol ??
    "unknown";
  const ts =
    record.ts ??
    record.createdAt ??
    record.generatedAt ??
    record.snapshotTs ??
    record.sourceTs ??
    record.fileMtime ??
    "unknown";
  const status =
    record.status ??
    record.displayState ??
    record.scannerHealth ??
    record.snapshot?.scannerHealth ??
    "stored";
  return {
    index: index + 1,
    symbol: clean(symbol),
    status: clean(status, "stored"),
    ts: clean(ts),
    file: clean(record.file ?? record.filename ?? record.path, "local-store"),
    safe: record.orderPlacementAllowed === false || record.brokerContactAllowed === false || record.noExecutionControls === true,
  };
}

export function buildSnapshotStoreAppScreen(options = {}) {
  const panel = sourcePanel(options);
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  const records = arr(panel.records ?? panel.latest ?? panel.items ?? panel.history).map(normalizeRecord);
  const latest = records.slice(0, Number(options.limit ?? 10) || 10);
  const recordCount = Number(panel.recordCount ?? panel.totalRecords ?? panel.total ?? records.length) || latest.length;

  return {
    ok: panel.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Snapshot Store",
    subtitle: "Local read-only snapshot store inventory.",
    displayState: "SNAPSHOT_STORE_APP_SCREEN_READY_READONLY",
    sourceVersion: panel.version ?? null,
    sourceDisplayState: panel.displayState ?? null,
    recordCount,
    visibleCount: latest.length,
    latest,
    summaryCards: [
      { label: "Records", value: String(recordCount) },
      { label: "Visible", value: String(latest.length) },
      { label: "Latest", value: latest[0]?.symbol ?? "none" },
    ],
    generatedAt: now,
    lastUpdatedAt: now,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: Number(options.refreshIntervalSec ?? options.refresh ?? 30) || 30,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
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
  const ms = Math.max(5, Number(screen.refreshIntervalSec) || 30) * 1000;
  return `<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${JSON.stringify(ms)});</script>`;
}

function cardHtml(card = {}) {
  return `<article class="card"><span>${esc(card.label)}</span><b>${esc(card.value)}</b></article>`;
}

function recordHtml(record = {}) {
  return `<article class="record"><b>${esc(record.symbol)}</b><p>${esc(record.status)}</p><p>${esc(record.ts)}</p><small>${esc(record.file)}</small></article>`;
}

export function renderSnapshotStoreAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map(cardHtml).join("") || `<article class="card"><b>No store data</b><p>No local snapshot store records are available.</p></article>`;
  const records = arr(screen.latest).map(recordHtml).join("") || `<article class="record"><b>No records</b><p>Snapshot store is empty.</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Snapshot Store")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.record,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.record b{font-size:20px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title ?? "Snapshot Store")}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section>${records}</section><section class="safety"><span class="pill">Read-only</span><span class="pill">Local store only</span><span class="pill">No broker contact</span><span class="pill">No account mutation</span><p>orderSubmitted=${esc(screen.orderSubmitted)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refreshScript(screen)}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildSnapshotStoreAppScreen;
