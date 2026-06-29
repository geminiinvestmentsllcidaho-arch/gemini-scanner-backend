const VERSION = "paper_attempt_read_only_broker_execution_path_diagnostic_panel_v1";

function isoNow(now) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildPaperAttemptReadOnlyBrokerExecutionPathDiagnosticPanel({ now = new Date() } = {}) {
  const brokerPathChecklist = [
    {
      id: "execution_authorization_diagnostic_reviewed",
      label: "Read-only execution authorization diagnostic panel reviewed",
      status: "review_required",
      readOnly: true
    },
    {
      id: "broker_contact_disabled",
      label: "Broker contact disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "broker_order_submission_disabled",
      label: "Broker order submission disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "account_mutation_disabled",
      label: "Account mutation disabled",
      status: "locked",
      readOnly: true
    }
  ];

  const blockers = [
    "broker_contact_disabled",
    "broker_order_submission_disabled",
    "account_mutation_disabled",
    "order_placement_not_ready"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Broker Execution Path Diagnostic Panel",
    status: "broker_execution_path_diagnostic_review_only",
    severity: "blocked",
    displayState: "READ_ONLY_BROKER_EXECUTION_PATH_DIAGNOSTIC",
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
    brokerExecutionPathOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    brokerExecutionAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    brokerExecutionPath: {
      requiredBeforeExecution: true,
      current: "disabled",
      brokerContactAllowed: false,
      brokerOrderSubmissionAllowed: false,
      brokerExecutionAllowed: false,
      accountMutationAllowed: false,
      orderPlacementAllowed: false,
      executionMode: "diagnostic_only"
    },
    brokerPathChecklist,
    blockers,
    diagnosticSummary: {
      checklistItems: brokerPathChecklist.length,
      blockerCount: blockers.length,
      allExecutionControlsDisabled: true,
      operatorActionRequired: true,
      brokerExecutionPathStatus: "disabled"
    },
    nextReadOnlyActions: [
      "review_execution_authorization_diagnostic_panel",
      "confirm_broker_execution_path_remains_disabled",
      "keep_broker_contact_disabled",
      "keep_order_submission_disabled",
      "keep_account_mutation_disabled"
    ],
    generatedAt: isoNow(now)
  };
}

export default buildPaperAttemptReadOnlyBrokerExecutionPathDiagnosticPanel;
