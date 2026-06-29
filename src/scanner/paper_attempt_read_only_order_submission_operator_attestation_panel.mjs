const VERSION = "paper_attempt_read_only_order_submission_operator_attestation_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeProvenance(input = {}) {
  const prior = obj(input.provenancePanel || input.operatorProvenancePanel || input.priorProvenancePanel);
  const provenance = obj(prior.provenance);
  const integrity = obj(prior.integritySummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_provenance_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    closeoutOnly: bool(prior.closeoutOnly, true),
    archiveOnly: bool(prior.archiveOnly, true),
    retentionOnly: bool(prior.retentionOnly, true),
    sealOnly: bool(prior.sealOnly, true),
    custodyOnly: bool(prior.custodyOnly, true),
    integrityOnly: bool(prior.integrityOnly, true),
    provenanceOnly: bool(prior.provenanceOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    provenanceStatus: str(provenance.provenanceStatus, "provenance_recorded_read_only_no_order_submission"),
    readOnlyProvenanceComplete: bool(provenance.readOnlyProvenanceComplete, true),
    integrityReviewed: bool(provenance.integrityReviewed, true),
    finalNoGoProvenanceRecorded: bool(provenance.finalNoGoProvenanceRecorded, true),
    orderPlacementApproved: bool(provenance.orderPlacementApproved, false),
    brokerContactApproved: bool(provenance.brokerContactApproved, false),
    noBrokerRequestSent: bool(provenance.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(provenance.noBrokerResponseReceived, true),
    noExecutableOrder: bool(provenance.noExecutableOrder, true),
    noSecrets: bool(provenance.noSecrets, true),
    accountMutationObserved: bool(provenance.accountMutationObserved, false),
    integrityOrderPlacementApproved: bool(integrity.orderPlacementApproved, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel(input = {}) {
  const provenanceSummary = summarizeProvenance(input);

  const attestation = {
    attestationStatus: "attested_read_only_no_order_submission",
    readOnlyAttestationComplete: true,
    provenanceReviewed: true,
    finalNoGoAttested: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    attestationRecordType: "diagnostic_operator_no_go",
    nextAction: "hold_attestation_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Attestation Panel",
    status: "order_submission_operator_attestation_complete_blocked_no_go",
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
    attestationOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorAttestationOnly: true,
    moduleStatus: "operator_read_only_attestation_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    provenanceSummary,
    attestation,
    issueFlags: [
      "order_placement_not_ready",
      "operator_attestation_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel;
