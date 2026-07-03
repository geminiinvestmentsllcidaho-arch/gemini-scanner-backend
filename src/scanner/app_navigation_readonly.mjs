export const VERSION = "app_navigation_readonly_v1";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function refreshIntervalSec(source = {}) {
  const n = Number(source?.refreshIntervalSec);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 30;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const DEFAULT_ENTRIES = Object.freeze([
  Object.freeze({
    id: "todays_intraday_setups",
    title: "Today's Intraday Setups",
    subtitle: "Live read-only intraday setup scanner.",
    description: "Mobile-ready intraday setup cards with NO_TRADE safety handling and symbol detail drilldowns.",
    category: "scanner_app",
    href: "/app/todays-intraday-setups?session=regular",
    diagnosticHref: "/diagnostics/todays-intraday-setups-app-card?session=regular",
    routeHref: "/app/todays-intraday-setups?session=regular",
    displayState: "TODAYS_INTRADAY_SETUPS_APP_CARD_READY_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "watchlist_settings",
    title: "Watchlist & Settings",
    subtitle: "Symbol universe, session, and refresh controls.",
    description: "Read-only compact settings panel for scanner app display preferences.",
    category: "app_settings",
    href: "/app/watchlist-settings",
    diagnosticHref: "/diagnostics/watchlist-settings-readonly",
    routeHref: "/app/watchlist-settings",
    displayState: "WATCHLIST_SETTINGS_READY_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "exit_all_control",
    title: "Exit All / Auto-Buy Pause",
    subtitle: "Locked emergency exit and auto-buy pause control preview.",
    description: "Read-only future safety control for stopping automatic buying, planning inventory liquidation, and keeping auto-buy locked until manual resume.",
    category: "safety_controls",
    href: "/app/exit-all",
    diagnosticHref: "/diagnostics/exit-all-control-readonly",
    routeHref: "/app/exit-all",
    displayState: "EXIT_ALL_CONTROL_LOCKED_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "market_closed_snapshot",
    title: "Market Closed Snapshot",
    subtitle: "Closed-market scanner snapshot.",
    description: "Read-only scanner snapshot view for market-closed review.",
    category: "scanner_snapshots",
    href: "/app/market-closed-snapshot",
    diagnosticHref: "/diagnostics/market-closed-snapshot-app-screen",
    routeHref: "/app/market-closed-snapshot",
    displayState: "MARKET_CLOSED_SNAPSHOT_APP_SCREEN_READY_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "snapshot_history",
    title: "Snapshot History",
    subtitle: "Stored market-closed scanner records.",
    description: "Mobile-ready read-only history screen for local market-closed snapshot records.",
    category: "scanner_snapshots",
    href: "/app/snapshot-history",
    diagnosticHref: "/diagnostics/snapshot-history-app-screen",
    routeHref: "/app/snapshot-history",
    displayState: "MARKET_CLOSED_SNAPSHOT_STORE_HISTORY_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "snapshot_store_panel",
    title: "Snapshot Store Panel",
    subtitle: "Latest stored snapshot summary.",
    description: "Read-only panel for locally stored market-closed scanner snapshots.",
    category: "scanner_snapshots",
    href: "/app/snapshot-store",
    diagnosticHref: "/diagnostics/snapshot-store-app-screen",
    routeHref: "/app/snapshot-store",
    displayState: "MARKET_CLOSED_SNAPSHOT_STORE_PANEL_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "retention_cleanup_preview",
    title: "Retention Cleanup Preview",
    subtitle: "Read-only cleanup diagnostics.",
    description: "Preview-only retention cleanup diagnostics with no file deletion controls.",
    category: "scanner_snapshots",
    href: "/app/retention-cleanup",
    diagnosticHref: "/diagnostics/retention-cleanup-app-screen",
    routeHref: "/app/retention-cleanup",
    displayState: "RETENTION_CLEANUP_PREVIEW_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_readiness_gate",
    title: "Paper Trading Readiness Gate",
    subtitle: "Read-only readiness diagnostics.",
    description: "Broker/order placement readiness gate that remains blocked unless every safety check passes.",
    category: "paper_trading",
    href: "/app/paper-readiness-gate",
    diagnosticHref: "/diagnostics/paper-readiness-gate-app-screen",
    routeHref: "/app/paper-readiness-gate",
    displayState: "PAPER_READINESS_GATE_APP_SCREEN_BLOCKED_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_trade_intent_plan",
    title: "Paper Trade Intent Plan",
    subtitle: "Local intent planning preview.",
    description: "Monitor-only paper trade intent planner with no broker contact.",
    category: "paper_trading",
    href: "/app/paper-trade-intent-plan",
    diagnosticHref: "/diagnostics/paper-trade-intent-plan-app-screen",
    routeHref: "/app/paper-trade-intent-plan",
    displayState: "PAPER_TRADE_INTENT_PLAN_APP_SCREEN_BLOCKED_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_attempt_control_center",
    title: "Paper Attempt Control Center",
    subtitle: "Main paper-attempt safety center.",
    description: "Read-only control center panel for paper-attempt operator review.",
    category: "paper_attempt",
    href: "/app/paper-attempt-control-center",
    diagnosticHref: "/diagnostics/paper-attempt-control-center-app-screen",
    routeHref: "/app/paper-attempt-control-center",
    displayState: "PAPER_ATTEMPT_CONTROL_CENTER_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "operator_review_packet",
    title: "Operator Review Packet",
    subtitle: "Review-only paper attempt packet.",
    description: "Operator review packet and panel view for paper attempt audit review.",
    category: "paper_attempt",
    href: "/app/operator-review-packet",
    diagnosticHref: "/diagnostics/paper-attempt-operator-review-packet-app-screen",
    routeHref: "/app/operator-review-packet",
    displayState: "OPERATOR_REVIEW_PACKET_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "audit_dashboard",
    title: "Audit Dashboard",
    subtitle: "Paper attempt audit dashboard.",
    description: "No-go audit dashboard and panel for operator evidence review.",
    category: "paper_attempt",
    href: "/app/audit-dashboard",
    diagnosticHref: "/diagnostics/paper-attempt-operator-review-packet-audit-dashboard-app-screen",
    routeHref: "/app/audit-dashboard",
    displayState: "AUDIT_DASHBOARD_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "module_complete_selector",
    title: "Module Complete Selector",
    subtitle: "Next-stage selector, no-go by default.",
    description: "Review-only module-complete selector that blocks broker and order-placement options.",
    category: "paper_attempt",
    href: "/app/module-complete-selector",
    diagnosticHref: "/diagnostics/paper-attempt-module-complete-selector-app-screen",
    routeHref: "/app/module-complete-selector",
    displayState: "MODULE_COMPLETE_SELECTOR_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_lifecycle_dashboard",
    title: "Paper Lifecycle Dashboard",
    subtitle: "Read-only lifecycle dashboard.",
    description: "Local paper lifecycle dashboard showing order, fill, position, and PnL_state with broker execution locked.",
    category: "paper_lifecycle",
    href: "/app/paper-lifecycle-dashboard",
    diagnosticHref: "/diagnostics/paper-lifecycle-readonly-dashboard-panel",
    routeHref: "/app/paper-lifecycle-dashboard",
    displayState: "PAPER_LIFECYCLE_DASHBOARD_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_lifecycle_operator_summary",
    title: "Paper Lifecycle Operator Summary",
    subtitle: "Read-only lifecycle operator summary.",
    description: "Operator summary for local paper lifecycle evidence with no broker contact or order placement controls.",
    category: "paper_lifecycle",
    href: "/app/paper-lifecycle-operator-summary",
    diagnosticHref: "/diagnostics/paper-lifecycle-operator-summary-readonly-panel",
    routeHref: "/app/paper-lifecycle-operator-summary",
    displayState: "PAPER_LIFECYCLE_OPERATOR_SUMMARY_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_lifecycle_final_status",
    title: "Paper Lifecycle Final Status",
    subtitle: "Read-only lifecycle final status.",
    description: "Final paper lifecycle status screen confirming local completion state while execution remains locked.",
    category: "paper_lifecycle",
    href: "/app/paper-lifecycle-final-status",
    diagnosticHref: "/diagnostics/paper-lifecycle-final-status-readonly-panel",
    routeHref: "/app/paper-lifecycle-final-status",
    displayState: "PAPER_LIFECYCLE_FINAL_STATUS_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_lifecycle_route_registry",
    title: "Paper Lifecycle Route Registry",
    subtitle: "Read-only lifecycle route registry.",
    description: "Route registry for paper lifecycle evidence screens and diagnostic references.",
    category: "paper_lifecycle",
    href: "/app/paper-lifecycle-route-registry",
    diagnosticHref: "/diagnostics/paper-lifecycle-route-registry-readonly-panel",
    routeHref: "/app/paper-lifecycle-route-registry",
    displayState: "PAPER_LIFECYCLE_ROUTE_REGISTRY_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_trading_completion_certificate",
    title: "Paper Trading Completion Certificate",
    subtitle: "Read-only completion certificate.",
    description: "Final paper-trading completion certificate screen with broker and order placement locked.",
    category: "paper_trading",
    href: "/app/paper-trading-completion-certificate",
    diagnosticHref: "/diagnostics/paper-trading-completion-certificate-readonly-panel",
    routeHref: "/app/paper-trading-completion-certificate",
    displayState: "PAPER_TRADING_COMPLETION_CERTIFICATE_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_trading_module_route_index",
    title: "Paper Trading Module Route Index",
    subtitle: "Read-only module route index.",
    description: "Paper-trading route index with module evidence links and no execution controls.",
    category: "paper_trading",
    href: "/app/paper-trading-module-route-index",
    diagnosticHref: "/diagnostics/paper-trading-module-route-index-readonly-panel",
    routeHref: "/app/paper-trading-module-route-index",
    displayState: "PAPER_TRADING_MODULE_ROUTE_INDEX_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_trading_module_final_status",
    title: "Paper Trading Module Final Status",
    subtitle: "Read-only final module status.",
    description: "Final paper-trading module status screen confirming read-only completion and locked execution.",
    category: "paper_trading",
    href: "/app/paper-trading-module-final-status",
    diagnosticHref: "/diagnostics/paper-trading-module-final-status-readonly-panel",
    routeHref: "/app/paper-trading-module-final-status",
    displayState: "PAPER_TRADING_MODULE_FINAL_STATUS_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "readonly_operator_summary",
    title: "Read-only Operator Summary",
    subtitle: "Final operator summary panel.",
    description: "Safe operator summary panel for read-only paper attempt review.",
    category: "paper_attempt",
    href: "/app/readonly-operator-summary",
    diagnosticHref: "/diagnostics/paper-attempt-read-only-operator-summary-app-screen",
    routeHref: "/app/readonly-operator-summary",
    displayState: "READONLY_OPERATOR_SUMMARY_PANEL",
    refreshFriendly: false,
  }),
]);

export function buildAppNavigationReadonly(options = {}) {
  const navGeneratedAt = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  const navRefreshSec = refreshIntervalSec(options);
  const entries = (list(options.entries).length ? list(options.entries) : DEFAULT_ENTRIES)
    .filter(Boolean)
    .map((entry) => ({
      id: entry.id ?? null,
      title: entry.title ?? null,
      subtitle: entry.subtitle ?? null,
      description: entry.description ?? null,
      category: entry.category ?? null,
      href: entry.href ?? null,
      diagnosticHref: entry.diagnosticHref ?? null,
      routeHref: entry.routeHref ?? null,
      displayState: entry.displayState ?? null,
      refreshFriendly: entry.refreshFriendly === true,
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
      retryAllowed: false,
    }));

  return {
    ok: true,
    version: VERSION,
    panelType: "main_app_navigation",
    title: "GeminiScanner App",
    displayState: "GEMINISCANNER_APP_NAVIGATION_READY_READONLY",
    headline: entries.length ? "Choose a read-only scanner view." : "No app views registered.",
    entryCount: entries.length,
    entries,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    orderSubmitAllowed: false,
    generatedAt: navGeneratedAt,
    lastUpdatedAt: navGeneratedAt,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: navRefreshSec,
    refreshHint: "Refresh this read-only navigation to discover the latest available app views.",
    orderSubmitAttempted: false,
    orderSubmitted: false,
    brokerContactAttempted: false,
    accountMutationAttempted: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,

  };
}

function renderEntry(entry) {
  return `<article class="entry">
<h2>${esc(entry.title)}</h2>
<p>${esc(entry.subtitle)}</p>
<p>${esc(entry.description)}</p>
<div class="links">
<a href="${esc(entry.href)}">Open</a>
<a href="${esc(entry.diagnosticHref)}">JSON</a>
<a href="${esc(entry.routeHref)}">App Route</a>
</div>
<small>${esc(entry.displayState)} | readOnly=${esc(entry.readOnly)}</small>
</article>`;
}


function renderReadOnlyAutoRefreshScript(source = {}) {
  if (source?.autoRefreshEnabled !== true) return "";
  const seconds = Number(source?.refreshIntervalSec);
  const intervalSec = Number.isFinite(seconds) && seconds > 0 ? Math.max(5, Math.round(seconds)) : 30;
  const delayMs = intervalSec * 1000;
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

export function renderAppNavigationReadonlyHtml(nav = {}) {
  const entries = list(nav.entries).map(renderEntry).join("") || "<p>No app entries registered.</p>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(nav.title ?? "GeminiScanner App")}</title>
<style>
body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.entry,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.entry h2{margin:0 0 6px}.entry p{margin:6px 0}.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.links a{display:inline-block;text-decoration:none;background:#111;color:white;border-radius:999px;padding:9px 12px;font-size:14px}small{font-size:11px;color:#777}
</style></head><body><main class="wrap">
<section class="hero"><h1>${esc(nav.title ?? "GeminiScanner App")}</h1><p>${esc(nav.headline)}</p><p>${esc(nav.displayState)}</p><p>Last updated: ${esc(nav.lastUpdatedAt)} | Refresh: ${esc(nav.refreshIntervalSec ?? 30)}s</p></section>
${entries}
<section class="safety"><b>No execution controls:</b> ${esc(nav.noExecutionControls)}<br><b>Order submitted:</b> ${esc(nav.orderSubmitted)}<br><b>Broker contact attempted:</b> ${esc(nav.brokerContactAttempted)}<br><b>Account mutation attempted:</b> ${esc(nav.accountMutationAttempted)}</section>
${renderReadOnlyAutoRefreshScript(nav)}
</main></body></html>`;
}
