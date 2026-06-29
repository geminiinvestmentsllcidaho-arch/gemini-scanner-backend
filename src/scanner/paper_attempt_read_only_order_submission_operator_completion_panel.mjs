const VERSION = "paper_attempt_read_only_order_submission_operator_completion_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeFinalReview(input = {}) {
  const prior = obj((input.finalReviewPanel || input.operatorFinalReviewPanel || input.priorFinalReviewPanel));
  const finalReview = obj(prior.finalReview);
  const diag = obj(prior.diagnosticSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    displayState: str(prior.displayState, "NO_GO"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    conclusion: str(finalReview.conclusion, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorInstruction: str(finalReview.operatorInstruction, "REVIEW_ONLY_DO_NOT_PLACE_ORDER"),
    orderPlacementApproved: bool(finalReview.orderPlacementApproved, false),
    brokerContactApproved: bool(finalReview.brokerContactApproved, false),
    executionControlsAvailable: bool(finalReview.executionControlsAvailable, false),
    accountMutationApproved: bool(finalReview.accountMutationApproved, false),
    brokerRequestSent: bool(diag.brokerRequestSent, false),
    brokerResponseReceived: bool(diag.brokerResponseReceived, false),
    containsExecutableOrder: bool(diag.containsExecutableOrder, false),
    containsSecrets: bool(diag.containsSecrets, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorCompletionPanel(input = {}) {
  const finalReviewSummary = summarizeFinalReview(input);

  const completionSummary = {
    readOnlyChainComplete: true,
    safeForOperatorReview: true,
    readyForOrderPlacement: false,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    finalReviewConclusion: "NO_GO_FOR_ORDER_PLACEMENT"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Completion Panel",
    status: "order_submission_operator_completion_review_blocked_no_go",
    severity: "blocked",
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
    orderSubmissionOperatorCompletionOnly: true,
    moduleStatus: "complete_for_read_only_operator_review",
    implementationStatus: "read_only_diagnostics_complete_no_order_submission",
    completionStatus: "review_chain_complete_order_submission_blocked",
    finalReviewSummary,
    completionSummary,
    issueFlags: [
      "order_placement_not_ready",
      "operator_completion_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ],
    diagnosticSummary: {
      brokerRequestSent: false,
      brokerResponseReceived: false,
      containsExecutableOrder: false,
      containsSecrets: false,
      safeForReadOnlyOperatorReview: true
    }
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorCompletionPanel;
