import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_provenance_panel.mjs";

test("operator provenance panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_provenance_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.provenanceOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.provenance.orderPlacementApproved, false);
  assert.equal(p.provenance.noBrokerRequestSent, true);
  assert.equal(p.provenance.noBrokerResponseReceived, true);
  assert.equal(p.provenance.noExecutableOrder, true);
  assert.equal(p.provenance.noSecrets, true);
  assert.equal(p.provenance.accountMutationObserved, false);
});

test("operator provenance panel summarizes integrity safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel({
    integrityPanel: {
      version: "paper_attempt_read_only_order_submission_operator_integrity_panel_v1",
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
      integrityOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      integrity: {
        integrityStatus: "integrity_verified_read_only_no_order_submission",
        readOnlyIntegrityComplete: true,
        custodyReviewed: true,
        finalNoGoIntegrityVerified: true,
        orderPlacementApproved: false,
        brokerContactApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      custodySummary: {
        orderPlacementApproved: false
      }
    }
  });

  assert.equal(p.integritySummary.version, "paper_attempt_read_only_order_submission_operator_integrity_panel_v1");
  assert.equal(p.integritySummary.finalNoGoIntegrityVerified, true);
  assert.equal(p.integritySummary.orderPlacementApproved, false);
  assert.equal(p.integritySummary.noBrokerRequestSent, true);
  assert.equal(p.integritySummary.custodyOrderPlacementApproved, false);
  assert.equal(p.provenance.finalNoGoProvenanceRecorded, true);
  assert.equal(p.provenance.nextAction, "maintain_provenance_record_no_order_placement");
});
