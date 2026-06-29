const VERSION = "paper_attempt_read_only_approval_record_diagnostic_panel_v1";

function isoNow(now) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildPaperAttemptReadOnlyApprovalRecordDiagnosticPanel({ now = new Date() } = {}) {
  const approvalChecklist = [
    {
      id: "go_no_go_diagnostic_reviewed",
      label: "Read-only go/no-go diagnostic panel reviewed",
      status: "review_required",
      readOnly: true
    },
    {
      id: "approval_record_creation_disabled",
      label: "Approval record creation disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "execution_authorization_disabled",
      label: "Execution authorization disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "broker_order_submission_disabled",
      label: "Broker order submission disabled",
      status: "locked",
      readOnly: true
    }
  ];

  const blockers = [
    "approval_record_creation_disabled",
    "execution_authorization_disabled",
    "broker_execution_disabled",
    "order_placement_not_ready"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Approval Record Diagnostic Panel",
    status: "approval_record_diagnostic_review_only",
    severity: "blocked",
    displayState: "READ_ONLY_APPROVAL_RECORD_DIAGNOSTIC",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    planningOnly: true,
    goNoGoOnly: true,
    approvalRecordOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    approvalRecord: {
      requiredBeforeExecution: true,
      current: "not_created",
      creationAllowed: false,
      mutationAllowed: false,
      executionAuthorizationAllowed: false,
      recordMode: "diagnostic_only"
    },
    approvalChecklist,
    blockers,
    diagnosticSummary: {
      checklistItems: approvalChecklist.length,
      blockerCount: blockers.length,
      allExecutionControlsDisabled: true,
      operatorActionRequired: true,
      approvalRecordStatus: "not_created"
    },
    nextReadOnlyActions: [
      "review_go_no_go_diagnostic_panel",
      "confirm_approval_record_remains_diagnostic_only",
      "keep_execution_authorization_disabled",
      "keep_broker_order_submission_disabled"
    ],
    generatedAt: isoNow(now)
  };
}

export default buildPaperAttemptReadOnlyApprovalRecordDiagnosticPanel;
