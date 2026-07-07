import { readPaperTradeLifecycleDashboardPanel } from "./paper_trade_lifecycle_dashboard.mjs";

export const VERSION = "paper_trade_lifecycle_dashboard_app_screen_v1";

function bool(value) {
  return value === true;
}

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function esc(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBadge(badge = {}) {
  return {
    label: text(badge.label, "Unknown"),
    value: bool(badge.value)
  };
}

function normalizePanel(panel = {}) {
  const summary = panel.summary && typeof panel.summary === "object" ? panel.summary : {};
  const metrics = panel.metrics && typeof panel.metrics === "object" ? panel.metrics : {};
  const safety = panel.safety && typeof panel.safety === "object" ? panel.safety : {};
  const badges = Array.isArray(panel.badges) ? panel.badges.map(normalizeBadge) : [];

  return {
    ok: bool(panel.ok),
    version: text(panel.version, "unknown"),
    dashboardVersion: text(panel.dashboardVersion, "unknown"),
    panelType: text(panel.panelType, "operator_dashboard_card"),
    title: text(panel.title, "Paper Trade Lifecycle Dashboard"),
    route: text(panel.route, "/diagnostics/paper-trade-lifecycle-dashboard"),
    refreshRoute: text(panel.refreshRoute, "/diagnostics/paper-trade-lifecycle-dashboard-panel"),
    status: text(panel.status, "unknown"),
    severity: text(panel.severity, "neutral"),
    monitorOnly: bool(panel.monitorOnly),
    previewOnly: bool(panel.previewOnly),
    paperOnly: bool(panel.paperOnly),
    totalRecords: num(panel.totalRecords, 0),
    summary: {
      lifecycleStatus: text(summary.lifecycleStatus, "unknown"),
      intentStatus: text(summary.intentStatus, "unknown"),
      ticketStatus: text(summary.ticketStatus, "unknown"),
      fillStatus: text(summary.fillStatus, "unknown"),
      positionStatus: text(summary.positionStatus, "unknown"),
      positionCount: num(summary.positionCount, 0),
      openPositionCount: num(summary.openPositionCount, 0),
      totalCostBasis: num(summary.totalCostBasis, 0),
      totalRealizedPnl: num(summary.totalRealizedPnl, 0)
    },
    metrics: {
      totalRecords: num(metrics.totalRecords, 0),
      intentRecords: num(metrics.intentRecords, 0),
      ticketRecords: num(metrics.ticketRecords, 0),
      fillRecords: num(metrics.fillRecords, 0),
      positionRecords: num(metrics.positionRecords, 0),
      openPositionCount: num(metrics.openPositionCount, 0),
      totalRealizedPnl: num(metrics.totalRealizedPnl, 0)
    },
    badges,
    safety: {
      orderPlacement: bool(safety.orderPlacement),
      liveTrading: bool(safety.liveTrading),
      autoTrading: bool(safety.autoTrading),
      brokerExecution: bool(safety.brokerExecution),
      accountMutation: bool(safety.accountMutation),
      brokerContact: bool(safety.brokerContact),
      localJsonlOnly: bool(safety.localJsonlOnly)
    }
  };
}

export function buildPaperTradeLifecycleDashboardAppScreen(options = {}) {
  const panel = options.panel || readPaperTradeLifecycleDashboardPanel(options);
  const normalized = normalizePanel(panel);

  return {
    ok: true,
    version: VERSION,
    route: "/app/paper-trade-lifecycle-dashboard",
    refreshRoute: normalized.refreshRoute,
    title: "Paper Trade Lifecycle Dashboard",
    displayState: "PAPER_TRADE_LIFECYCLE_DASHBOARD_READONLY",
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    panel: normalized,
    summary: normalized.summary,
    metrics: normalized.metrics,
    badges: normalized.badges,
    safety: normalized.safety
  };
}

export function renderPaperTradeLifecycleDashboardAppScreenHtml(screen = buildPaperTradeLifecycleDashboardAppScreen()) {
  const safe = screen && typeof screen === "object" ? screen : buildPaperTradeLifecycleDashboardAppScreen();
  const panel = safe.panel || normalizePanel({});
  const summary = safe.summary || panel.summary;
  const metrics = safe.metrics || panel.metrics;
  const safety = safe.safety || panel.safety;
  const badgeItems = (Array.isArray(safe.badges) ? safe.badges : []).map((badge) => {
    const value = badge.value ? "true" : "false";
    return `<li>${esc(badge.label)}: <strong>${esc(value)}</strong></li>`;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(safe.title)}</title>
</head>
<body>
  <main>
    <h1>${esc(safe.title)}</h1>
    <p>Read-only app screen for the local paper trade lifecycle dashboard. No broker contact, no order placement, no account mutation, and no execution controls are available.</p>

    <section>
      <h2>Lifecycle Status</h2>
      <p>Status: <strong>${esc(panel.status)}</strong></p>
      <p>Severity: <strong>${esc(panel.severity)}</strong></p>
      <p>Total records: <strong>${esc(metrics.totalRecordr)}</strong></p>
      <p>Lifecycle status: <strong>${esc(summary.lifecycleStatus)}</strong></p>
    </section>

    <section>
      <h2>Stage Summary</h2>
      <ul>
        <li>Intent: <strong>${esc(summary.intentStatus)}</strong></li>
        <li>Order ticket: <strong>${esc(summary.ticketStatus)}</strong></li>
        <li>Fill simulation: <strong>${esc(summary.fillStatus)}</strong></li>
        <li>Position state: <strong>${esc(summary.positionStatus)}</strong></li>
      </ul>
    </section>

    <section>
      <h2>Position Metrics</h2>
      <ul>
        <li>Position count: <strong>${esc(summary.positionCount)}</strong></li>
        <li>Open position count: <strong>${esc(summary.openPositionCount)}</strong></li>
        <li>Total cost basis: <strong>${esc(summary.totalCostBasis)}</strong></li>
        <li>Total realized PnL: <strong>${esc(summary.totalRealizedPnl)}</strong></li>
      </ul>
    </section>

    <section>
      <h2>Safety Locks</h2>
      <ul>
        <li>Broker contact allowed: <strong>${esc(safety.brokerContact)}</strong></li>
        <li>Order placement allowed: <strong>${esc(safety.orderPlacement)}</strong></li>
        <li>Account mutation allowed: <strong>${esc(safety.accountMutation)}</strong></li>
        <li>Broker execution allowed: <strong>${esc(safety.brokerExecution)}</strong></li>
        <li>Live trading allowed: <strong>${esc(safety.liveTrading)}</strong></li>
        <li>Auto trading allowed: <strong>${esc(safety.autoTrading)}</strong></li>
        <li>Local JSONL only: <strong>${esc(safety.localJsonlOnly)}</strong></li>
      </ul>
    </section>

    <section>
      <h2>Badges</h2>
      <ul>${badgeItems}</ul>
    </section>

    <p><a href="${esc(panel.route)}">Open diagnostics payload</a></p>
  <section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a> · <a href="/app/paper-broker-adapter-approval-record-tool">Paper Broker Adapter Approval Record Tool</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main>
</body>
</html>`;
}
