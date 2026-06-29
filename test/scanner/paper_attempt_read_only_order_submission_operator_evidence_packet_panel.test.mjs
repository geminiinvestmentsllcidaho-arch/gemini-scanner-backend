import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_evidence_packet_panel.mjs";

test("operator evidence packet panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_evidence_packet_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.auditOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.evidencePacket.orderPlacementApproved, false);
  assert.equal(p.evidencePacket.noBrokerRequestSent, true);
  assert.equal(p.evidencePacket.noBrokerResponseReceived, true);
  assert.equal(p.evidencePacket.noExecutableOrder, true);
  assert.equal(p.evidencePacket.noSecrets, true);
});

test("operator evidence packet panel summarizes audit trail safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel({
    auditTrailPanel: {
      version: "paper_attempt_read_only_order_submission_operator_audit_trail_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      auditOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      auditTrail: {
        readOnlyChainAudited: true,
        operatorReviewAudited: true,
        orderPlacementApproved: false,
        brokerRequestSent: false,
        brokerResponseReceived: false,
        executableOrderPresent: false,
        secretsPresent: false,
        accountMutationObserved: false
      },
      summary: {
        orderPlacementApproved: false
      }
    }
  });

  assert.equal(p.auditSummary.version, "paper_attempt_read_only_order_submission_operator_audit_trail_panel_v1");
  assert.equal(p.auditSummary.orderPlacementApproved, false);
  assert.equal(p.auditSummary.brokerRequestSent, false);
  assert.equal(p.auditSummary.executableOrderPresent, false);
  assert.equal(p.auditSummary.summaryOrderPlacementApproved, false);
  assert.equal(p.evidencePacket.conclusion, "NO_GO_FOR_ORDER_PLACEMENT");
});
