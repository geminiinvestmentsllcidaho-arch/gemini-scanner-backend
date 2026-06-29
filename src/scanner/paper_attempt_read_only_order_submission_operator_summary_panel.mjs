const VERSION = "paper_attempt_read_only_order_submission_operator_summary_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeCompletion(input = {}) {
  const prior = obj(input.completionPanel || input.operatorCompletionPanel || input.priorCompletionPanel);
  const completion = obj(prior.completionSummary);
  const diag = obj(prior.diagnosticSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    completionStatus: str(prior.completionStatus, "review_chain_complete_order_submission_blocked"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    readOnlyChainComplete: bool(completion.readOnlyChainComplete, true),
    orderPlacementApproved: bool(completion.orderPlacementApproved, false),
    noBrokerRequestSent: bool(completion.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(completion.noBrokerResponseReceived, true),
    noExecutableOrder: bool(completion.noExecutableOrder, true),
    noSecrets: bool(completion.noSecrets, true),
    diagnosticBrokerRequestSent: bool(diag.brokerRequestSent, false),
    diagnosticBrokerResponseReceived: bool(diag.brokerResponseReceived, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel(input = {}) {
  const completionSummary = summarizeCompletion(input);

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Summary Panel",
    status: "order_submission_operator_summary_complete_blocked_no_go",
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
    orderSubmissionOperatorSummaryOnly: true,
    moduleStatus: "operator_read_only_chain_summarized_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    completionSummary,
    safetySummary: {
      orderPlacementApproved: false,
      brokerContactApproved: false,
      executionControlsAvailable: false,
      accountMutationApproved: false,
      brokerRequestSent: false,
      brokerResponseReceived: false,
      containsExecutableOrder: false,
      containsSecrets: false
    },
    issueFlags: [
      "order_placement_not_ready",
      "operator_summary_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel;
