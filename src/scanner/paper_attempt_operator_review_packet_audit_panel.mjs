import {
  buildPaperAttemptOperatorReviewPacketAudit,
} from "./paper_attempt_operator_review_packet_audit.mjs";

const VERSION = "paper_attempt_operator_review_packet_audit_panel_v1";

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
  const source = audit || buildPaperAttemptOperatorReviewPacketAudit({ persist: false });

  return {
    ok: safeBool(source.ok, false),
    version: safeString(source.version, "paper_attempt_operator_review_packet_audit_v1"),
    auditType: safeString(source.auditType, "paper_attempt_operator_review_packet_audit"),
    status: safeString(source.status, "audit_recorded_review_blocked_no_go"),
    auditOnly: safeBool(source.auditOnly, true),
    appendOnly: safeBool(source.appendOnly, true),
    immutableRecord: safeBool(source.immutableRecord, true),
    reviewOnly: safeBool(source.reviewOnly, true),
    noExecutionControls: safeBool(source.noExecutionControls, true),
    finalDecision: safeString(source.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    safety: {
      decisionAssistOnly: safeBool(source.safety?.decisionAssistOnly, true),
      monitorOnly: safeBool(source.safety?.monitorOnly, true),
      diagnosticsOnly: safeBool(source.safety?.diagnosticsOnly, true),
      auditOnly: safeBool(source.safety?.auditOnly, true),
      reviewOnly: safeBool(source.safety?.reviewOnly, true),
      noExecutionControls: safeBool(source.safety?.noExecutionControls, true),
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    },
    source: {
      route: safeString(source.source?.route, "/diagnostics/paper-attempt-operator-review-packet-panel"),
      viewRoute: safeString(source.source?.viewRoute, "/diagnostics/paper-attempt-operator-review-packet-panel-view"),
      version: safeString(source.source?.version, "paper_attempt_operator_review_packet_panel_v1"),
      panelType: safeString(source.source?.panelType, "operator_dashboard_card"),
      status: safeString(source.source?.status, "review_blocked_no_go"),
      blockerCount: safeNumber(source.source?.blockerCount, 0),
      finalDecision: safeString(source.source?.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
      reviewOnly: safeBool(source.source?.reviewOnly, true),
      noExecutionControls: safeBool(source.source?.noExecutionControls, true),
      brokerContactAllowed: safeBool(source.source?.brokerContactAllowed, false),
      brokerOrderPlacementAllowed: safeBool(source.source?.brokerOrderPlacementAllowed, false),
      sourceUnsafe: safeBool(source.source?.sourceUnsafe, false),
    },
    audit: {
      recordId: safeString(source.audit?.recordId, "missing_record_id"),
      createdAt: safeString(source.audit?.createdAt, new Date(0).toISOString()),
      ledgerPath: safeString(source.audit?.ledgerPath, "runs/paper_attempt_operator_review_packet_audit.jsonl"),
      persisted: safeBool(source.audit?.persisted, false),
      persistenceMode: safeString(source.audit?.persistenceMode, "preview_only"),
      schemaLocked: safeBool(source.audit?.schemaLocked, true),
    },
  };
}

export function buildPaperAttemptOperatorReviewPacketAuditPanel({ audit } = {}) {
  const normalizedAudit = normalizeAudit(audit);

  const issueFlags = [
    normalizedAudit.finalDecision !== "NO_GO_FOR_ORDER_PLACEMENT" ? "audit_final_decision_not_no_go" : null,
    normalizedAudit.safety.brokerContactAllowed !== false ? "broker_contact_not_locked" : null,
    normalizedAudit.safety.brokerOrderPlacementAllowed !== false ? "broker_order_placement_not_locked" : null,
    normalizedAudit.auditOnly !== true ? "audit_only_not_locked" : null,
    normalizedAudit.reviewOnly !== true ? "review_only_not_locked" : null,
    normalizedAudit.noExecutionControls !== true ? "execution_controls_not_locked" : null,
    normalizedAudit.source.sourceUnsafe ? "source_normalized_from_unsafe_state" : null,
  ].filter(Boolean);

  const blockerCount = Math.max(
    safeNumber(normalizedAudit.source.blockerCount, 0),
    issueFlags.length,
    normalizedAudit.finalDecision === "NO_GO_FOR_ORDER_PLACEMENT" ? 1 : 0
  );

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Operator Review Packet Audit",
    status: "audit_panel_review_blocked_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    reviewOnly: true,
    auditOnly: true,
    appendOnly: true,
    immutableRecord: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    blockerCount,
    issueFlags,
    summary: {
      headline: "Audit recorded; order placement remains blocked.",
      primaryAction: "Review audit only",
      secondaryAction: "No broker contact available",
      operatorMessage: "This panel displays audit state only and cannot create, submit, modify, or cancel orders.",
    },
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
    audit: {
      version: normalizedAudit.version,
      auditType: normalizedAudit.auditType,
      status: normalizedAudit.status,
      recordId: normalizedAudit.audit.recordId,
      ledgerPath: normalizedAudit.audit.ledgerPath,
      persisted: normalizedAudit.audit.persisted,
      persistenceMode: normalizedAudit.audit.persistenceMode,
      schemaLocked: normalizedAudit.audit.schemaLocked,
    },
    source: normalizedAudit.source,
  };
}

export function renderPaperAttemptOperatorReviewPacketAuditPanelHtml(panel) {
  const safePanel = panel || buildPaperAttemptOperatorReviewPacketAuditPanel();

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const rows = [
    ["Status", safePanel.status],
    ["Display State", safePanel.displayState],
    ["Final Decision", safePanel.finalDecision],
    ["Audit Only", safePanel.auditOnly],
    ["Review Only", safePanel.reviewOnly],
    ["No Execution Controls", safePanel.noExecutionControls],
    ["Broker Contact Allowed", safePanel.brokerContactAllowed],
    ["Broker Order Placement Allowed", safePanel.brokerOrderPlacementAllowed],
    ["Blocker Count", safePanel.blockerCount],
    ["Record ID", safePanel.audit?.recordId],
    ["Ledger Path", safePanel.audit?.ledgerPath],
    ["Persisted", safePanel.audit?.persisted],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Paper Attempt Operator Review Packet Audit Panel</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }
    .card { max-width: 980px; border: 1px solid #334155; border-radius: 14px; padding: 20px; background: #111827; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #7f1d1d; color: #fee2e2; font-weight: 700; }
    .note { margin-top: 12px; color: #cbd5e1; }
    table { border-collapse: collapse; width: 100%; margin-top: 18px; }
    td { border-top: 1px solid #334155; padding: 10px 8px; vertical-align: top; }
    td:first-child { color: #94a3b8; width: 300px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #020617; padding: 14px; border-radius: 10px; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${esc(safePanel.title)}</h1>
    <div class="badge">${esc(safePanel.finalDecision)}</div>
    <div class="note">${esc(safePanel.summary?.operatorMessage)}</div>
    <table>
      ${rows.map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join("\n      ")}
    </table>
    <h2>JSON</h2>
    <pre>${esc(JSON.stringify(safePanel, null, 2))}</pre>
  </div>
</body>
</html>`;
}

export default buildPaperAttemptOperatorReviewPacketAuditPanel;
