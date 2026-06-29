const VERSION = "paper_attempt_read_only_execution_authorization_diagnostic_panel_v1";

function isoNow(now) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildPaperAttemptReadOnlyExecutionAuthorizationDiagnosticPanel({ now = new Date() } = {}) {
  const authorizationChecklist = [
    {
      id: "approval_record_diagnostic_reviewed",
      label: "Read-only approval record diagnostic panel reviewed",
      status: "review_required",
      readOnly: true
    },
    {
      id: "execution_authorization_creation_disabled",
      label: "Execution authorization creation disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "execution_authorization_mutation_disabled",
      label: "Execution authorization mutation disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "broker_execution_path_disabled",
      label: "Broker execution path disabled",
      status: "locked",
      readOnly: true
    }
  ];

  const blockers = [
    "execution_authorization_creation_disabled",
    "execution_authorization_mutation_disabled",
    "broker_execution_disabled",
    "order_placement_not_ready"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Execution Authorization Diagnostic Panel",
    status: "execution_authorization_diagnostic_review_only",
    severity: "blocked",
    displayState: "READ_ONLY_EXECUTION_AUTHORIZATION_DIAGNOSTIC",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    planningOnly: true,
    goNoGoOnly: true,
    approvalRecordOnly: true,
    executionAuthorizationOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    executionAuthorization: {
      requiredBeforeExecution: true,
      current: "not_authorized",
      creationAllowed: false,
      mutationAllowed: false,
      brokerExecutionAllowed: false,
      orderPlacementAllowed: false,
      authorizationMode: "diagnostic_only"
    },
    authorizationChecklist,
    blockers,
    diagnosticSummary: {
      checklistItems: authorizationChecklist.length,
      blockerCount: blockers.length,
      allExecutionControlsDisabled: true,
      operatorActionRequired: true,
      executionAuthorizationStatus: "not_authorized"
    },
    nextReadOnlyActions: [
      "review_approval_record_diagnostic_panel",
      "confirm_execution_authorization_remains_diagnostic_only",
      "keep_broker_execution_disabled",
      "keep_order_placement_disabled"
    ],
    generatedAt: isoNow(now)
  };
}

export default buildPaperAttemptReadOnlyExecutionAuthorizationDiagnosticPanel;
