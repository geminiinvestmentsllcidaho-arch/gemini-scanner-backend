import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_closeout_panel.mjs";

test("operator closeout panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_closeout_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.closeoutOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.closeout.orderPlacementApproved, false);
  assert.equal(p.closeout.noBrokerRequestSent, true);
  assert.equal(p.closeout.noBrokerResponseReceived, true);
  assert.equal(p.closeout.noExecutableOrder, true);
  assert.equal(p.closeout.noSecrets, true);
  assert.equal(p.closeout.accountMutationObserved, false);
});

test("operator closeout panel summarizes evidence packet safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel({
    evidencePacketPanel: {
      version: "paper_attempt_read_only_order_submission_operator_evidence_packet_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      auditOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      evidencePacket: {
        evidenceComplete: true,
        orderPlacementApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true,
        accountMutationObserved: false
      },
      auditSummary: {
        orderPlacementApproved: false,
        brokerRequestSent: false,
        brokerResponseReceived: false,
        executableOrderPresent: false
      }
    }
  });

  assert.equal(p.evidenceSummary.version, "paper_attempt_read_only_order_submission_operator_evidence_packet_panel_v1");
  assert.equal(p.evidenceSummary.evidenceComplete, true);
  assert.equal(p.evidenceSummary.orderPlacementApproved, false);
  assert.equal(p.evidenceSummary.noBrokerRequestSent, true);
  assert.equal(p.evidenceSummary.auditBrokerRequestSent, false);
  assert.equal(p.closeout.finalNoGoRecorded, true);
  assert.equal(p.closeout.nextAction, "stand_down_no_order_placement");
});
