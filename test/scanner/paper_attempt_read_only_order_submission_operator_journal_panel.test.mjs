import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorJournalPanel, summarizeLedgerForJournal } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_journal_panel.mjs";

test("operator journal panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorJournalPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_journal_panel_v1");
  assert.equal(p.panelType, "operator_dashboard_card");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.journalOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.journal.journaledNoGo, true);
  assert.equal(p.journal.orderPlacementJournaled, false);
  assert.equal(p.journal.noExecutableOrder, true);
  assert.equal(p.journal.noBrokerContact, true);
  assert.equal(p.journal.ledgerLedgeredNoGo, true);
});

test("operator journal panel blocks incomplete ledger source safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorJournalPanel({
    ledgerSource: {
      version: "unsafe_source",
      finalDecision: "GO",
      readyForOrderPlacement: true,
      readOnly: false,
      ledger: {
        ledgeredNoGo: false,
        orderPlacementLedgered: true,
        noExecutableOrder: false,
        noBrokerContact: false,
        noBrokerOrderPlacement: false
      }
    }
  });

  assert.equal(p.ok, true);
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.journal.journaledNoGo, false);
  assert.equal(p.journal.orderPlacementJournaled, false);
  assert.equal(p.operatorChainStatus, "journal_blocked_source_incomplete_no_go");
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
});

test("summarizeLedgerForJournal supplies safe defaults", () => {
  const s = summarizeLedgerForJournal(null);

  assert.equal(s.sourceVersion, null);
  assert.equal(s.sourceReadyForOrderPlacement, false);
  assert.equal(s.sourceReadOnly, false);
  assert.equal(s.ledgeredNoGo, false);
  assert.equal(s.orderPlacementLedgered, false);
  assert.equal(s.noExecutableOrder, false);
  assert.equal(s.noBrokerContact, false);
});
