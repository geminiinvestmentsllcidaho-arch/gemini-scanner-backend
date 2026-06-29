import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorFinalReviewPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_final_review_panel.mjs";

test("operator final review panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorFinalReviewPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_final_review_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.finalReview.orderPlacementApproved, false);
  assert.equal(p.finalReview.brokerContactApproved, false);
  assert.equal(p.finalReview.executionControlsAvailable, false);
  assert.equal(p.diagnosticSummary.brokerRequestSent, false);
  assert.equal(p.diagnosticSummary.brokerResponseReceived, false);
  assert.equal(p.diagnosticSummary.containsExecutableOrder, false);
  assert.equal(p.diagnosticSummary.containsSecrets, false);
});

test("operator final review panel summarizes decision safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorFinalReviewPanel({
    decisionPanel: {
      version: "paper_attempt_read_only_order_submission_operator_decision_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      readyForOrderPlacement: false,
      readOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      decision: {
        current: "no_go_for_order_placement",
        operatorAction: "review_only",
        orderPlacementApproved: false,
        brokerRequestSent: false,
        brokerResponseReceived: false,
        executableOrderPresent: false,
        secretsPresent: false
      }
    }
  });

  assert.equal(p.decisionSummary.version, "paper_attempt_read_only_order_submission_operator_decision_panel_v1");
  assert.equal(p.decisionSummary.current, "no_go_for_order_placement");
  assert.equal(p.decisionSummary.orderPlacementApproved, false);
  assert.equal(p.decisionSummary.brokerRequestSent, false);
  assert.equal(p.finalReview.conclusion, "NO_GO_FOR_ORDER_PLACEMENT");
});
