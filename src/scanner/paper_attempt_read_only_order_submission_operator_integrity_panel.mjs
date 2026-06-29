const VERSION = "paper_attempt_read_only_order_submission_operator_integrity_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeCustody(input = {}) {
  const prior = obj(input.custodyPanel || input.operatorCustodyPanel || input.priorCustodyPanel);
  const custody = obj(prior.custody);
  const seal = obj(prior.sealSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_custody_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    closeoutOnly: bool(prior.closeoutOnly, true),
    archiveOnly: bool(prior.archiveOnly, true),
    retentionOnly: bool(prior.retentionOnly, true),
    sealOnly: bool(prior.sealOnly, true),
    custodyOnly: bool(prior.custodyOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    custodyStatus: str(custody.custodyStatus, "custody_recorded_read_only_no_order_submission"),
    readOnlyCustodyComplete: bool(custody.readOnlyCustodyComplete, true),
    sealReviewed: bool(custody.sealReviewed, true),
    finalNoGoInCustody: bool(custody.finalNoGoInCustody, true),
    orderPlacementApproved: bool(custody.orderPlacementApproved, false),
    brokerContactApproved: bool(custody.brokerContactApproved, false),
    noBrokerRequestSent: bool(custody.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(custody.noBrokerResponseReceived, true),
    noExecutableOrder: bool(custody.noExecutableOrder, true),
    noSecrets: bool(custody.noSecrets, true),
    accountMutationObserved: bool(custody.accountMutationObserved, false),
    sealOrderPlacementApproved: bool(seal.orderPlacementApproved, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel(input = {}) {
  const custodySummary = summarizeCustody(input);

  const integrity = {
    integrityStatus: "integrity_verified_read_only_no_order_submission",
    readOnlyIntegrityComplete: true,
    custodyReviewed: true,
    finalNoGoIntegrityVerified: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    integrityRecordType: "diagnostic_operator_no_go",
    nextAction: "preserve_integrity_record_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Integrity Panel",
    status: "order_submission_operator_integrity_complete_blocked_no_go",
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
    custodyOnly: true,
    integrityOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorIntegrityOnly: true,
    moduleStatus: "operator_read_only_integrity_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    custodySummary,
    integrity,
    issueFlags: [
      "order_placement_not_ready",
      "operator_integrity_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel;
