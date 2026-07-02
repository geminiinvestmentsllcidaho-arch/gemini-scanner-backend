export const VERSION = "watchlist_settings_readonly_v1";

const DEFAULT_SYMBOLS = Object.freeze(["AAPL", "MSFT", "NVDA", "SPY"]);
const DEFAULT_SESSIONS = Object.freeze(["regular", "closed", "unknown"]);
const DEFAULT_REFRESH_OPTIONS_SEC = Object.freeze([15, 30, 60, 120]);

const SAFETY = Object.freeze({
  readOnly: true,
  monitorOnly: true,
  diagnosticsOnly: true,
  noExecutionControls: true,
  decisionAssistOnly: true,
  orderPlacementAllowed: false,
  orderSubmitAllowed: false,
  brokerContactAllowed: false,
  accountMutationAllowed: false,
  liveTradingAllowed: false,
  autoTradingAllowed: false,
  retryAllowed: false,
  orderSubmitAttempted: false,
  orderSubmitted: false,
  brokerContactAttempted: false,
  accountMutationAttempted: false
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function isoNow(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeSymbol(value) {
  const symbol = String(value ?? "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol) ? symbol : null;
}

export function normalizeWatchlistSymbols(value = DEFAULT_SYMBOLS) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "").split(",");
  const seen = new Set();
  const symbols = [];
  for (const item of raw) {
    const symbol = normalizeSymbol(item);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
  }
  return symbols.length ? symbols : [...DEFAULT_SYMBOLS];
}

function pickSession(value) {
  const session = String(value ?? "regular").trim().toLowerCase();
  return DEFAULT_SESSIONS.includes(session) ? session : "regular";
}

function pickRefreshIntervalSec(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.max(5, Math.round(n));
}

export function buildWatchlistSettingsReadonly(options = {}) {
  const generatedAt = isoNow(options.now ?? new Date());
  const symbols = normalizeWatchlistSymbols(options.symbols ?? process.env.ALPACA_SYMBOLS ?? DEFAULT_SYMBOLS);
  const selectedSession = pickSession(options.session ?? "regular");
  const refreshIntervalSec = pickRefreshIntervalSec(options.refreshIntervalSec ?? 30);

  return {
    ok: true,
    version: VERSION,
    panelType: "compact_watchlist_settings_panel",
    title: "Watchlist & Settings",
    displayState: "WATCHLIST_SETTINGS_READY_READONLY",
    headline: `${symbols.length} symbols configured for read-only scanner views.`,
    generatedAt,
    lastUpdatedAt: generatedAt,
    symbols,
    symbolCount: symbols.length,
    selectedSession,
    sessionOptions: [...DEFAULT_SESSIONS],
    refreshIntervalSec,
    refreshOptionsSec: [...DEFAULT_REFRESH_OPTIONS_SEC],
    routes: {
      appHref: "/app/watchlist-settings",
      diagnosticHref: "/diagnostics/watchlist-settings-readonly",
      todaysIntradayHref: `/app/todays-intraday-setups?session=${encodeURIComponent(selectedSession)}`
    },
    refreshHint: "Changing this panel is informational only; backend execution and broker contact remain disabled.",
    ...SAFETY
  };
}

function renderRefreshScript(source = {}) {
  if (source?.autoRefreshEnabled === false) return "";
  const delayMs = pickRefreshIntervalSec(source.refreshIntervalSec) * 1000;
  return `<script data-readonly-auto-refresh="true">
(() => {
  const delayMs = ${JSON.stringify(delayMs)};
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;
  window.setTimeout(() => {
    window.location.reload();
  }, delayMs);
})();
</script>`;
}

export function renderWatchlistSettingsReadonlyHtml(panel = {}) {
  const symbols = list(panel.symbols)
    .map((symbol) => `<a href="/app/todays-intraday-setups/${encodeURIComponent(symbol)}?session=${encodeURIComponent(panel.selectedSession ?? "regular")}">${esc(symbol)}</a>`)
    .join(" ") || "No symbols configured.";

  const sessions = list(panel.sessionOptions)
    .map((session) => `<span class="chip">${esc(session)}${session === panel.selectedSession ? " ╓" : ""}</span>`)
    .join("");

  const refresh = list(panel.refreshOptionsSec)
    .map((sec) => `<span class="chip">${esc(sec)}s${sec === panel.refreshIntervalSec ? " ║" : ""}</span>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(panel.title ?? "Watchlist & Settings")}</title>
<style>
body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.chip,a{ display:inline-block;background:#eee;border-radius:999px;padding:8px 11px;margin:4px;color:#111;text-decoration:none }
</style></head><body><main class="wrap">
<section class="hero"><h1>${esc(panel.title)}</h1><p>${esc(panel.headline)}</p><p>${esc(panel.displayState)}</p><p>Last updated: ${esc(panel.lastUpdatedAt)} | Refresh: ${esc(panel.refreshIntervalSec)}s</p></section>
<section class="card"><h2>Symbols</h2>${symbols}</section>
<section class="card"><h2>Session</h2>${sessions}</section>
<section class="card"><h2>Refresh Options</h2>${refresh}</section>
<section class="card"><a href="${esc(panel.routes?.todaysIntradayHref)}">Open Today's Intraday Setups</a> <a href="${esc(panel.routes?.diagnosticHref)}">JSON</a></section>
<section class="card"><b>No execution controls:</b> ${esc(panel.noExecutionControls)}<br><b>Order submitted:</b> ${esc(panel.orderSubmitted)}<br><b>Broker contact attempted:</b> ${esc(panel.brokerContactAttempted)}<br><b>Account mutation attempted:</b> ${esc(panel.accountMutationAttempted)}</section>
${renderRefreshScript(panel)}
</main></body></html>`;
}
