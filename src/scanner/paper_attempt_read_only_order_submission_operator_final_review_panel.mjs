const VERSION = "paper_attempt_read_only_order_submission_operator_final_review_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeDecision(input = {}) {
  const prior = obj(input.decisionPanel || input.operatorDecisionPanel || input.priorDecisionPanel);
  const decision = obj(prior.decision);

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
    current: str(decision.current, "no_go_for_order_placement"),
    operatorAction: str(decision.operatorAction, "review_only"),
    orderPlacementApproved: bool(decision.orderPlacementApproved, false),
    brokerRequestSent: bool(decision.brokerRequestSent, false),
    brokerResponseReceived: bool(decision.brokerResponseReceived, false),
    executableOrderPresent: bool(decision.executableOrderPresent, false),
    secretsPresent: bool(decision.secretsPresent, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorFinalReviewPanel(input = {}) {
  const decisionSummary = summarizeDecision(input);

  const finalReview = {
    conclusion: "NO_GO_FOR_ORDER_PLACEMENT",
    operatorInstruction: "REVIEW_ONLY_DO_NOT_PLACE_ORDER",
    orderPlacementApproved: false,
    brokerContactApproved: false,
    executionControlsAvailable: false,
    accountMutationApproved: false,
    reason: "read_only_order_submission_chain_remains_blocked"
  };

  const diagnosticSummary = {
    brokerRequestSent: false,
    brokerResponseReceived: false,
    containsExecutableOrder: false,
    containsSecrets: false,
    safeForReadOnlyOperatorReview: true
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Final Review Panel",
    status: "order_submission_operator_final_review_blocked_no_go",
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
    orderSubmissionOperatorFinalReviewOnly: true,
    decisionSummary,
    finalReview,
    issueFlags: [
      "order_placement_not_ready",
      "operator_final_review_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ],
    diagnosticSummary
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorFinalReviewPanel;
