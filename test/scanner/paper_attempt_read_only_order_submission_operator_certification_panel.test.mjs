import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel, summarizeAttestationForCertification } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_certification_panel.mjs";

test("operator certification panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_certification_panel_v1");
  assert.equal(p.panelType, "operator_dashboard_card");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.certificationOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.certification.certifiedNoGo, true);
  assert.equal(p.certification.orderPlacementCertified, false);
  assert.equal(p.certification.noExecutableOrder, true);
  assert.equal(p.certification.noBrokerContact, true);
  assert.equal(p.attestationSummary.finalNoGoAttested, true);
});

test("operator certification panel blocks incomplete attestation source safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel({
    attestationSource: {
      version: "unsafe_source",
      finalDecision: "GO",
      readyForOrderPlacement: true,
      readOnly: false,
      attestation: {
        orderPlacementApproved: true,
        noBrokerRequestSent: false,
        noBrokerResponseReceived: false,
        noExecutableOrder: false,
        noSecrets: false,
        finalNoGoAttested: false
      },
      provenanceSummary: {
        orderPlacementApproved: true
      }
    }
  });

  assert.equal(p.ok, true);
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.certification.certifiedNoGo, false);
  assert.equal(p.certification.orderPlacementCertified, false);
  assert.equal(p.operatorChainStatus, "certification_blocked_source_incomplete_no_go");
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
});

test("summarizeAttestationForCertification supplies safe defaults", () => {
  const s = summarizeAttestationForCertification(null);

  assert.equal(s.sourceVersion, null);
  assert.equal(s.sourceReadyForOrderPlacement, false);
  assert.equal(s.sourceReadOnly, false);
  assert.equal(s.orderPlacementApproved, false);
  assert.equal(s.noBrokerRequestSent, false);
  assert.equal(s.noBrokerResponseReceived, false);
  assert.equal(s.finalNoGoAttested, false);
  assert.equal(s.provenanceOrderPlacementApproved, false);
});
