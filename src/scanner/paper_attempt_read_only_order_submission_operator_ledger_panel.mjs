import { buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel } from "./paper_attempt_read_only_order_submission_operator_manifest_panel.mjs";

const VERSION = "paper_attempt_read_only_order_submission_operator_ledger_panel_v1";
const FINAL_NO_GO = "NO_GO_FOR_ORDER_PLACEMENT";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function bool(value) {
  return value === true;
}

export function summarizeManifestForLedger(source = {}) {
  source = obj(source);
  const manifest = obj(source.manifest);

  return {
    sourceVersion: source.version ?? null,
    sourceFinalDecision: source.finalDecision ?? null,
    sourceReadyForOrderPlacement: source.readyForOrderPlacement === true,
    sourceReadOnly: bool(source.readOnly),
    sourceManifestOnly: bool(source.manifestOnly),
    sourceNoExecutionControls: bool(source.noExecutionControls),
    sourceBrokerContactAllowed: source.brokerContactAllowed === true,
    sourceBrokerOrderPlacementAllowed: source.brokerOrderPlacementAllowed === true,
    sourceLiveTradingAllowed: source.liveTradingAllowed === true,
    sourceAutoTradingAllowed: source.autoTradingAllowed === true,
    sourceAccountMutationAllowed: source.accountMutationAllowed === true,
    manifestedNoGo: manifest.manifestedNoGo === true,
    orderPlacementManifested: manifest.orderPlacementManifested === true,
    noExecutableOrder: bool(manifest.noExecutableOrder),
    noBrokerContact: bool(manifest.noBrokerContact),
    noBrokerOrderPlacement: bool(manifest.noBrokerOrderPlacement),
    noLiveTrading: bool(manifest.noLiveTrading),
    noAutoTrading: bool(manifest.noAutoTrading),
    noAccountMutation: bool(manifest.noAccountMutation),
    manifestScope: manifest.manifestScope ?? null,
    manifestLevel: manifest.manifestLevel ?? null,
    registryRegisteredNoGo: manifest.registryRegisteredNoGo === true,
    registryOrderPlacementRegistered: manifest.registryOrderPlacementRegistered === true
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel(input = {}) {
  const provided = obj(input.manifestSource);
  const source = Object.keys(provided).length > 0
    ? provided
    : buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel(obj(input.manifestInput));

  const ledgerSummary = summarizeManifestForLedger(source);

  const manifestNoGo = ledgerSummary.sourceFinalDecision === FINAL_NO_GO
    && ledgerSummary.sourceReadyForOrderPlacement === false
    && ledgerSummary.sourceReadOnly === true
    && ledgerSummary.sourceNoExecutionControls === true
    && ledgerSummary.sourceBrokerContactAllowed === false
    && ledgerSummary.sourceBrokerOrderPlacementAllowed === false
    && ledgerSummary.sourceLiveTradingAllowed === false
    && ledgerSummary.sourceAutoTradingAllowed === false
    && ledgerSummary.sourceAccountMutationAllowed === false
    && ledgerSummary.manifestedNoGo === true
    && ledgerSummary.orderPlacementManifested === false
    && ledgerSummary.noExecutableOrder === true
    && ledgerSummary.noBrokerContact === true
    && ledgerSummary.noBrokerOrderPlacement === true
    && ledgerSummary.noLiveTrading === true
    && ledgerSummary.noAutoTrading === true
    && ledgerSummary.noAccountMutation === true
    && ledgerSummary.registryRegisteredNoGo === true
    && ledgerSummary.registryOrderPlacementRegistered === false;

  const issueFlags = [
    "order_placement_not_ready",
    "ledger_read_only_no_go",
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
    title: "Paper Attempt Read-Only Order Submission Operator Ledger Panel",
    status: manifestNoGo ? "ledgered_read_only_no_go" : "ledger_blocked_source_incomplete_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: FINAL_NO_GO,
    readyForOrderPlacement: false,
    readOnly: true,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    ledgerOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    operatorChainStatus: manifestNoGo
      ? "ledgered_complete_read_only_review_no_go"
      : "ledger_blocked_source_incomplete_no_go",
    ledger: {
      ledgeredNoGo: manifestNoGo,
      orderPlacementLedgered: false,
      ledgerScope: "read_only_operator_record",
      ledgerLevel: "operator_no_go_ledger",
      noExecutableOrder: true,
      noBrokerContact: true,
      noBrokerOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noAccountMutation: true,
      manifestManifestedNoGo: ledgerSummary.manifestedNoGo === true,
      manifestOrderPlacementManifested: false
    },
    ledgerSummary,
    issueFlags,
    actionItems: [
      "Keep order placement disabled.",
      "Keep broker contact disabled.",
      "Use this ledger record for read-only operator review only."
    ],
    generatedAt: new Date(0).toISOString()
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel;
