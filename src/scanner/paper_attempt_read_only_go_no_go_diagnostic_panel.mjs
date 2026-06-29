const VERSION = "paper_attempt_read_only_go_no_go_diagnostic_panel_v1";

function isoNow(now) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildPaperAttemptReadOnlyGoNoGoDiagnosticPanel({ now = new Date() } = {}) {
  const decisionChecklist = [
    {
      id: "planning_diagnostic_reviewed",
      label: "Read-only planning diagnostic panel reviewed",
      status: "review_required",
      readOnly: true
    },
    {
      id: "manual_go_no_go_required",
      label: "Manual go/no-go decision required",
      status: "not_approved",
      readOnly: true
    },
    {
      id: "execution_authorization_absent",
      label: "Execution authorization absent",
      status: "locked",
      readOnly: true
    },
    {
      id: "broker_order_path_disabled",
      label: "Broker order path disabled",
      status: "locked",
      readOnly: true
    }
  ];

  const blockers = [
    "manual_go_no_go_not_approved",
    "execution_authorization_absent",
    "broker_execution_disabled",
    "order_placement_not_ready"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Go/No-Go Diagnostic Panel",
    status: "manual_go_no_go_review_only",
    severity: "blocked",
    displayState: "READ_ONLY_GO_NO_GO_DIAGNOSTIC",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    planningOnly: true,
    goNoGoOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    manualDecision: {
      required: true,
      current: "not_approved",
      approvalRecordAllowed: false,
      executionAuthorizationAllowed: false,
      recordMode: "diagnostic_only"
    },
    decisionChecklist,
    blockers,
    diagnosticSummary: {
      checklistItems: decisionChecklist.length,
      blockerCount: blockers.length,
      allExecutionControlsDisabled: true,
      operatorActionRequired: true,
      goNoGoStatus: "not_approved"
    },
    nextReadOnlyActions: [
      "review_planning_diagnostic_panel",
      "confirm_manual_go_no_go_remains_diagnostic_only",
      "keep_broker_execution_disabled"
    ],
    generatedAt: isoNow(now)
  };
}

export default buildPaperAttemptReadOnlyGoNoGoDiagnosticPanel;
