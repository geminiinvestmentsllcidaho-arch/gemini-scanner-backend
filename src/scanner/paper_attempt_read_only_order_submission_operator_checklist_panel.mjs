const VERSION = "paper_attempt_read_only_order_submission_operator_checklist_panel_v1";

function check(id, label, passed, reason) {
  return { id, label, passed, status: passed ? "passed" : "blocked", reason };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorChecklistPanel(input = {}) {
  const life = input.lifecycleDiagnostic?.lifecycle ?? {
    current: "blocked_before_order_submission",
    brokerRequestSent: false,
    brokerResponseReceived: false,
    allStagesSafe: true
  };

  const checklist = [
    check("readiness_gate", "Order placement readiness gate", false, "order_placement_not_ready"),
    check("transport_lock", "Transport lock", life.brokerRequestSent === false, "broker_request_not_sent"),
    check("response_absence", "Broker response absence", life.brokerResponseReceived === false, "broker_response_not_received"),
    check("execution_controls", "Execution controls", true, "execution_controls_disabled"),
    check("operator_final_authorization", "Operator final authorization", false, "final_authorization_not_available")
  ];

  const summary = {
    total: checklist.length,
    passed: checklist.filter((i) => i.passed).length,
    blocked: checklist.filter((i) => !i.passed).length,
    allSafetyChecksPass: true,
    allBlockingChecksPass: false,
    readyForOrderPlacement: false
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Checklist Panel",
    displayState: "NO_GO",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    reviewOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorChecklistOnly: true,
    checklist,
    checklistSummary: summary,
    lifecycleSummary: life,
    diagnosticSummary: {
      brokerRequestSent: false,
      brokerResponseReceived: false,
      containsExecutableOrder: false,
      containsSecrets: false,
      safeForReadOnlyOperatorReview: true
    }
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorChecklistPanel;
