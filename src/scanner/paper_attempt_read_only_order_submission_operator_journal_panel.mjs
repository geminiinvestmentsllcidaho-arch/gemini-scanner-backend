import { buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel } from "./paper_attempt_read_only_order_submission_operator_ledger_panel.mjs";

const VERSION = "paper_attempt_read_only_order_submission_operator_journal_panel_v1";
const FINAL_NO_GO = "NO_GO_FOR_ORDER_PLACEMENT";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function bool(value) {
  return value === true;
}

export function summarizeLedgerForJournal(source = {}) {
  source = obj(source);
  const ledger = obj(source.ledger);

  return {
    sourceVersion: source.version ?? null,
    sourceFinalDecision: source.finalDecision ?? null,
    sourceReadyForOrderPlacement: source.readyForOrderPlacement === true,
    sourceReadOnly: bool(source.readOnly),
    sourceLedgerOnly: bool(source.ledgerOnly),
    sourceNoExecutionControls: bool(source.noExecutionControls),
    sourceBrokerContactAllowed: source.brokerContactAllowed === true,
    sourceBrokerOrderPlacementAllowed: source.brokerOrderPlacementAllowed === true,
    sourceLiveTradingAllowed: source.liveTradingAllowed === true,
    sourceAutoTradingAllowed: source.autoTradingAllowed === true,
    sourceAccountMutationAllowed: source.accountMutationAllowed === true,
    ledgeredNoGo: ledger.ledgeredNoGo === true,
    orderPlacementLedgered: ledger.orderPlacementLedgered === true,
    noExecutableOrder: bool(ledger.noExecutableOrder),
    noBrokerContact: bool(ledger.noBrokerContact),
    noBrokerOrderPlacement: bool(ledger.noBrokerOrderPlacement),
    noLiveTrading: bool(ledger.noLiveTrading),
    noAutoTrading: bool(ledger.noAutoTrading),
    noAccountMutation: bool(ledger.noAccountMutation),
    ledgerScope: ledger.ledgerScope ?? null,
    ledgerLevel: ledger.ledgerLevel ?? null,
    manifestManifestedNoGo: ledger.manifestManifestedNoGo === true,
    manifestOrderPlacementManifested: ledger.manifestOrderPlacementManifested === true
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorJournalPanel(input = {}) {
  const provided = obj(input.ledgerSource);
  const source = Object.keys(provided).length > 0
    ? provided
    : buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel(obj(input.ledgerInput));

  const journalSummary = summarizeLedgerForJournal(source);

  const ledgerNoGo = journalSummary.sourceFinalDecision === FINAL_NO_GO
    && journalSummary.sourceReadyForOrderPlacement === false
    && journalSummary.sourceReadOnly === true
    && journalSummary.sourceNoExecutionControls === true
    && journalSummary.sourceBrokerContactAllowed === false
    && journalSummary.sourceBrokerOrderPlacementAllowed === false
    && journalSummary.sourceLiveTradingAllowed === false
    && journalSummary.sourceAutoTradingAllowed === false
    && journalSummary.sourceAccountMutationAllowed === false
    && journalSummary.ledgeredNoGo === true
    && journalSummary.orderPlacementLedgered === false
    && journalSummary.noExecutableOrder === true
    && journalSummary.noBrokerContact === true
    && journalSummary.noBrokerOrderPlacement === true
    && journalSummary.noLiveTrading === true
    && journalSummary.noAutoTrading === true
    && journalSummary.noAccountMutation === true
    && journalSummary.manifestManifestedNoGo === true
    && journalSummary.manifestOrderPlacementManifested === false;

  const issueFlags = [
    "order_placement_not_ready",
    "journal_read_only_no_go",
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
    title: "Paper Attempt Read-Only Order Submission Operator Journal Panel",
    status: ledgerNoGo ? "journaled_read_only_no_go" : "journal_blocked_source_incomplete_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: FINAL_NO_GO,
    readyForOrderPlacement: false,
    readOnly: true,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    journalOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    operatorChainStatus: ledgerNoGo
      ? "journaled_complete_read_only_review_no_go"
      : "journal_blocked_source_incomplete_no_go",
    journal: {
      journaledNoGo: ledgerNoGo,
      orderPlacementJournaled: false,
      journalScope: "read_only_operator_record",
      journalLevel: "operator_no_go_journal",
      noExecutableOrder: true,
      noBrokerContact: true,
      noBrokerOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noAccountMutation: true,
      ledgerLedgeredNoGo: journalSummary.ledgeredNoGo === true,
      ledgerOrderPlacementLedgered: false
    },
    journalSummary,
    issueFlags,
    actionItems: [
      "Keep order placement disabled.",
      "Keep broker contact disabled.",
      "Use this journal record for read-only operator review only."
    ],
    generatedAt: new Date(0).toISOString()
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorJournalPanel;
