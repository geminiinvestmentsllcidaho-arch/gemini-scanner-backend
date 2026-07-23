import { readPaperTradeLifecycleRunnerAuditPanel } from "./paper_trade_lifecycle_runner_audit_panel.mjs";

export const VERSION = "paper_trade_lifecycle_runner_audit_app_screen_v1";

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
    auditVersion: text(panel.auditVersion, "unknown"),
    panelType: text(panel.panelType, "operator_dashboard_card"),
    title: text(panel.title, "Paper Trade Lifecycle Runner Audit"),
    route: text(panel.route, "/diagnostics/paper-trade-lifecycle-runner-audit"),
    refreshRoute: text(panel.refreshRoute, "/diagnostics/paper-trade-lifecycle-runner-audit-panel"),
    status: text(panel.status, "empty"),
    severity: text(panel.severity, "neutral"),
    monitorOnly: bool(panel.monitorOnly),
    previewOnly: bool(panel.previewOnly),
    paperOnly: bool(panel.paperOnly),
    recordCount: num(panel.recordCount, 0),
    hasRecords: bool(panel.hasRecords),
    summary: {
      latestStatus: text(summary.latestStatus, "empty"),
      lifecycleComplete: bool(summary.lifecycleComplete),
      lifecycleRecovered: bool(summary.lifecycleRecovered),
      lifecycleReplayNoop: bool(summary.lifecycleReplayNoop),
      resumedFromIntent: bool(summary.resumedFromIntent),
      resumedFromTicket: bool(summary.resumedFromTicket),
      resumedFromFill: bool(summary.resumedFromFill),
      positionAlreadyStored: bool(summary.positionAlreadyStored),
      intentCreated: bool(summary.intentCreated),
      ticketStored: bool(summary.ticketStored),
      fillStored: bool(summary.fillStored),
      positionStored: bool(summary.positionStored),
      wroteAnyRecord: bool(summary.wroteAnyRecord),
      latestIntentId: text(summary.latestIntentId, ""),
      latestTicketId: text(summary.latestTicketId, ""),
      latestFillId: text(summary.latestFillId, ""),
      latestPositionSnapshotId: text(summary.latestPositionSnapshotId, ""),
      openPositionCount: num(summary.openPositionCount, 0),
      totalCostBasis: num(summary.totalCostBasis, 0),
      totalRealizedPnl: num(summary.totalRealizedPnl, 0)
    },
    metrics: {
      recordCount: num(metrics.recordCount, num(panel.recordCount, 0)),
      latestLifecycleComplete: bool(metrics.latestLifecycleComplete),
      latestLifecycleRecovered: bool(metrics.latestLifecycleRecovered),
      latestLifecycleReplayNoop: bool(metrics.latestLifecycleReplayNoop),
      latestWroteAnyRecord: bool(metrics.latestWroteAnyRecord),
      openPositionCount: num(metrics.openPositionCount, 0),
      totalCostBasis: num(metrics.totalCostBasis, 0),
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

export function buildPaperTradeLifecycleRunnerAuditAppScreen(options = {}) {
  const panel = options.panel || readPaperTradeLifecycleRunnerAuditPanel(options);
  const normalized = normalizePanel(panel);

  return {
    ok: true,
    version: VERSION,
    route: "/app/paper-trade-lifecycle-runner-audit",
    refreshRoute: normalized.refreshRoute,
    title: "Paper Trade Lifecycle Runner Audit",
    displayState: "PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_READONLY",
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    auditOnly: true,
    noExecutionControls: true,
    panel: normalized,
    summary: normalized.summary,
    metrics: normalized.metrics,
    badges: normalized.badges,
    safety: normalized.safety
  };
}

export function renderPaperTradeLifecycleRunnerAuditAppScreenHtml(
  screen = buildPaperTradeLifecycleRunnerAuditAppScreen()
) {
  const safe =
    screen && typeof screen === "object"
      ? screen
      : buildPaperTradeLifecycleRunnerAuditAppScreen();
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
    <p>read-only app screen for the local paper trade lifecycle runner audit. No broker contact, no order placement, no account mutation, and no execution controls are available.</p>

    <section>
      <h2>Audit Status</h2>
      <p>Status: <strong>${esc(panel.status)}</strong></p>
      <p>Severity: <strong>${esc(panel.severity)}</strong></p>
      <p>Record count: <strong>${esc(panel.recordCount)}</strong></p>
      <p>Has records: <strong>${esc(panel.hasRecords)}</strong></p>
    </section>

    <section>
      <h2>Latest Audit Summary</h2>
      <ul>
        <li>Latest status: <strong>${esc(summary.latestStatus)}</strong></li>
        <li>Lifecycle complete: <strong>${esc(summary.lifecycleComplete)}</strong></li>
        <li>Recovered partial lifecycle: <strong>${esc(summary.lifecycleRecovered)}</strong></li>
        <li>Idempotent replay no-op: <strong>${esc(summary.lifecycleReplayNoop)}</strong></li>
        <li>Resumed from intent: <strong>${esc(summary.resumedFromIntent)}</strong></li>
        <li>Resumed from ticket: <strong>${esc(summary.resumedFromTicket)}</strong></li>
        <li>Resumed from fill: <strong>${esc(summary.resumedFromFill)}</strong></li>
        <li>Position already stored: <strong>${esc(summary.positionAlreadyStored)}</strong></li>
        <li>Intent created: <strong>${esc(summary.intentCreated)}</strong></li>
        <li>Ticket stored: <strong>${esc(summary.ticketStored)}</strong></li>
        <li>Fill stored: <strong>${esc(summary.fillStored)}</strong></li>
        <li>Position stored: <strong>${esc(summary.positionStored)}</strong></li>
        <li>Wrote any record: <strong>${esc(summary.wroteAnyRecord)}</strong></li>
        <li>Open position count: <strong>${esc(summary.openPositionCount)}</strong></li>
      </ul>
    </section>

    <section>
      <h2>Metrics</h2>
      <ul>
        <li>Record count: <strong>${esc(metrics.recordCount)}</strong></li>
        <li>Latest lifecycle complete: <strong>${esc(metrics.latestLifecycleComplete)}</strong></li>
        <li>Latest lifecycle recovered: <strong>${esc(metrics.latestLifecycleRecovered)}</strong></li>
        <li>Latest lifecycle replay no-op: <strong>${esc(metrics.latestLifecycleReplayNoop)}</strong></li>
        <li>Latest wrote any record: <strong>${esc(metrics.latestWroteAnyRecord)}</strong></li>
        <li>Open position count: <strong>${esc(metrics.openPositionCount)}</strong></li>
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
