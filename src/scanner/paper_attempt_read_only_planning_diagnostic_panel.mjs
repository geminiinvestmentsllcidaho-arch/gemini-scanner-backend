const VERSION = "paper_attempt_read_only_planning_diagnostic_panel_v1";

export function buildPaperAttemptReadOnlyPlanningDiagnosticPanel() {
  const planningChecklist = [
    {
      id: "operator_review_packet_present",
      label: "Operator review packet present",
      status: "review_required",
      readOnly: true
    },
    {
      id: "summary_panel_reviewed",
      label: "Read-only operator summary panel reviewed",
      status: "review_required",
      readOnly: true
    },
    {
      id: "candidate_inputs_verified",
      label: "Candidate symbol, action, entry, exit, and risk inputs verified",
      status: "blocked_until_operator_review",
      readOnly: true
    },
    {
      id: "broker_execution_disabled",
      label: "Broker execution path disabled",
      status: "locked",
      readOnly: true
    }
  ];

  const blockers = [
    "operator_review_required",
    "order_placement_not_ready",
    "broker_execution_disabled"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Planning Diagnostic Panel",
    status: "planning_diagnostic_review_only",
    severity: "blocked",
    displayState: "READ_ONLY_PLANNING_DIAGNOSTIC",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    planningOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    planningChecklist,
    blockers,
    diagnosticSummary: {
      checklistItems: planningChecklist.length,
      blockerCount: blockers.length,
      allExecutionControlsDisabled: true,
      operatorActionRequired: true
    },
    nextReadOnlyActions: [
      "review_operator_summary_panel",
      "verify_candidate_inputs_without_broker_contact"
    ],
    generatedAt: new Date().toISOString()
  };
}

export default buildPaperAttemptReadOnlyPlanningDiagnosticPanel;
