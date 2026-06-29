import { buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel } from "./paper_attempt_read_only_order_submission_operator_registry_panel.mjs";

const VERSION = "paper_attempt_read_only_order_submission_operator_manifest_panel_v1";
const FINAL_NO_GO = "NO_GO_FOR_ORDER_PLACEMENT";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function bool(value) {
  return value === true;
}

export function summarizeRegistryForManifest(source = {}) {
  source = obj(source);
  const registry = obj(source.registry);

  return {
    sourceVersion: source.version ?? null,
    sourceFinalDecision: source.finalDecision ?? null,
    sourceReadyForOrderPlacement: source.readyForOrderPlacement === true,
    sourceReadOnly: bool(source.readOnly),
    sourceRegistryOnly: bool(source.registryOnly),
    sourceNoExecutionControls: bool(source.noExecutionControls),
    sourceBrokerContactAllowed: source.brokerContactAllowed === true,
    sourceBrokerOrderPlacementAllowed: source.brokerOrderPlacementAllowed === true,
    sourceLiveTradingAllowed: source.liveTradingAllowed === true,
    sourceAutoTradingAllowed: source.autoTradingAllowed === true,
    sourceAccountMutationAllowed: source.accountMutationAllowed === true,
    registeredNoGo: registry.registeredNoGo === true,
    orderPlacementRegistered: registry.orderPlacementRegistered === true,
    noExecutableOrder: bool(registry.noExecutableOrder),
    noBrokerContact: bool(registry.noBrokerContact),
    noBrokerOrderPlacement: bool(registry.noBrokerOrderPlacement),
    noLiveTrading: bool(registry.noLiveTrading),
    noAutoTrading: bool(registry.noAutoTrading),
    noAccountMutation: bool(registry.noAccountMutation),
    registryScope: registry.registryScope ?? null,
    registryLevel: registry.registryLevel ?? null,
    certificationCertifiedNoGo: registry.certificationCertifiedNoGo === true,
    certificationOrderPlacementCertified: registry.certificationOrderPlacementCertified === true
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel(input = {}) {
  const provided = obj(input.registrySource);
  const source = Object.keys(provided).length > 0
    ? provided
    : buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel(obj(input.registryInput));

  const manifestSummary = summarizeRegistryForManifest(source);

  const registryNoGo = manifestSummary.sourceFinalDecision === FINAL_NO_GO
    && manifestSummary.sourceReadyForOrderPlacement === false
    && manifestSummary.sourceReadOnly === true
    && manifestSummary.sourceNoExecutionControls === true
    && manifestSummary.sourceBrokerContactAllowed === false
    && manifestSummary.sourceBrokerOrderPlacementAllowed === false
    && manifestSummary.sourceLiveTradingAllowed === false
    && manifestSummary.sourceAutoTradingAllowed === false
    && manifestSummary.sourceAccountMutationAllowed === false
    && manifestSummary.registeredNoGo === true
    && manifestSummary.orderPlacementRegistered === false
    && manifestSummary.noExecutableOrder === true
    && manifestSummary.noBrokerContact === true
    && manifestSummary.noBrokerOrderPlacement === true
    && manifestSummary.noLiveTrading === true
    && manifestSummary.noAutoTrading === true
    && manifestSummary.noAccountMutation === true
    && manifestSummary.certificationCertifiedNoGo === true
    && manifestSummary.certificationOrderPlacementCertified === false;

  const issueFlags = [
    "order_placement_not_ready",
    "manifest_read_only_no_go",
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
    title: "Paper Attempt Read-Only Order Submission Operator Manifest Panel",
    status: registryNoGo ? "manifested_read_only_no_go" : "manifest_blocked_source_incomplete_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: FINAL_NO_GO,
    readyForOrderPlacement: false,
    readOnly: true,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    manifestOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    operatorChainStatus: registryNoGo
      ? "manifested_complete_read_only_review_no_go"
      : "manifest_blocked_source_incomplete_no_go",
    manifest: {
      manifestedNoGo: registryNoGo,
      orderPlacementManifested: false,
      manifestScope: "read_only_operator_record",
      manifestLevel: "operator_no_go_manifest",
      noExecutableOrder: true,
      noBrokerContact: true,
      noBrokerOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noAccountMutation: true,
      registryRegisteredNoGo: manifestSummary.registeredNoGo === true,
      registryOrderPlacementRegistered: false
    },
    manifestSummary,
    issueFlags,
    actionItems: [
      "Keep order placement disabled.",
      "Keep broker contact disabled.",
      "Use this manifest record for read-only operator review only."
    ],
    generatedAt: new Date(0).toISOString()
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel;
