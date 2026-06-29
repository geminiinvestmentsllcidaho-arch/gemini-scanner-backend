const VERSION = "paper_attempt_read_only_order_submission_operator_archive_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeCloseout(input = {}) {
  const prior = obj(input.closeoutPanel || input.operatorCloseoutPanel || input.priorCloseoutPanel);
  const closeout = obj(prior.closeout);
  const evidence = obj(prior.evidenceSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_closeout_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    closeoutOnly: bool(prior.closeoutOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    closeoutStatus: str(closeout.closeoutStatus, "closed_read_only_no_order_submission"),
    readOnlyChainClosed: bool(closeout.readOnlyChainClosed, true),
    evidencePacketReviewed: bool(closeout.evidencePacketReviewed, true),
    finalNoGoRecorded: bool(closeout.finalNoGoRecorded, true),
    orderPlacementApproved: bool(closeout.orderPlacementApproved, false),
    brokerContactApproved: bool(closeout.brokerContactApproved, false),
    noBrokerRequestSent: bool(closeout.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(closeout.noBrokerResponseReceived, true),
    noExecutableOrder: bool(closeout.noExecutableOrder, true),
    noSecrets: bool(closeout.noSecrets, true),
    accountMutationObserved: bool(closeout.accountMutationObserved, false),
    evidenceOrderPlacementApproved: bool(evidence.orderPlacementApproved, false),
    evidenceNoBrokerRequestSent: bool(evidence.noBrokerRequestSent, true)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel(input = {}) {
  const closeoutSummary = summarizeCloseout(input);

  const archive = {
    archiveStatus: "archived_read_only_no_order_submission",
    readOnlyArchiveComplete: true,
    closeoutReviewed: true,
    finalNoGoArchived: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    nextAction: "retain_audit_record_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Archive Panel",
    status: "order_submission_operator_archive_complete_blocked_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    reviewOnly: true,
    auditOnly: true,
    closeoutOnly: true,
    archiveOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorArchiveOnly: true,
    moduleStatus: "operator_read_only_archive_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    closeoutSummary,
    archive,
    issueFlags: [
      "order_placement_not_ready",
      "operator_archive_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel;
