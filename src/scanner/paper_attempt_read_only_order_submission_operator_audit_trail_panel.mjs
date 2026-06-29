const VERSION = "paper_attempt_read_only_order_submission_operator_audit_trail_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeSummary(input = {}) {
  const prior = obj(input.summaryPanel || input.operatorSummaryPanel || input.priorSummaryPanel);
  const completion = obj(prior.completionSummary);
  const safety = obj(prior.safetySummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_chain_summarized_complete"),
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
    safetyOrderPlacementApproved: bool(safety.orderPlacementApproved, false),
    safetyBrokerRequestSent: bool(safety.brokerRequestSent, false),
    safetyBrokerResponseReceived: bool(safety.brokerResponseReceived, false),
    safetyContainsExecutableOrder: bool(safety.containsExecutableOrder, false),
    safetyContainsSecrets: bool(safety.containsSecrets, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel(input = {}) {
  const summary = summarizeSummary(input);

  const auditTrail = {
    readOnlyChainAudited: true,
    operatorReviewAudited: true,
    brokerRequestSent: false,
    brokerResponseReceived: false,
    executableOrderPresent: false,
    secretsPresent: false,
    accountMutationObserved: false,
    orderPlacementApproved: false,
    auditConclusion: "read_only_chain_complete_no_execution"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Audit Trail Panel",
    status: "order_submission_operator_audit_trail_complete_blocked_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    reviewOnly: true,
    auditOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorAuditTrailOnly: true,
    moduleStatus: "operator_read_only_audit_trail_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    summary,
    auditTrail,
    issueFlags: [
      "order_placement_not_ready",
      "operator_audit_trail_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel;
