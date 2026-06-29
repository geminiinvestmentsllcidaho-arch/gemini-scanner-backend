import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_integrity_panel.mjs";

test("operator integrity panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_integrity_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.integrityOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.integrity.orderPlacementApproved, false);
  assert.equal(p.integrity.noBrokerRequestSent, true);
  assert.equal(p.integrity.noBrokerResponseReceived, true);
  assert.equal(p.integrity.noExecutableOrder, true);
  assert.equal(p.integrity.noSecrets, true);
  assert.equal(p.integrity.accountMutationObserved, false);
});

test("operator integrity panel summarizes custody safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel({
    custodyPanel: {
      version: "paper_attempt_read_only_order_submission_operator_custody_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      auditOnly: true,
      closeoutOnly: true,
      archiveOnly: true,
      retentionOnly: true,
      sealOnly: true,
      custodyOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      custody: {
        custodyStatus: "custody_recorded_read_only_no_order_submission",
        readOnlyCustodyComplete: true,
        sealReviewed: true,
        finalNoGoInCustody: true,
        orderPlacementApproved: false,
        brokerContactApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      sealSummary: {
        orderPlacementApproved: false
      }
    }
  });

  assert.equal(p.custodySummary.version, "paper_attempt_read_only_order_submission_operator_custody_panel_v1");
  assert.equal(p.custodySummary.finalNoGoInCustody, true);
  assert.equal(p.custodySummary.orderPlacementApproved, false);
  assert.equal(p.custodySummary.noBrokerRequestSent, true);
  assert.equal(p.custodySummary.sealOrderPlacementApproved, false);
  assert.equal(p.integrity.finalNoGoIntegrityVerified, true);
  assert.equal(p.integrity.nextAction, "preserve_integrity_record_no_order_placement");
});
