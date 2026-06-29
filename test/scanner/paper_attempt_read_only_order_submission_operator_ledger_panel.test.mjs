import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel, summarizeManifestForLedger } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_ledger_panel.mjs";

test("operator ledger panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_ledger_panel_v1");
  assert.equal(p.panelType, "operator_dashboard_card");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.ledgerOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.ledger.ledgeredNoGo, true);
  assert.equal(p.ledger.orderPlacementLedgered, false);
  assert.equal(p.ledger.noExecutableOrder, true);
  assert.equal(p.ledger.noBrokerContact, true);
  assert.equal(p.ledger.manifestManifestedNoGo, true);
});

test("operator ledger panel blocks incomplete manifest source safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel({
    manifestSource: {
      version: "unsafe_source",
      finalDecision: "GO",
      readyForOrderPlacement: true,
      readOnly: false,
      manifest: {
        manifestedNoGo: false,
        orderPlacementManifested: true,
        noExecutableOrder: false,
        noBrokerContact: false,
        noBrokerOrderPlacement: false
      }
    }
  });

  assert.equal(p.ok, true);
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.ledger.ledgeredNoGo, false);
  assert.equal(p.ledger.orderPlacementLedgered, false);
  assert.equal(p.operatorChainStatus, "ledger_blocked_source_incomplete_no_go");
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
});

test("summarizeManifestForLedger supplies safe defaults", () => {
  const s = summarizeManifestForLedger(null);

  assert.equal(s.sourceVersion, null);
  assert.equal(s.sourceReadyForOrderPlacement, false);
  assert.equal(s.sourceReadOnly, false);
  assert.equal(s.manifestedNoGo, false);
  assert.equal(s.orderPlacementManifested, false);
  assert.equal(s.noExecutableOrder, false);
  assert.equal(s.noBrokerContact, false);
});
