const VERSION = "paper_attempt_read_only_order_submission_operator_evidence_packet_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizeAuditTrail(input = {}) {
  const prior = obj(input.auditTrailPanel || input.operatorAuditTrailPanel || input.priorAuditTrailPanel);
  const auditTrail = obj(prior.auditTrail);
  const summary = obj(prior.summary);

  return {
    version: str(prior.version, null),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    operatorChainStatus: str(prior.operatorChainStatus, "complete_for_read_only_review_no_go"),
    moduleStatus: str(prior.moduleStatus, "operator_read_only_audit_trail_complete"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    readOnly: bool(prior.readOnly, true),
    auditOnly: bool(prior.auditOnly, true),
    noExecutionControls: bool(prior.noExecutionControls, true),
    brokerContactAllowed: bool(prior.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false),
    liveTradingAllowed: bool(prior.liveTradingAllowed, false),
    autoTradingAllowed: bool(prior.autoTradingAllowed, false),
    accountMutationAllowed: bool(prior.accountMutationAllowed, false),
    readOnlyChainAudited: bool(auditTrail.readOnlyChainAudited, true),
    operatorReviewAudited: bool(auditTrail.operatorReviewAudited, true),
    orderPlacementApproved: bool(auditTrail.orderPlacementApproved, false),
    brokerRequestSent: bool(auditTrail.brokerRequestSent, false),
    brokerResponseReceived: bool(auditTrail.brokerResponseReceived, false),
    executableOrderPresent: bool(auditTrail.executableOrderPresent, false),
    secretsPresent: bool(auditTrail.secretsPresent, false),
    accountMutationObserved: bool(auditTrail.accountMutationObserved, false),
    summaryOrderPlacementApproved: bool(summary.orderPlacementApproved, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel(input = {}) {
  const auditSummary = summarizeAuditTrail(input);

  const evidencePacket = {
    packetStatus: "evidence_packet_complete_read_only_no_go",
    evidenceComplete: true,
    orderPlacementApproved: false,
    brokerContactApproved: false,
    executionControlsAvailable: false,
    noBrokerRequestSent: true,
    noBrokerResponseReceived: true,
    noExecutableOrder: true,
    noSecrets: true,
    accountMutationObserved: false,
    conclusion: "NO_GO_FOR_ORDER_PLACEMENT"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Evidence Packet Panel",
    status: "order_submission_operator_evidence_packet_complete_blocked_no_go",
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
    orderSubmissionOperatorEvidencePacketOnly: true,
    moduleStatus: "operator_read_only_evidence_packet_complete",
    operatorChainStatus: "complete_for_read_only_review_no_go",
    auditSummary,
    evidencePacket,
    issueFlags: [
      "order_placement_not_ready",
      "operator_evidence_packet_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled",
      "read_only_operator_review_only"
    ]
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel;
