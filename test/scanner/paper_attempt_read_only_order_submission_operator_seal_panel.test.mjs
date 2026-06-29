import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_seal_panel.mjs";

test("operator seal panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_seal_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.sealOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.seal.orderPlacementApproved, false);
  assert.equal(p.seal.noBrokerRequestSent, true);
  assert.equal(p.seal.noBrokerResponseReceived, true);
  assert.equal(p.seal.noExecutableOrder, true);
  assert.equal(p.seal.noSecrets, true);
  assert.equal(p.seal.accountMutationObserved, false);
});

test("operator seal panel summarizes retention safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel({
    retentionPanel: {
      version: "paper_attempt_read_only_order_submission_operator_retention_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      auditOnly: true,
      closeoutOnly: true,
      archiveOnly: true,
      retentionOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      retention: {
        retentionStatus: "retained_read_only_no_order_submission",
        readOnlyRetentionComplete: true,
        archiveReviewed: true,
        finalNoGoRetained: true,
        orderPlacementApproved: false,
        brokerContactApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      archiveSummary: {
        orderPlacementApproved: false
      }
    }
  });

  assert.equal(p.retentionSummary.version, "paper_attempt_read_only_order_submission_operator_retention_panel_v1");
  assert.equal(p.retentionSummary.finalNoGoRetained, true);
  assert.equal(p.retentionSummary.orderPlacementApproved, false);
  assert.equal(p.retentionSummary.noBrokerRequestSent, true);
  assert.equal(p.retentionSummary.archiveOrderPlacementApproved, false);
  assert.equal(p.seal.finalNoGoSealed, true);
  assert.equal(p.seal.nextAction, "preserve_sealed_record_no_order_placement");
});
