import { buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel } from "./paper_attempt_read_only_order_submission_operator_certification_panel.mjs";

const VERSION = "paper_attempt_read_only_order_submission_operator_registry_panel_v1";
const FINAL_NO_GO = "NO_GO_FOR_ORDER_PLACEMENT";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function bool(value) {
  return value === true;
}

export function summarizeCertificationForRegistry(source = {}) {
  source = obj(source);
  const certification = obj(source.certification);

  return {
    sourceVersion: source.version ?? null,
    sourceFinalDecision: source.finalDecision ?? null,
    sourceReadyForOrderPlacement: source.readyForOrderPlacement === true,
    sourceReadOnly: bool(source.readOnly),
    sourceCertificationOnly: bool(source.certificationOnly),
    sourceNoExecutionControls: bool(source.noExecutionControls),
    sourceBrokerContactAllowed: source.brokerContactAllowed === true,
    sourceBrokerOrderPlacementAllowed: source.brokerOrderPlacementAllowed === true,
    sourceLiveTradingAllowed: source.liveTradingAllowed === true,
    sourceAutoTradingAllowed: source.autoTradingAllowed === true,
    sourceAccountMutationAllowed: source.accountMutationAllowed === true,
    certifiedNoGo: certification.certifiedNoGo === true,
    orderPlacementCertified: certification.orderPlacementCertified === true,
    noExecutableOrder: bool(certification.noExecutableOrder),
    noBrokerContact: bool(certification.noBrokerContact),
    noBrokerOrderPlacement: bool(certification.noBrokerOrderPlacement),
    noLiveTrading: bool(certification.noLiveTrading),
    noAutoTrading: bool(certification.noAutoTrading),
    noAccountMutation: bool(certification.noAccountMutation),
    certificationScope: certification.certificationScope ?? null,
    certificationLevel: certification.certificationLevel ?? null
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel(input = {}) {
  const provided = obj(input.certificationSource);
  const source = Object.keys(provided).length > 0
    ? provided
    : buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel(obj(input.certificationInput));

  const registrySummary = summarizeCertificationForRegistry(source);

  const certificationNoGo = registrySummary.sourceFinalDecision === FINAL_NO_GO
    && registrySummary.sourceReadyForOrderPlacement === false
    && registrySummary.sourceReadOnly === true
    && registrySummary.sourceNoExecutionControls === true
    && registrySummary.sourceBrokerContactAllowed === false
    && registrySummary.sourceBrokerOrderPlacementAllowed === false
    && registrySummary.sourceLiveTradingAllowed === false
    && registrySummary.sourceAutoTradingAllowed === false
    && registrySummary.sourceAccountMutationAllowed === false
    && registrySummary.certifiedNoGo === true
    && registrySummary.orderPlacementCertified === false
    && registrySummary.noExecutableOrder === true
    && registrySummary.noBrokerContact === true
    && registrySummary.noBrokerOrderPlacement === true
    && registrySummary.noLiveTrading === true
    && registrySummary.noAutoTrading === true
    && registrySummary.noAccountMutation === true;

  const issueFlags = [
    "order_placement_not_ready",
    "registry_read_only_no_go",
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
    title: "Paper Attempt Read-Only Order Submission Operator Registry Panel",
    status: certificationNoGo ? "registered_read_only_no_go" : "registry_blocked_source_incomplete_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: FINAL_NO_GO,
    readyForOrderPlacement: false,
    readOnly: true,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    registryOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    operatorChainStatus: certificationNoGo
      ? "registered_complete_read_only_review_no_go"
      : "registry_blocked_source_incomplete_no_go",
    registry: {
      registeredNoGo: certificationNoGo,
      orderPlacementRegistered: false,
      registryScope: "read_only_operator_record",
      registryLevel: "operator_no_go_registry",
      noExecutableOrder: true,
      noBrokerContact: true,
      noBrokerOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noAccountMutation: true,
      certificationCertifiedNoGo: registrySummary.certifiedNoGo === true,
      certificationOrderPlacementCertified: false
    },
    registrySummary,
    issueFlags,
    actionItems: [
      "Keep order placement disabled.",
      "Keep broker contact disabled.",
      "Use this registry record for read-only operator review only."
    ],
    generatedAt: new Date(0).toISOString()
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel;
