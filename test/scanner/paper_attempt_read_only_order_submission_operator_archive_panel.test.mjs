import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_archive_panel.mjs";

test("operator archive panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_archive_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.archiveOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.archive.orderPlacementApproved, false);
  assert.equal(p.archive.noBrokerRequestSent, true);
  assert.equal(p.archive.noBrokerResponseReceived, true);
  assert.equal(p.archive.noExecutableOrder, true);
  assert.equal(p.archive.noSecrets, true);
  assert.equal(p.archive.accountMutationObserved, false);
});

test("operator archive panel summarizes closeout safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel({
    closeoutPanel: {
      version: "paper_attempt_read_only_order_submission_operator_closeout_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      auditOnly: true,
      closeoutOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      closeout: {
        closeoutStatus: "closed_read_only_no_order_submission",
        readOnlyChainClosed: true,
        evidencePacketReviewed: true,
        finalNoGoRecorded: true,
        orderPlacementApproved: false,
        brokerContactApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      evidenceSummary: {
        orderPlacementApproved: false,
        noBrokerRequestSent: true
      }
    }
  });

  assert.equal(p.closeoutSummary.version, "paper_attempt_read_only_order_submission_operator_closeout_panel_v1");
  assert.equal(p.closeoutSummary.finalNoGoRecorded, true);
  assert.equal(p.closeoutSummary.orderPlacementApproved, false);
  assert.equal(p.closeoutSummary.noBrokerRequestSent, true);
  assert.equal(p.closeoutSummary.evidenceOrderPlacementApproved, false);
  assert.equal(p.archive.finalNoGoArchived, true);
  assert.equal(p.archive.nextAction, "retain_audit_record_no_order_placement");
});
