import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_attestation_panel.mjs";

test("operator attestation panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_attestation_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.attestationOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.attestation.orderPlacementApproved, false);
  assert.equal(p.attestation.noBrokerRequestSent, true);
  assert.equal(p.attestation.noBrokerResponseReceived, true);
  assert.equal(p.attestation.noExecutableOrder, true);
  assert.equal(p.attestation.noSecrets, true);
  assert.equal(p.attestation.accountMutationObserved, false);
});

test("operator attestation panel summarizes provenance safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel({
    provenancePanel: {
      version: "paper_attempt_read_only_order_submission_operator_provenance_panel_v1",
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
      provenanceOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      provenance: {
        provenanceStatus: "provenance_recorded_read_only_no_order_submission",
        readOnlyProvenanceComplete: true,
        integrityReviewed: true,
        finalNoGoProvenanceRecorded: true,
        orderPlacementApproved: false,
        brokerContactApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      integritySummary: {
        orderPlacementApproved: false
      }
    }
  });

  assert.equal(p.provenanceSummary.version, "paper_attempt_read_only_order_submission_operator_provenance_panel_v1");
  assert.equal(p.provenanceSummary.finalNoGoProvenanceRecorded, true);
  assert.equal(p.provenanceSummary.orderPlacementApproved, false);
  assert.equal(p.provenanceSummary.noBrokerRequestSent, true);
  assert.equal(p.provenanceSummary.integrityOrderPlacementApproved, false);
  assert.equal(p.attestation.finalNoGoAttested, true);
  assert.equal(p.attestation.nextAction, "hold_attestation_no_order_placement");
});
