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
    id: "customer_zero_scanner_hub",
    title: "Customer Zero — Scanner",
    subtitle: "Choose scanner mode and asset universe.",
    description: "Customer Zero scanner hub with Intraday as the default stock scanner, Under $5 available now, and Swing, Long-term, Watchlist, ETFs, Crypto, and Options marked for future modules.",
    category: "scanner_app",
    href: "/customer-zero/scanner",
    diagnosticHref: "/diagnostics/todays-intraday-setups-app-card?session=regular",
    routeHref: "/customer-zero/scanner",
    displayState: "CUSTOMER_ZERO_SCANNER_HUB_READY_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "customer_zero_under_five_scanner",
    title: "Customer Zero — Under $5 Scanner",
    subtitle: "Customer Zero visual test dashboard.",
    description: "Live read-only under-$5 scanner shown on the Customer Zero side with explicit role labeling and no execution controls.",
    category: "scanner_app",
    href: "/customer-zero/under-five-scanner",
    diagnosticHref: "/diagnostics/alpaca-under-five-universe-app-card",
    routeHref: "/customer-zero/under-five-scanner",
    displayState: "CUSTOMER_ZERO_UNDER_FIVE_SCANNER_CONNECTED_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "alpaca_under_five_universe",
    title: "Under $5 Read-Only Potential",
    subtitle: "Live read-only under-$5 stock potential scanner.",
    description: "Mobile-ready read-only potential cards for active under-$5 equities with freshness, spread, liquidity, and safety caps.",
    category: "scanner_app",
    href: "/app/alpaca-under-five-universe",
    diagnosticHref: "/diagnostics/alpaca-under-five-universe-app-card",
    routeHref: "/app/alpaca-under-five-universe",
    displayState: "UNDER_FIVE_READONLY_APP_CARD_CONNECTED",
    refreshFriendly: true,
  }),
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
  {
    id: "alpaca_paper_account_dashboard",
    label: "Alpaca Paper Account Dashboard",
    title: "Alpaca Paper Account Dashboard",
    subtitle: "Read-only paper account money and positions dashboard.",
    description: "Read-only Alpaca paper account dashboard shell for cash, buying power, equity, portfolio value, and positions with no live trading, auto trading, placement, submit, cancel, or account mutation controls.",
    category: "operator_workflow",
    href: "/app/alpaca-paper-account-dashboard",
    diagnosticHref: "/diagnostics/alpaca-paper-account-dashboard",
    routeHref: "/app/alpaca-paper-account-dashboard",
    displayState: "ALPACA_PAPER_ACCOUNT_READONLY_CONNECTED",
  },
  Object.freeze({
    id: "internal_owner_account",
    title: "Internal Owner Account",
    subtitle: "Read-only internal owner and tenant bootstrap profile.",
    description: "Internal-only owner account foundation showing tenant, role, security readiness, and closed trading safety locks without authentication claims, public signup, secrets, or mutation controls.",
    category: "app_settings",
    href: "/app/internal-owner",
    diagnosticHref: "/diagnostics/internal-owner-tenant-readonly",
    routeHref: "/app/internal-owner",
    displayState: "INTERNAL_OWNER_TENANT_BOOTSTRAP_READONLY",
    refreshFriendly: false,
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
    id: "opportunity_audit_archive_retention",
    title: "Opportunity Audit Archive Retention",
    subtitle: "Read-only archive policy preview.",
    description: "Preview-only opportunity funnel audit archive retention diagnostics with no deletion controls.",
    category: "scanner_snapshots",
    href: "/app/opportunity-audit-archive-retention",
    diagnosticHref: "/diagnostics/opportunity-audit-archive-retention-preview",
    routeHref: "/app/opportunity-audit-archive-retention",
    displayState: "OPPORTUNITY_AUDIT_ARCHIVE_RETENTION_PREVIEW_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_readiness_gate",
    title: "Paper Trading Readiness Gate",
    subtitle: "Read-only readiness diagnostics.",
    description: "Read-only PAPER intent readiness status based on scanner, freshness, governance, portfolio, confidence, quality, and safety checks.",
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
    id: "paper_order_readonly_status",
    title: "Paper Order Read-Only Status",
    subtitle: "Read-only paper order status app screen.",
    description: "Paper order read-only status app screen with no submit, retry, or account mutation controls.",
    category: "paper_lifecycle",
    href: "/app/paper-order-readonly-status",
    diagnosticHref: "/diagnostics/paper-order-readonly-status-dashboard",
    routeHref: "/app/paper-order-readonly-status",
    displayState: "PAPER_ORDER_STATUS_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_position_readonly_dashboard",
    title: "Paper Position Read-Only Dashboard",
    subtitle: "Read-only paper position dashboard app screen.",
    description: "Paper position read-only dashboard app screen with no broker read, submit, retry, or account mutation controls.",
    category: "paper_lifecycle",
    href: "/app/paper-position-readonly-dashboard",
    diagnosticHref: "/diagnostics/paper-position-readonly-dashboard",
    routeHref: "/app/paper-position-readonly-dashboard",
    displayState: "PAPER_POSITION_DASHBOARD_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "paper_position_pnl_readonly_baseline",
    title: "Paper Position P/L Read-Only Baseline",
    subtitle: "Read-only paper position P/L baseline app screen.",
    description: "Paper position P/L read-only baseline app screen with no broker read, submit, retry, or account mutation controls.",
    category: "paper_lifecycle",
    href: "/app/paper-position-pnl-readonly-baseline",
    diagnosticHref: "/diagnostics/paper-position-pnl-readonly-baseline",
    routeHref: "/app/paper-position-pnl-readonly-baseline",
    displayState: "PAPER_POSITION_PNL_BASELINE_READONLY",
    refreshFriendly: false,
  }),
  Object.freeze({
    id: "alpaca_paper_account_status",
    title: "Alpaca Paper Account Status",
    subtitle: "Read-only Alpaca paper account connection status.",
    description: "Shows that the Alpaca paper account is connected and active while broker execution, order placement, and account mutation remain blocked.",
    category: "paper_lifecycle",
    href: "/app/alpaca-paper-account-status",
    diagnosticHref: "/app/alpaca-paper-account-status",
    routeHref: "/app/alpaca-paper-account-status",
    displayState: "ALPACA_PAPER_ACCOUNT_CONNECTED_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "paper_trading_overview_status",
    title: "Paper Trading Overview Status",
    subtitle: "Read-only paper trading overview status.",
    description: "Overview screen showing Alpaca PAPER account readiness, runtime preflight, network attempt status, current readiness gate, and safety status.",
    category: "paper_lifecycle",
    href: "/app/paper-trading-overview-status",
    diagnosticHref: "/app/paper-trading-overview-status",
    routeHref: "/app/paper-trading-overview-status",
    displayState: "PAPER_TRADING_OVERVIEW_STATUS_READONLY",
    refreshFriendly: true,
  }),

  Object.freeze({
    id: "paper_app_route_health_status",
    title: "Paper App Route Health Status",
    subtitle: "Read-only paper app route health status.",
    description: "Summarizes paper, broker, runtime, safety, readiness, operator, and Alpaca app route coverage without route execution, broker contact, order submit, retry, reset, or account mutation controls.",
    category: "paper_lifecycle",
    href: "/app/paper-app-route-health-status",
    diagnosticHref: "/app/paper-app-route-health-status",
    routeHref: "/app/paper-app-route-health-status",
    displayState: "PAPER_APP_ROUTE_HEALTH_STATUS_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "paper_app_safety_lock_status",
    title: "Paper App Safety Lock Status",
    subtitle: "Read-only paper app safety lock status.",
    description: "Summarizes closed safety locks across paper app routes without route execution, broker contact, order submit, retry, reset, or account mutation controls.",
    category: "paper_lifecycle",
    href: "/app/paper-app-safety-lock-status",
    diagnosticHref: "/app/paper-app-safety-lock-status",
    routeHref: "/app/paper-app-safety-lock-status",
    displayState: "PAPER_APP_SAFETY_LOCK_STATUS_READONLY",
    refreshFriendly: true,
  }),

  Object.freeze({
    id: "paper_broker_runtime_environment_preflight",
    title: "Paper Broker Runtime Environment Preflight",
    subtitle: "Read-only runtime environment and one-shot blocker status.",
    description: "Shows Alpaca paper env mapping, latest runtime preflight report, prior one-shot attempt status, market-hours blocker, and safety locks while execution remains blocked.",
    category: "paper_lifecycle",
    href: "/app/paper-broker-runtime-environment-preflight",
    diagnosticHref: "/app/paper-broker-runtime-environment-preflight",
    routeHref: "/app/paper-broker-runtime-environment-preflight",
    displayState: "PAPER_BROKER_RUNTIME_ENVIRONMENT_PREFLIGHT_READONLY",
    refreshFriendly: true,
  }),
  Object.freeze({
    id: "paper_trade_lifecycle_runner_audit",
    title: "Paper Trade Lifecycle Runner Audit",
    subtitle: "Read-only local paper trade lifecycle runner audit.",
    description: "Audit-only app screen for the local paper trade lifecycle runner showing latest audit status, record counts, lifecycle completion, local JSONL writes, and safety locks while broker contact, order placement, account mutation, and execution remain blocked.",
    category: "paper_lifecycle",
    href: "/app/paper-trade-lifecycle-runner-audit",
    diagnosticHref: "/diagnostics/paper-trade-lifecycle-runner-audit-panel",
    routeHref: "/app/paper-trade-lifecycle-runner-audit",
    displayState: "PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_READONLY",
    refreshFriendly: false
  }),
  Object.freeze({
    id: "paper_trade_lifecycle_runner",
    title: "Paper Trade Lifecycle Runner",
    subtitle: "Read-only local paper trade lifecycle runner preview.",
    description: "Preview-only local paper trade lifecycle runner app screen showing runner readiness and safety locks while writing no records and keeping broker contact, order placement, account mutation, and execution blocked.",
    category: "paper_lifecycle",
    href: "/app/paper-trade-lifecycle-runner",
    diagnosticHref: "/diagnostics/paper-trade-lifecycle-runner-panel",
    routeHref: "/app/paper-trade-lifecycle-runner",
    displayState: "PAPER_TRADE_LIFECYCLE_RUNNER_READONLY",
    refreshFriendly: false
  }),
  Object.freeze({
    id: "paper_trade_lifecycle_dashboard",
    title: "Paper Trade Lifecycle Dashboard",
    subtitle: "Read-only local paper trade lifecycle dashboard app screen.",
    description: "Local JSONL-only paper trade lifecycle dashboard showing intent, order ticket, fill simulation, and position state while broker contact, order placement, account mutation, and execution remain blocked by design.",
    category: "paper_lifecycle",
    href: "/app/paper-trade-lifecycle-dashboard",
    diagnosticHref: "/diagnostics/paper-trade-lifecycle-dashboard-panel",
    routeHref: "/app/paper-trade-lifecycle-dashboard",
    displayState: "PAPER_TRADE_LIFECYCLE_DASHBOARD_READONLY",
    refreshFriendly: false
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
    headline: entries.length ? "Scan the market, review setups, manage your watchlist, and monitor paper trades." : "No app views registered.",
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

function routeEmoji(entry = {}) {
  const id = String(entry.id ?? "");
  const category = String(entry.category ?? "");
  if (id.includes("alpaca")) return "🦉";
  if (id.includes("todays") || category === "scanner_app") return "📈";
  if (id.includes("safety") || id.includes("guard") || id.includes("lock") || category === "safety_controls") return "🔒";
  if (id.includes("readiness") || id.includes("preflight")) return "🧪";
  if (id.includes("position") || id.includes("account") || id.includes("broker")) return "💼";
  if (id.includes("operator")) return "👤";
  if (id.includes("snapshot")) return "📂️";
  return "📌";
}

function primaryActionLabel(entry = {}) {
  const labels = {
    todays_intraday_setups: "View Top Setups",
    watchlist_settings: "Open Watchlist",
    alpaca_paper_account_dashboard: "View Paper Account",
    paper_position_readonly_dashboard: "View Positions",
    paper_trade_intent_plan: "Review Trade Plan",
    snapshot_history: "View History",
  };
  return labels[entry.id] ?? "Open";
}

function renderEntry(entry) {
  return `<article class="entry" data-entry-id="${esc(entry.id)}" data-entry-category="${esc(entry.category)}">
<div class="entry-top"><div class="entry-icon">${esc(routeEmoji(entry))}</div><div><h2>${esc(entry.title)}</h2><p class="subtitle">${esc(entry.subtitle)}</p></div></div>
<p class="description">${esc(entry.description)}</p>
<div class="links">
<a class="primary-action" href="${esc(entry.href)}">${esc(primaryActionLabel(entry))}</a>
<a href="${esc(entry.diagnosticHref)}">JSON</a>
<a class="route-compat" href="${esc(entry.routeHref ?? entry.href)}">App Route</a>
</div>
<div class="state-row"><span>${esc(entry.displayState)}</span><span>read only</span><span>no execution</span></div>
</article>`;
}

function renderFeaturedDashboard(entries = []) {
  const source = list(entries);
  const wanted = [
    ["todays_intraday_setups", "Run Scanner", "Find and review today’s ranked setups."],
    ["watchlist_settings", "Watchlist", "Manage symbols and scanner preferences."],
    ["alpaca_paper_account_dashboard", "Paper Account", "View buying power, cash, equity, and positions."],
    ["paper_position_readonly_dashboard", "Positions", "Review current paper positions and P/L."],
    ["paper_trade_intent_plan", "Trade Plan", "Review a paper-trade plan without placing an order."],
    ["snapshot_history", "History", "Review stored scanner snapshots."],
  ];
  const cards = wanted
    .map(([id, title, subtitle]) => {
      const entry = source.find((item) => item.id === id);
      if (!entry) return "";
      return `<a class="feature-card" data-feature-id="${esc(id)}" href="${esc(entry.href)}"><b>${esc(routeEmoji(entry))} ${esc(title)}</b><span>${esc(subtitle)}</span></a>`;
    })
    .filter(Boolean)
    .join("");

  return `<section class="feature-panel" data-featured-dashboard="true">
<h2>Start Here</h2>
<p>Use these core actions first. GeminiScanner remains read-only and cannot place orders.</p>
<div class="feature-grid">${cards}</div>
</section>`;
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



function formatCategoryLabel(category) {
  return String(category ?? "uncategorized")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryAnchor(category) {
  const raw = String(category ?? "uncategorized").toLowerCase();
  const safe = raw.replace(/[^a-z0-9_]+/g, "-").replace(/^-+|-+$/g, "");
  return `app-nav-${safe.replace(/_/g, "-") || "uncategorized"}`;
}

function groupEntriesByCategory(entries = []) {
  const groups = new Map();
  for (const entry of list(entries)) {
    const category = entry?.category ?? "uncategorized";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(entry);
  }
  return groups;
}

function renderNavigationSections(entries = []) {
  const groups = groupEntriesByCategory(entries);
  if (!groups.size) return "<p>No app entries registered.</p>";
  return [...groups.entries()]
    .map(([category, groupEntries]) => `<section class="entry-group" id="${esc(categoryAnchor(category))}" data-app-navigation-category="${esc(category)}" data-app-navigation-entry-count="${esc(groupEntries.length)}">
<h2>${esc(formatCategoryLabel(category))} <small class="entry-count">${esc(groupEntries.length)} entries</small></h2>
${groupEntries.map(renderEntry).join("")}
</section>`)
    .join("");
}

function renderNavigationSummary(nav = {}) {
  const entries = list(nav.entries);
  const groups = groupEntriesByCategory(entries);
  const categoryCount = groups.size;
  const entryCount = entries.length;
  const quickLinks = [
    "/app/paper-app-route-health-status",
    "/app/paper-app-safety-lock-status",
  ].filter((href) => entries.some((entry) => entry.href === href)).length;
  const categoryLinks = [...groups.entries()]
    .map(([category, groupEntries]) => `<li><a href="#${esc(categoryAnchor(category))}">${esc(formatCategoryLabel(category))}</a> <small>${esc(groupEntries.length)} entries</small></li>`)
    .join("");

  return `<section class="safety" data-app-navigation-summary="true">
<h2>Navigation Summary</h2>
<p><b>Registered Views:</b> ${esc(entryCount)} | <b>Categories:</b> ${esc(categoryCount)} | <b>Readiness Quick Links:</b> ${esc(quickLinks)}</p>
<p><b>Read-only Locks:</b> no execution controls, no broker contact, no order placement, no account mutation.</p>
<div class="links" data-app-navigation-jump-links="true"><b>Jump to section:</b> <ul>${categoryLinks}</ul></div>
<p><b>No execution controls:</b> ${esc(nav.noExecutionControls)} | <b>Broker contact attempted:</b> ${esc(nav.brokerContactAttempted)} | <b>Account mutation attempted:</b> ${esc(nav.accountMutationAttempted)}</p>
</section>`;
}

function renderReadinessQuickLinks(entries = []) {
  const source = list(entries);
  const lookup = new Map(source.map((entry) => [entry.href, entry]));
  const links = [
    { href: "/app/alpaca-paper-account-dashboard", label: "Alpaca Paper Account Dashboard" },
    { href: "/app/alpaca-operator-key-entry", label: "Alpaca Operator Key Entry" },
    { href: "/app/paper-app-route-health-status", label: "Route Health Status" },
    { href: "/app/paper-app-safety-lock-status", label: "Safety Lock Status" },
  ];

  const rendered = links
    .map((link) => {
      const entry = lookup.get(link.href) ?? { title: link.label, href: link.href };
      const title = entry.title ?? link.label;
      return `<a href="${esc(link.href)}">${esc(title)}</a>`;
    })
    .join("");

  return `<section class="safety" data-paper-readiness-quick-links="true">
<h2>Related Broker Readiness Routes</h2>
<p>Fast access to the main screens we built so far.</p>
<div class="links">${rendered}</div>
<small>Read-only | no broker contact | no placement | no submit | no account mutation</small>
</section>`;
}


export function renderAppNavigationReadonlyHtml(nav = {}) {
  const featured = renderFeaturedDashboard(nav.entries);
  const sections = renderNavigationSections(nav.entries);
  const summary = renderNavigationSummary(nav);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(nav.title ?? "GeminiScanner App")}</title>
<style>
:root{--bg:#06140f;--bg2:#0b2519;--panel:#fff;--card:#f8fffb;--text:#0b1220;--muted:#5f6f66;--line:#d8eee1;--green:#00c853;--green2:#008a3d;--dark:#092015;--soft:#eafff1}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;margin:0;background:linear-gradient(180deg,var(--bg),var(--bg2) 245px,#f4fbf6 245px);color:var(--text);padding:14px}
.wrap{max-width:1180px;margin:auto}
.hero{background:radial-gradient(circle at top right,#00c85344,transparent 34%),linear-gradient(135deg,#07140f,#0b3322);color:white;border:1px solid #ffffff24;border-radius:28px;padding:22px;margin:8px 0 14px;box-shadow:0 16px 44px #0004}
.hero h1{font-size:34px;letter-spacing:-.04em;margin:0 0 8px}
.hero p{margin:7px 0;color:#d9ffe8}
.status-strip{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.pill{border:1px solid #ffffff30;background:#ffffff18;color:white;border-radius:999px;padding:8px 11px;font-size:13px}
.feature-panel,.entry-group,.safety{background:rgba(255,255,255,.98);border:1px solid var(--line);border-radius:24px;padding:16px;margin:12px 0;box-shadow:0 10px 28px #07201514}
.feature-panel h2,.entry-group h2,.safety h2{margin:0 0 8px}
.feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px}
.feature-card{display:block;text-decoration:none;background:linear-gradient(145deg,#08351f,#0b5b34);color:white;border-radius:20px;padding:16px;min-height:110px;box-shadow:0 12px 28px #06351d28}
.feature-card b{display:block;font-size:17px;margin:9px 0 6px}
.feature-card span{color:#d6ffe4;font-size:13px}.advanced{background:#fff;border:1px solid var(--line);border-radius:24px;padding:14px;margin:12px 0}.advanced>summary{cursor:pointer;font-weight:800;font-size:18px;padding:6px}.advanced[open]>summary{margin-bottom:10px}
.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.links a{display:inline-block;text-decoration:none;background:var(--dark);color:white;border-radius:999px;padding:10px 13px;font-size:14px}
.links a.primary-action{background:var(--green2)}.route-compat{display:none!important}
.entry-group{padding:14px}
.entry-group h2{font-size:20px}
.entry{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px;margin:10px 0;box-shadow:0 8px 20px #06351d0f}
.entry-top{display:flex;align-items:flex-start;gap:10px}
.entry-icon{width:38px;height:38px;border-radius:14px;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:20px}
.entry h2{margin:0 0 4px;font-size:18px}
.entry p{margin:6px 0;color:#34453b}
.entry .description{font-size:13px;line-height:1.35}
.subtitle{color:var(--muted)!important}
.state-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
.state-row span,.entry-count,small{font-size:11px;color:var(--muted)}
.state-row span{background:#eef9f0;border:1px solid var(--line);border-radius:999px;padding:5px 8px}
@media(min-width:760px){.entry-group{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.entry-group h2{grid-column:1/-1}.entry{margin:0}}
@media(max-width:640px){body{padding:10px}.hero{border-radius:22px;padding:18px}.hero h1{font-size:28px}.feature-grid{grid-template-columns:1fr}.entry-group{border-radius:20px}.entry .description{display:none}.links a{width:100%;text-align:center}}
</style></head><body><main class="wrap">
<section class="hero"><h1>${esc(nav.title ?? "GeminiScanner App")}</h1><p>${esc(nav.headline)}</p><div class="status-strip"><span class="pill">${esc(nav.displayState)}</span><span class="pill">Views: ${esc(nav.entryCount)}</span><span class="pill">Refresh: ${esc(nav.refreshIntervalSec ?? 30)}s</span><span class="pill">Read-only locked</span></div><p>Last updated: ${esc(nav.lastUpdatedAt)}</p></section>
${featured}
<section class="safety"><h2>Current Mode</h2><p><b>Decision assist only.</b> Scanner review and paper-account monitoring are available. Order placement, live trading, and auto trading remain disabled.</p></section>
<details class="advanced"><summary>Advanced &amp; System Tools</summary>
${renderReadinessQuickLinks(nav.entries)}
${summary}
${sections}
<section class="safety"><b>No execution controls:</b> ${esc(nav.noExecutionControls)}<br><b>Order submitted:</b> ${esc(nav.orderSubmitted)}<br><b>Broker contact attempted:</b> ${esc(nav.brokerContactAttempted)}<br><b>Account mutation attempted:</b> ${esc(nav.accountMutationAttempted)}</section>
</details>
${renderReadOnlyAutoRefreshScript(nav)}
</main></body></html>`;
}

