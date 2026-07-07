import { getStoreHistory } from "./market_closed_scanner_snapshot_store_reader.mjs";

export const VERSION = "snapshot_history_app_screen_v1";

const arr = (v) => Array.isArray(v) ? v : [];
const clean = (v, f = "unknown") => String(v ?? "").trim() || f;
const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const cap = (v, d = 20) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(50, Math.round(n))) : d;
};
const pick = (o, keys, f = null) => {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== "") return o[k];
  return f;
};

function normalize(record = {}, index = 0) {
  const rankings = arr(record.rankings);
  const symbols = arr(record.topSymbols ?? record.symbols).map((x) => typeof x === "string" ? x : x?.symbol).filter(Boolean).slice(0, 6);
  const topSymbol = pick(record, ["topSymbol", "symbol"], null) ?? symbols[0] ?? record.top?.symbol ?? record.topRanking?.symbol ?? rankings[0]?.symbol ?? "none";
  return {
    index: index + 1,
    id: clean(pick(record, ["snapshotId", "id", "relativePath", "file"], `snapshot_${index + 1}`), `snapshot_${index + 1}`),
    snapshotTs: pick(record, ["snapshotTs", "snapshotTsIso", "ts", "createdAt", "generatedAt", "sourceTs"], null) ?? record.file?.snapshotTsIso ?? null,
    scannerHealth: clean(pick(record, ["scannerHealth", "health", "status", "snapshotStatus"], "unknown")),
    displayState: clean(pick(record, ["displayState", "state"], "SNAPSHOT_HISTORY_RECORD_READONLY")),
    session: clean(pick(record, ["session", "marketSession"], "unknown")),
    rankingCount: Number(pick(record, ["rankingCount", "rankingsCount", "totalRankings", "symbolCount"], rankings.length)) || 0,
    topSymbol: clean(topSymbol, "none"),
    topSymbols: symbols,
    stale: Boolean(pick(record, ["stale", "sourceStale"], false)),
    readOnly: true,
    monitorOnly: true,
    noExecutionControls: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false
  };
}

export function buildSnapshotHistoryAppScreen(options = {}) {
  const limit = cap(options.limit ?? options.max ?? options.count);
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  let history;
  try {
    history = options.history && typeof options.history === "object" ? options.history : getStoreHistory({ limit });
  } catch (err) {
    history = { ok: false, error: err instanceof Error ? err.message : String(err), records: [], recordCount: 0 };
  }
  const records = arr(history.records ?? history.items ?? history.snapshots ?? history.history ?? history.rows).slice(0, limit).map(normalize);
  return {
    ok: history.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Snapshot History",
    subtitle: "Stored market-closed scanner snapshots.",
    displayState: "SNAPSHOT_HISTORY_APP_SCREEN_READY_READONLY",
    status: records.length ? "ready" : "empty",
    sourceVersion: history.version ?? null,
    recordCount: Number(history.recordCount ?? records.length) || records.length,
    visibleCount: records.length,
    limit,
    cards: records,
    generatedAt: now,
    lastUpdatedAt: now,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: cap(options.refreshIntervalSec ?? options.refresh ?? 30, 30),
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
    accountMutationAttempted: false
  };
}

function refresh(screen = {}) {
  if (screen.autoRefreshEnabled !== true) return "";
  const ms = Math.max(5, Number(screen.refreshIntervalSec) || 30) * 1000;
  return `<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${JSON.stringify(ms)});</script>`;
}

function card(c = {}) {
  const symbols = arr(c.topSymbols).length ? arr(c.topSymbols).join(", ") : c.topSymbol;
  return `<article class="card"><div class="row"><b>#${esc(c.index)}</b><span>${esc(c.snapshotTs ?? "no timestamp")}</span></div><h2>${esc(c.topSymbol)}</h2><p>${esc(c.scannerHealth)} | ${esc(c.session)} | rankings=${esc(c.rankingCount)}</p><p>Top symbols: ${esc(symbols)}</p><small>${esc(c.displayState)} | stale=${esc(c.stale)}</small></article>`;
}

export function renderSnapshotHistoryAppScreenHtml(screen = {}) {
  const cards = arr(screen.cards).map(card).join("") || `<article class="card"><h2>No stored snapshots yet</h2><p>No local market-closed snapshot records were found.</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Snapshot History")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.row{display:flex;justify-content:space-between;gap:12px}.card h2{margin:8px 0 4px}.card p{margin:6px 0}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin-right:6px}small{font-size:11px;color:#777}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title ?? "Snapshot History")}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Records: ${esc(screen.visibleCount)} / ${esc(screen.recordCount)} | Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section class="safety"><span class="pill">Read-only</span><span class="pill">No broker contact</span><span class="pill">No account mutation</span><p>orderSubmitted=${esc(screen.orderSubmitted)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refresh(screen)}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildSnapshotHistoryAppScreen;
