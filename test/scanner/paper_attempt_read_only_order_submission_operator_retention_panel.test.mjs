import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_retention_panel.mjs";

test("operator retention panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_retention_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.retentionOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.retention.orderPlacementApproved, false);
  assert.equal(p.retention.noBrokerRequestSent, true);
  assert.equal(p.retention.noBrokerResponseReceived, true);
  assert.equal(p.retention.noExecutableOrder, true);
  assert.equal(p.retention.noSecrets, true);
  assert.equal(p.retention.accountMutationObserved, false);
});

test("operator retention panel summarizes archive safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel({
    archivePanel: {
      version: "paper_attempt_read_only_order_submission_operator_archive_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      auditOnly: true,
      closeoutOnly: true,
      archiveOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      archive: {
        archiveStatus: "archived_read_only_no_order_submission",
        readOnlyArchiveComplete: true,
        closeoutReviewed: true,
        finalNoGoArchived: true,
        orderPlacementApproved: false,
        brokerContactApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      closeoutSummary: {
        orderPlacementApproved: false
      }
    }
  });

  assert.equal(p.archiveSummary.version, "paper_attempt_read_only_order_submission_operator_archive_panel_v1");
  assert.equal(p.archiveSummary.finalNoGoArchived, true);
  assert.equal(p.archiveSummary.orderPlacementApproved, false);
  assert.equal(p.archiveSummary.noBrokerRequestSent, true);
  assert.equal(p.archiveSummary.closeoutOrderPlacementApproved, false);
  assert.equal(p.retention.finalNoGoRetained, true);
  assert.equal(p.retention.nextAction, "retain_read_only_record_no_order_placement");
});
