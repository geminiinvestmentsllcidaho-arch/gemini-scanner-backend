import { buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel } from "./paper_attempt_read_only_order_submission_operator_attestation_panel.mjs";

const VERSION = "paper_attempt_read_only_order_submission_operator_certification_panel_v1";
const FINAL_NO_GO = "NO_GO_FOR_ORDER_PLACEMENT";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function bool(value) {
  return value === true;
}

export function summarizeAttestationForCertification(source = {}) {
  source = obj(source);
  const attestation = obj(source.attestation);
  const provenanceSummary = obj(source.provenanceSummary);

  return {
    sourceVersion: source.version ?? null,
    sourceFinalDecision: source.finalDecision ?? null,
    sourceReadyForOrderPlacement: source.readyForOrderPlacement === true,
    sourceReadOnly: bool(source.readOnly),
    sourceAttestationOnly: bool(source.attestationOnly),
    sourceNoExecutionControls: bool(source.noExecutionControls),
    orderPlacementApproved: attestation.orderPlacementApproved === true,
    noBrokerRequestSent: bool(attestation.noBrokerRequestSent),
    noBrokerResponseReceived: bool(attestation.noBrokerResponseReceived),
    noExecutableOrder: bool(attestation.noExecutableOrder),
    noSecrets: bool(attestation.noSecrets),
    finalNoGoAttested: bool(attestation.finalNoGoAttested),
    provenanceOrderPlacementApproved: provenanceSummary.orderPlacementApproved === true,
    provenanceFinalDecision: provenanceSummary.finalDecision ?? null
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel(input = {}) {
  const base = obj(input.attestationSource);
  const source = Object.keys(base).length > 0
    ? base
    : buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel(obj(input.attestationInput));

  const attestationSummary = summarizeAttestationForCertification(source);

  const attestationNoGo = attestationSummary.sourceFinalDecision === FINAL_NO_GO
    && attestationSummary.sourceReadyForOrderPlacement === false
    && attestationSummary.sourceReadOnly === true
    && attestationSummary.sourceNoExecutionControls === true
    && attestationSummary.orderPlacementApproved === false
    && attestationSummary.noBrokerRequestSent === true
    && attestationSummary.noBrokerResponseReceived === true
    && attestationSummary.noExecutableOrder === true
    && attestationSummary.noSecrets === true
    && attestationSummary.finalNoGoAttested === true
    && attestationSummary.provenanceOrderPlacementApproved === false;

  const issueFlags = [
    "order_placement_not_ready",
    "certification_read_only_no_go",
    "broker_contact_not_allowed",
    "broker_order_placement_not_allowed",
    "live_trading_not_allowed",
    "auto_trading_not_allowed",
    "account_mutation_not_allowed"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Certification Panel",
    status: attestationNoGo ? "certified_read_only_no_go" : "certification_source_incomplete_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: FINAL_NO_GO,
    readyForOrderPlacement: false,
    readOnly: true,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    certificationOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    operatorChainStatus: attestationNoGo
      ? "certified_complete_read_only_review_no_go"
      : "certification_blocked_source_incomplete_no_go",
    certification: {
      certifiedNoGo: attestationNoGo,
      orderPlacementCertified: false,
      certificationScope: "read_only_operator_record",
      certificationLevel: "operator_no_go_certification",
      noExecutableOrder: true,
      noBrokerContact: true,
      noBrokerOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noAccountMutation: true,
      attestationFinalNoGo: attestationSummary.finalNoGoAttested === true,
      sourceFinalNoGo: attestationSummary.sourceFinalDecision === FINAL_NO_GO,
      sourceReadyForOrderPlacement: false
    },
    attestationSummary,
    issueFlags,
    actionItems: [
      "Keep order placement disabled.",
      "Keep broker contact disabled.",
      "Use this certification record for read-only operator review only."
    ],
    generatedAt: new Date(0).toISOString()
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel;
