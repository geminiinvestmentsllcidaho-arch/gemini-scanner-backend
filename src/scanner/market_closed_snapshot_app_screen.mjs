import { buildMarketClosedSnapshotPanel } from "./market_closed_scanner_snapshot_diagnostics.mjs";

export const VERSION = "market_closed_snapshot_app_screen_v1";

const arr = (value) => Array.isArray(value) ? value : [];
const clean = (value, fallback = "unknown") => String(value ?? "").trim() || fallback;
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function fastDefaultPanel() {
  return {
    ok: true,
    version: "market_closed_snapshot_panel_fast_preview_v1",
    title: "Market Closed Snapshot",
    displayState: "MARKET_CLOSED_SNAPSHOT_FAST_PREVIEW_READONLY",
    scannerHealth: "preview",
    rankingConfidence: 0,
    totalRankings: 0,
    rankings: [],
  };
}

function sourcePanel(options = {}) {
  if (options.panel && typeof options.panel === "object") return options.panel;
  if (options.loadSourcePanel === true) {
    try {
      return buildMarketClosedSnapshotPanel({ skipScriptCheck: true, ...(options.panelOptions ?? {}) });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        title: "Market Closed Snapshot",
        displayState: "MARKET_CLOSED_SNAPSHOT_APP_SOURCE_UNAVAILABLE",
        snapshot: null,
      };
    }
  }
  return fastDefaultPanel();
}

function topSymbolsFrom(panel = {}) {
  const rankings =
    arr(panel.rankings) ||
    arr(panel.snapshot?.rankings) ||
    arr(panel.snapshot?.scanner?.top) ||
    arr(panel.scanner?.top);
  return rankings
    .map((item) => typeof item === "string" ? item : item?.symbol)
    .filter(Boolean)
    .slice(0, 6);
}

export function buildMarketClosedSnapshotAppScreen(options = {}) {
  const panel = sourcePanel(options);
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  const snapshot = panel.snapshot ?? panel.source ?? panel.scanner ?? {};
  const topSymbols = topSymbolsFrom(panel);
  return {
    ok: panel.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Market Closed Snapshot",
    subtitle: "Closed-market scanner snapshot review.",
    displayState: "MARKET_CLOSED_SNAPSHOT_APP_SCREEN_READY_READONLY",
    sourceVersion: panel.version ?? null,
    sourceDisplayState: panel.displayState ?? null,
    scannerHealth: clean(panel.scannerHealth ?? snapshot.scannerHealth ?? snapshot.status, "unknown"),
    rankingConfidence: Number(panel.rankingConfidence ?? snapshot.rankingConfidence ?? 0) || 0,
    recordCount: Number(panel.recordCount ?? panel.totalRankings ?? snapshot.totalRankings ?? topSymbols.length) || 0,
    topSymbols,
    summaryCards: [
      { label: "Health", value: clean(panel.scannerHealth ?? snapshot.scannerHealth ?? snapshot.status, "unknown") },
      { label: "Rankings", value: String(Number(panel.totalRankings ?? snapshot.totalRankings ?? topSymbols.length) || 0) },
      { label: "Top", value: topSymbols[0] ?? "none" },
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

export function renderMarketClosedSnapshotAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map(cardHtml).join("") || `<article class="card"><b>No snapshot data</b><p>No closed-market snapshot is available.</p></article>`;
  const symbols = arr(screen.topSymbols).map((symbol) => `<span class="pill">${esc(symbol)}</span>`).join("") || `<span class="pill">none</span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Market Closed Snapshot")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title ?? "Market Closed Snapshot")}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section class="card"><span>Top symbols</span><div>${symbols}</div></section><section class="safety"><span class="pill">read-only</span><span class="pill">No broker contact</span><span class="pill">No account mutation</span><p>orderSubmitted=${esc(screen.orderSubmitted)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refreshScript(screen)}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p></section></main></body></html>`;
}

export default buildMarketClosedSnapshotAppScreen;
