const VERSION = "paper_attempt_read_only_order_submission_operator_seal_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeRetention(input = {}) {
  const prior = obj(input.retentionPanel || input.operatorRetentionPanel || input.priorRetentionPanel);
  const retention = obj(prior.retention);
  const archive = obj(prior.archiveSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_retention_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    closeoutOnly: bool(prior.closeoutOnly, true),
    archiveOnly: bool(prior.archiveOnly, true),
    retentionOnly: bool(prior.retentionOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    retentionStatus: str(retention.retentionStatus, "retained_read_only_no_order_submission"),
    readOnlyRetentionComplete: bool(retention.readOnlyRetentionComplete, true),
    archiveReviewed: bool(retention.archiveReviewed, true),
    finalNoGoRetained: bool(retention.finalNoGoRetained, true),
    orderPlacementApproved: bool(retention.orderPlacementApproved, false),
    brokerContactApproved: bool(retention.brokerContactApproved, false),
    noBrokerRequestSent: bool(retention.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(retention.noBrokerResponseReceived, true),
    noExecutableOrder: bool(retention.noExecutableOrder, true),
    noSecrets: bool(retention.noSecrets, true),
    accountMutationObserved: bool(retention.accountMutationObserved, false),
    archiveOrderPlacementApproved: bool(archive.orderPlacementApproved, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel(input = {}) {
  const retentionSummary = summarizeRetention(input);

  const seal = {
    sealStatus: "sealed_read_only_no_order_submission",
    readOnlySealComplete: true,
    retentionReviewed: true,
    finalNoGoSealed: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    sealedRecordType: "diagnostic_operator_no_go",
    nextAction: "preserve_sealed_record_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Seal Panel",
    status: "order_submission_operator_seal_complete_blocked_no_go",
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
    retentionOnly: true,
    sealOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorSealOnly: true,
    moduleStatus: "operator_read_only_seal_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    retentionSummary,
    seal,
    issueFlags: [
      "order_placement_not_ready",
      "operator_seal_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel;
