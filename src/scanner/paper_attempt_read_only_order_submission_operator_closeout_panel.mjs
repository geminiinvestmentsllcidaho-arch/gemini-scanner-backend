const VERSION = "paper_attempt_read_only_order_submission_operator_closeout_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeEvidence(input = {}) {
  const prior = obj(input.evidencePacketPanel || input.operatorEvidencePacketPanel || input.priorEvidencePacketPanel);
  const evidence = obj(prior.evidencePacket);
  const audit = obj(prior.auditSummary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_evidence_packet_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    evidenceComplete: bool(evidence.evidenceComplete, true),
    orderPlacementApproved: bool(evidence.orderPlacementApproved, false),
    noBrokerRequestSent: bool(evidence.noBrokerRequestSent, true),
    noBrokerResponseReceived: bool(evidence.noBrokerResponseReceived, true),
    noExecutableOrder: bool(evidence.noExecutableOrder, true),
    noSecrets: bool(evidence.noSecrets, true),
    accountMutationObserved: bool(evidence.accountMutationObserved, false),
    auditOrderPlacementApproved: bool(audit.orderPlacementApproved, false),
    auditBrokerRequestSent: bool(audit.brokerRequestSent, false),
    auditBrokerResponseReceived: bool(audit.brokerResponseReceived, false),
    auditExecutableOrderPresent: bool(audit.executableOrderPresent, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel(input = {}) {
  const evidenceSummary = summarizeEvidence(input);

  const closeout = {
    closeoutStatus: "closed_read_only_no_order_submission",
    readOnlyChainClosed: true,
    evidencePacketReviewed: true,
    finalNoGoRecorded: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    nextAction: "stand_down_no_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Closeout Panel",
    status: "order_submission_operator_closeout_complete_blocked_no_go",
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
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorCloseoutOnly: true,
    moduleStatus: "operator_read_only_closeout_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    evidenceSummary,
    closeout,
    issueFlags: [
      "order_placement_not_ready",
      "operator_closeout_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel;
