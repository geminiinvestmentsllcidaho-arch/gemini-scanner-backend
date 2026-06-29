const VERSION = "paper_attempt_read_only_order_submission_operator_custody_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeSeal(input = {}) {
  const prior = obj(input.sealPanel || input.operatorSealPanel || input.priorSealPanel);
  const seal = obj(prior.seal);
  const retention = obj(prior.retentionSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_seal_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    closeoutOnly: bool(prior.closeoutOnly, true),
    archiveOnly: bool(prior.archiveOnly, true),
    retentionOnly: bool(prior.retentionOnly, true),
    sealOnly: bool(prior.sealOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    sealStatus: str(seal.sealStatus, "sealed_read_only_no_order_submission"),
    readOnlySealComplete: bool(seal.readOnlySealComplete, true),
    retentionReviewed: bool(seal.retentionReviewed, true),
    finalNoGoSealed: bool(seal.finalNoGoSealed, true),
    orderPlacementApproved: bool(seal.orderPlacementApproved, false),
    brokerContactApproved: bool(seal.brokerContactApproved, false),
    noBrokerRequestSent: bool(seal.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(seal.noBrokerResponseReceived, true),
    noExecutableOrder: bool(seal.noExecutableOrder, true),
    noSecrets: bool(seal.noSecrets, true),
    accountMutationObserved: bool(seal.accountMutationObserved, false),
    retentionOrderPlacementApproved: bool(retention.orderPlacementApproved, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel(input = {}) {
  const sealSummary = summarizeSeal(input);

  const custody = {
    custodyStatus: "custody_recorded_read_only_no_order_submission",
    readOnlyCustodyComplete: true,
    sealReviewed: true,
    finalNoGoInCustody: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    custodyRecordType: "diagnostic_operator_no_go",
    nextAction: "maintain_custody_record_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Custody Panel",
    status: "order_submission_operator_custody_complete_blocked_no_go",
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
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorCustodyOnly: true,
    moduleStatus: "operator_read_only_custody_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    sealSummary,
    custody,
    issueFlags: [
      "order_placement_not_ready",
      "operator_custody_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel;
