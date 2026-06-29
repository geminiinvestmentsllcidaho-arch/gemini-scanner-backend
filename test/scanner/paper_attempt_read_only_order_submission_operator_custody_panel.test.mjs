import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_custody_panel.mjs";

test("operator custody panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_custody_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.custodyOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.custody.orderPlacementApproved, false);
  assert.equal(p.custody.noBrokerRequestSent, true);
  assert.equal(p.custody.noBrokerResponseReceived, true);
  assert.equal(p.custody.noExecutableOrder, true);
  assert.equal(p.custody.noSecrets, true);
  assert.equal(p.custody.accountMutationObserved, false);
});

test("operator custody panel summarizes seal safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel({
    sealPanel: {
      version: "paper_attempt_read_only_order_submission_operator_seal_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      auditOnly: true,
      closeoutOnly: true,
      archiveOnly: true,
      retentionOnly: true,
      sealOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      seal: {
        sealStatus: "sealed_read_only_no_order_submission",
        readOnlySealComplete: true,
        retentionReviewed: true,
        finalNoGoSealed: true,
        orderPlacementApproved: false,
        brokerContactApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      retentionSummary: {
        orderPlacementApproved: false
      }
    }
  });

  assert.equal(p.sealSummary.version, "paper_attempt_read_only_order_submission_operator_seal_panel_v1");
  assert.equal(p.sealSummary.finalNoGoSealed, true);
  assert.equal(p.sealSummary.orderPlacementApproved, false);
  assert.equal(p.sealSummary.noBrokerRequestSent, true);
  assert.equal(p.sealSummary.retentionOrderPlacementApproved, false);
  assert.equal(p.custody.finalNoGoInCustody, true);
  assert.equal(p.custody.nextAction, "maintain_custody_record_no_order_placement");
});
