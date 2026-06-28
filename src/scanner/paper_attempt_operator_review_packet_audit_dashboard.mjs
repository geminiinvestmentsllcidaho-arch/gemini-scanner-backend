import {
  buildPaperAttemptOperatorReviewPacketAudit,
} from "./paper_attempt_operator_review_packet_audit.mjs";
import {
  buildPaperAttemptOperatorReviewPacketAuditPanel,
} from "./paper_attempt_operator_review_packet_audit_panel.mjs";

const VERSION = "paper_attempt_operator_review_packet_audit_dashboard_v1";

function safeString(value, fallback = "unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeAudit(audit) {
  const a = audit || buildPaperAttemptOperatorReviewPacketAudit({ persist: false });
  return {
    ok: safeBool(a.ok, false),
    version: safeString(a.version, "paper_attempt_operator_review_packet_audit_v1"),
    auditType: safeString(a.auditType, "paper_attempt_operator_review_packet_audit"),
    status: safeString(a.status, "audit_recorded_review_blocked_no_go"),
    finalDecision: safeString(a.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    auditOnly: safeBool(a.auditOnly, true),
    appendOnly: safeBool(a.appendOnly, true),
    immutableRecord: safeBool(a.immutableRecord, true),
    reviewOnly: safeBool(a.reviewOnly, true),
    noExecutionControls: safeBool(a.noExecutionControls, true),
    source: {
      status: safeString(a.source?.status, "review_blocked_no_go"),
      blockerCount: safeNumber(a.source?.blockerCount, 0),
      sourceUnsafe: safeBool(a.source?.sourceUnsafe, false),
      brokerContactAllowed: safeBool(a.source?.brokerContactAllowed, false),
      brokerOrderPlacementAllowed: safeBool(a.source?.brokerOrderPlacementAllowed, false),
    },
    audit: {
      recordId: safeString(a.audit?.recordId, "missing_record_id"),
      createdAt: safeString(a.audit?.createdAt, new Date(0).toISOString()),
      ledgerPath: safeString(a.audit?.ledgerPath, "runs/paper_attempt_operator_review_packet_audit.jsonl"),
      persisted: safeBool(a.audit?.persisted, false),
      persistenceMode: safeString(a.audit?.persistenceMode, "preview_only"),
      schemaLocked: safeBool(a.audit?.schemaLocked, true),
    },
    safety: {
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
    },
  };
}

function normalizePanel(panel) {
  const p = panel || buildPaperAttemptOperatorReviewPacketAuditPanel();
  return {
    ok: safeBool(p.ok, false),
    version: safeString(p.version, "paper_attempt_operator_review_packet_audit_panel_v1"),
    panelType: safeString(p.panelType, "operator_dashboard_card"),
    title: safeString(p.title, "Paper Attempt Operator Review Packet Audit"),
    status: safeString(p.status, "audit_panel_review_blocked_no_go"),
    severity: safeString(p.severity, "blocked"),
    displayState: safeString(p.displayState, "NO_GO"),
    finalDecision: safeString(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    blockerCount: safeNumber(p.blockerCount, 1),
    issueFlags: Array.isArray(p.issueFlags) ? p.issueFlags.map(String) : [],
    auditOnly: safeBool(p.auditOnly, true),
    reviewOnly: safeBool(p.reviewOnly, true),
    noExecutionControls: safeBool(p.noExecutionControls, true),
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
  };
}

export function buildPaperAttemptOperatorReviewPacketAuditDashboard({ audit, panel } = {}) {
  const normalizedAudit = normalizeAudit(audit);
  const normalizedPanel = normalizePanel(panel || buildPaperAttemptOperatorReviewPacketAuditPanel({ audit: normalizedAudit }));

  const routeChecks = {
    auditOk: normalizedAudit.ok === true,
    panelOk: normalizedPanel.ok === true,
    auditNoGo: normalizedAudit.finalDecision === "NO_GO_FOR_ORDER_PLACEMENT",
    panelNoGo: normalizedPanel.finalDecision === "NO_GO_FOR_ORDER_PLACEMENT",
    brokerContactBlocked: normalizedAudit.safety.brokerContactAllowed === false && normalizedPanel.brokerContactAllowed === false,
    brokerOrderPlacementBlocked:
      normalizedAudit.safety.brokerOrderPlacementAllowed === false && normalizedPanel.brokerOrderPlacementAllowed === false,
    executionControlsAbsent: normalizedAudit.noExecutionControls === true && normalizedPanel.noExecutionControls === true,
    reviewOnly: normalizedAudit.reviewOnly === true && normalizedPanel.reviewOnly === true,
    auditOnly: normalizedAudit.auditOnly === true && normalizedPanel.auditOnly === true,
  };

  const failedChecks = Object.entries(routeChecks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);

  const dashboardItems = [
    {
      id: "audit_record",
      label: "Audit Record",
      status: normalizedAudit.status,
      value: normalizedAudit.audit.recordId,
    },
    {
      id: "audit_panel",
      label: "Audit Panel",
      status: normalizedPanel.status,
      value: normalizedPanel.displayState,
    },
    {
      id: "broker_contact",
      label: "Broker Contact",
      status: "blocked",
      value: "false",
    },
    {
      id: "order_placement",
      label: "Order Placement",
      status: "blocked",
      value: "false",
    },
    {
      id: "final_decision",
      label: "Final Decision",
      status: "blocked",
      value: "NO_GO_FOR_ORDER_PLACEMENT",
    },
  ];

  return {
    ok: true,
    version: VERSION,
    dashboardType: "operator_review_audit_dashboard",
    title: "Paper Attempt Operator Review Packet Audit Dashboard",
    status: "dashboard_review_blocked_no_go",
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
    failedCheckCount: failedChecks.length,
    failedChecks,
    blockerCount: Math.max(1, normalizedAudit.source.blockerCount, normalizedPanel.blockerCount, failedChecks.length),
    summary: {
      headline: "Audit dashboard assembled; order placement remains blocked.",
      operatorMessage: "This dashboard is read-only and cannot create, submit, modify, or cancel orders.",
      nextSafeAction: "Continue review-only diagnostics or build the next read-only control layer.",
    },
    routeChecks,
    dashboardItems,
    audit: normalizedAudit,
    panel: normalizedPanel,
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

export function renderPaperAttemptOperatorReviewPacketAuditDashboardHtml(dashboard) {
  const safeDashboard = dashboard || buildPaperAttemptOperatorReviewPacketAuditDashboard();

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const rows = [
    ["Status", safeDashboard.status],
    ["Display State", safeDashboard.displayState],
    ["Final Decision", safeDashboard.finalDecision],
    ["Ready For Order Placement", safeDashboard.readyForOrderPlacement],
    ["Review Only", safeDashboard.reviewOnly],
    ["Audit Only", safeDashboard.auditOnly],
    ["No Execution Controls", safeDashboard.noExecutionControls],
    ["Broker Contact Allowed", safeDashboard.brokerContactAllowed],
    ["Broker Order Placement Allowed", safeDashboard.brokerOrderPlacementAllowed],
    ["Blocker Count", safeDashboard.blockerCount],
    ["Failed Check Count", safeDashboard.failedCheckCount],
    ["Audit Record ID", safeDashboard.audit?.audit?.recordId],
  ];

  const itemRows = (safeDashboard.dashboardItems || [])
    .map((item) => `<tr><td>${esc(item.label)}</td><td>${esc(item.status)}</td><td>${esc(item.value)}</td></tr>`)
    .join("\n      ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Paper Attempt Operator Review Packet Audit Dashboard</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }
    .card { max-width: 1100px; border: 1px solid #334155; border-radius: 14px; padding: 20px; background: #111827; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #7f1d1d; color: #fee2e2; font-weight: 700; }
    .note { margin-top: 12px; color: #cbd5e1; }
    table { border-collapse: collapse; width: 100%; margin-top: 18px; }
    td, th { border-top: 1px solid #334155; padding: 10px 8px; vertical-align: top; text-align: left; }
    td:first-child { color: #94a3b8; width: 300px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #020617; padding: 14px; border-radius: 10px; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${esc(safeDashboard.title)}</h1>
    <div class="badge">${esc(safeDashboard.finalDecision)}</div>
    <div class="note">${esc(safeDashboard.summary?.operatorMessage)}</div>
    <table>
      ${rows.map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join("\n      ")}
    </table>
    <h2>Dashboard Items</h2>
    <table>
      <tr><th>Item</th><th>Status</th><th>Value</th></tr>
      ${itemRows}
    </table>
    <h2>JSON</h2>
    <pre>${esc(JSON.stringify(safeDashboard, null, 2))}</pre>
  </div>
</body>
</html>`;
}

export default buildPaperAttemptOperatorReviewPacketAuditDashboard;
