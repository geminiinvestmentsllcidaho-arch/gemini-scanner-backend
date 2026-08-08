const VERSION = "paper_attempt_read_only_order_placement_diagnostic_panel_v1";

function isoNow(now) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildPaperAttemptReadOnlyOrderPlacementDiagnosticPanel({ now = new Date() } = {}) {
  const orderPlacementChecklist = [
    {
      id: "broker_execution_path_diagnostic_reviewed",
      label: "Read-only broker execution path diagnostic panel reviewed",
      status: "review_required",
      readOnly: true
    },
    {
      id: "order_placement_endpoint_disabled",
      label: "Order placement endpoint disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "order_submission_function_disabled",
      label: "Order submission function disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "broker_and_account_mutation_disabled",
      label: "Broker and account mutation disabled",
      status: "locked",
      readOnly: true
    }
  ];

  const blockers = [
    "order_placement_endpoint_disabled",
    "order_submission_function_disabled",
    "broker_contact_disabled",
    "account_mutation_disabled"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Placement Diagnostic Panel",
    status: "order_placement_diagnostic_review_only",
    severity: "blocked",
    displayState: "READ_ONLY_ORDER_PLACEMENT_DIAGNOSTIC",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    planningOnly: true,
    brokerExecutionPathOnly: true,
    orderPlacementOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    brokerExecutionAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderPlacement: {
      requiredBeforeExecution: true,
      current: "disabled",
      endpointAllowed: false,
      submitFunctionAllowed: false,
      brokerContactAllowed: false,
      brokerExecutionAllowed: false,
      accountMutationAllowed: false,
      orderPlacementAllowed: false,
      executionMode: "diagnostic_only"
    },
    orderPlacementChecklist,
    blockers,
    diagnosticSummary: {
      checklistItems: orderPlacementChecklist.length,
      blockerCount: blockers.length,
      allExecutionControlsDisabled: true,
      operatorActionRequired: true,
      orderPlacementStatus: "disabled"
    },
    nextReadOnlyActions: [
      "review_broker_execution_path_diagnostic_panel",
      "confirm_order_placement_remains_disabled",
      "keep_order_submission_function_disabled",
      "keep_broker_contact_disabled",
      "keep_account_mutation_disabled"
    ],
    generatedAt: isoNow(now)
  };
}

export default buildPaperAttemptReadOnlyOrderPlacementDiagnosticPanel;
