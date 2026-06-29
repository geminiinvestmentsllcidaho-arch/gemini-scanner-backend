const VERSION = "paper_attempt_read_only_order_submission_operator_retention_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeArchive(input = {}) {
  const prior = obj(input.archivePanel || input.operatorArchivePanel || input.priorArchivePanel);
  const archive = obj(prior.archive);
  const closeout = obj(prior.closeoutSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_archive_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    closeoutOnly: bool(prior.closeoutOnly, true),
    archiveOnly: bool(prior.archiveOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    archiveStatus: str(archive.archiveStatus, "archived_read_only_no_order_submission"),
    readOnlyArchiveComplete: bool(archive.readOnlyArchiveComplete, true),
    closeoutReviewed: bool(archive.closeoutReviewed, true),
    finalNoGoArchived: bool(archive.finalNoGoArchived, true),
    orderPlacementApproved: bool(archive.orderPlacementApproved, false),
    brokerContactApproved: bool(archive.brokerContactApproved, false),
    noBrokerRequestSent: bool(archive.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(archive.noBrokerResponseReceived, true),
    noExecutableOrder: bool(archive.noExecutableOrder, true),
    noSecrets: bool(archive.noSecrets, true),
    accountMutationObserved: bool(archive.accountMutationObserved, false),
    closeoutOrderPlacementApproved: bool(closeout.orderPlacementApproved, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel(input = {}) {
  const archiveSummary = summarizeArchive(input);

  const retention = {
    retentionStatus: "retained_read_only_no_order_submission",
    readOnlyRetentionComplete: true,
    archiveReviewed: true,
    finalNoGoRetained: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    retentionRecordType: "diagnostic_operator_no_go",
    nextAction: "retain_read_only_record_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Retention Panel",
    status: "order_submission_operator_retention_complete_blocked_no_go",
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
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorRetentionOnly: true,
    moduleStatus: "operator_read_only_retention_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    archiveSummary,
    retention,
    issueFlags: [
      "order_placement_not_ready",
      "operator_retention_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel;
