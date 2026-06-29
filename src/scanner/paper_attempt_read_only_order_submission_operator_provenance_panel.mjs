const VERSION = "paper_attempt_read_only_order_submission_operator_provenance_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeIntegrity(input = {}) {
  const prior = obj(input.integrityPanel || input.operatorIntegrityPanel || input.priorIntegrityPanel);
  const integrity = obj(prior.integrity);
  const custody = obj(prior.custodySummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_integrity_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    closeoutOnly: bool(prior.closeoutOnly, true),
    archiveOnly: bool(prior.archiveOnly, true),
    retentionOnly: bool(prior.retentionOnly, true),
    sealOnly: bool(prior.sealOnly, true),
    custodyOnly: bool(prior.custodyOnly, true),
    integrityOnly: bool(prior.integrityOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    integrityStatus: str(integrity.integrityStatus, "integrity_verified_read_only_no_order_submission"),
    readOnlyIntegrityComplete: bool(integrity.readOnlyIntegrityComplete, true),
    custodyReviewed: bool(integrity.custodyReviewed, true),
    finalNoGoIntegrityVerified: bool(integrity.finalNoGoIntegrityVerified, true),
    orderPlacementApproved: bool(integrity.orderPlacementApproved, false),
    brokerContactApproved: bool(integrity.brokerContactApproved, false),
    noBrokerRequestSent: bool(integrity.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(integrity.noBrokerResponseReceived, true),
    noExecutableOrder: bool(integrity.noExecutableOrder, true),
    noSecrets: bool(integrity.noSecrets, true),
    accountMutationObserved: bool(integrity.accountMutationObserved, false),
    custodyOrderPlacementApproved: bool(custody.orderPlacementApproved, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel(input = {}) {
  const integritySummary = summarizeIntegrity(input);

  const provenance = {
    provenanceStatus: "provenance_recorded_read_only_no_order_submission",
    readOnlyProvenanceComplete: true,
    integrityReviewed: true,
    finalNoGoProvenanceRecorded: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    provenanceRecordType: "diagnostic_operator_no_go",
    nextAction: "maintain_provenance_record_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Provenance Panel",
    status: "order_submission_operator_provenance_complete_blocked_no_go",
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
    provenanceOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorProvenanceOnly: true,
    moduleStatus: "operator_read_only_provenance_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    integritySummary,
    provenance,
    issueFlags: [
      "order_placement_not_ready",
      "operator_provenance_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel;
