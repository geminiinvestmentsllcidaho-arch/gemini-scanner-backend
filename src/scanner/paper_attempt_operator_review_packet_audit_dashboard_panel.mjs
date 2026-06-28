import {
  buildPaperAttemptOperatorReviewPacketAuditDashboard,
} from "./paper_attempt_operator_review_packet_audit_dashboard.mjs";

const VERSION = "paper_attempt_operator_review_packet_audit_dashboard_panel_v1";

function safeString(value, fallback = "unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeDashboard(dashboard) {
  const d = dashboard || buildPaperAttemptOperatorReviewPacketAuditDashboard();

  return {
    ok: safeBool(d.ok, false),
    version: safeString(d.version, "paper_attempt_operator_review_packet_audit_dashboard_v1"),
    dashboardType: safeString(d.dashboardType, "operator_review_audit_dashboard"),
    title: safeString(d.title, "Paper Attempt Operator Review Packet Audit Dashboard"),
    status: safeString(d.status, "dashboard_review_blocked_no_go"),
    severity: safeString(d.severity, "blocked"),
    displayState: safeString(d.displayState, "NO_GO"),
    finalDecision: safeString(d.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    readyForOrderPlacement: false,
    reviewOnly: safeBool(d.reviewOnly, true),
    auditOnly: safeBool(d.auditOnly, true),
    diagnosticsOnly: safeBool(d.diagnosticsOnly, true),
    monitorOnly: safeBool(d.monitorOnly, true),
    noExecutionControls: safeBool(d.noExecutionControls, true),
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    failedCheckCount: safeNumber(d.failedCheckCount, 0),
    failedChecks: Array.isArray(d.failedChecks) ? d.failedChecks.map(String) : [],
    blockerCount: Math.max(1, safeNumber(d.blockerCount, 1)),
    routeChecks: d.routeChecks && typeof d.routeChecks === "object" ? d.routeChecks : {},
    dashboardItems: Array.isArray(d.dashboardItems) ? d.dashboardItems : [],
    summary: {
      headline: safeString(d.summary?.headline, "Audit dashboard assembled; order placement remains blocked."),
      operatorMessage: safeString(
        d.summary?.operatorMessage,
        "This dashboard is read-only and cannot create, submit, modify, or cancel orders."
      ),
      nextSafeAction: safeString(
        d.summary?.nextSafeAction,
        "Continue review-only diagnostics or build the next read-only control layer."
      ),
    },
  };
}

export function buildPaperAttemptOperatorReviewPacketAuditDashboardPanel({ dashboard } = {}) {
  const normalizedDashboard = normalizeDashboard(dashboard);

  const issueFlags = [
    ...(normalizedDashboard.failedChecks || []).map((item) => `failed_check:${item}`),
    ...(normalizedDashboard.readyForOrderPlacement === false ? ["order_placement_not_ready"] : []),
    ...(normalizedDashboard.brokerContactAllowed === false ? ["broker_contact_blocked"] : []),
    ...(normalizedDashboard.brokerOrderPlacementAllowed === false ? ["broker_order_placement_blocked"] : []),
  ];

  const compactMetrics = {
    failedCheckCount: normalizedDashboard.failedCheckCount,
    blockerCount: Math.max(1, normalizedDashboard.blockerCount, issueFlags.length),
    dashboardItemCount: normalizedDashboard.dashboardItems.length,
    routeCheckCount: Object.keys(normalizedDashboard.routeChecks || {}).length,
    safeRouteCheckCount: Object.values(normalizedDashboard.routeChecks || {}).filter((value) => value === true).length,
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Operator Review Packet Audit Dashboard",
    status: "audit_dashboard_panel_review_blocked_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    issueFlags,
    compactMetrics,
    summary: {
      headline: "Audit dashboard panel assembled; order placement remains blocked.",
      primaryAction: "Review dashboard only",
      secondaryAction: "No broker contact available",
      operatorMessage: "This panel summarizes the audit dashboard only and cannot create, submit, modify, or cancel orders.",
    },
    card: {
      badge: "NO_GO",
      tone: "blocked",
      headline: "NO GO FOR ORDER PLACEMENT",
      subheadline: normalizedDashboard.summary.headline,
      rows: [
        { label: "Final Decision", value: "NO_GO_FOR_ORDER_PLACEMENT" },
        { label: "Ready For Order Placement", value: false },
        { label: "Broker Contact Allowed", value: false },
        { label: "Broker Order Placement Allowed", value: false },
        { label: "Failed Checks", value: normalizedDashboard.failedCheckCount },
        { label: "Blockers", value: compactMetrics.blockerCount },
      ],
    },
    dashboard: normalizedDashboard,
    safety: {
      decisionAssistOnly: true,
      monitorOnly: true,
      diagnosticsOnly: true,
      auditOnly: true,
      reviewOnly: true,
      noExecutionControls: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    },
  };
}

export function renderPaperAttemptOperatorReviewPacketAuditDashboardPanelHtml(panel) {
  const safePanel = panel || buildPaperAttemptOperatorReviewPacketAuditDashboardPanel();

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const rows = safePanel.card.rows
    .map((row) => `<tr><td>${esc(row.label)}</td><td>${esc(row.value)}</td></tr>`)
    .join("\n      ");

  const issueRows = (safePanel.issueFlags || [])
    .map((flag) => `<li>${esc(flag)}</li>`)
    .join("\n      ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Paper Attempt Operator Review Packet Audit Dashboard Panel</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }
    .card { max-width: 900px; border: 1px solid #334155; border-radius: 14px; padding: 20px; background: #111827; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #7f1d1d; color: #fee2e2; font-weight: 700; }
    .note { margin-top: 12px; color: #cbd5e1; }
    table { border-collapse: collapse; width: 100%; margin-top: 18px; }
    td { border-top: 1px solid #334155; padding: 10px 8px; vertical-align: top; }
    td:first-child { color: #94a3b8; width: 280px; }
    ul { color: #fecaca; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #020617; padding: 14px; border-radius: 10px; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${esc(safePanel.title)}</h1>
    <div class="badge">${esc(safePanel.card.badge)}</div>
    <div class="note">${esc(safePanel.summary.operatorMessage)}</div>
    <table>
      ${rows}
    </table>
    <h2>Issue Flags</h2>
    <ul>
      ${issueRows}
    </ul>
    <h2>JSON</h2>
    <pre>${esc(JSON.stringify(safePanel, null, 2))}</pre>
  </div>
</body>
</html>`;
}

export default buildPaperAttemptOperatorReviewPacketAuditDashboardPanel;
