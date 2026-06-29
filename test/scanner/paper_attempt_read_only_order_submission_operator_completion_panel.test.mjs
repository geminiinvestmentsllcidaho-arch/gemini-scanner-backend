import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorCompletionPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_completion_panel.mjs";

test("operator completion panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCompletionPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_completion_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.completionSummary.readOnlyChainComplete, true);
  assert.equal(p.completionSummary.orderPlacementApproved, false);
  assert.equal(p.completionSummary.noBrokerRequestSent, true);
  assert.equal(p.completionSummary.noBrokerResponseReceived, true);
  assert.equal(p.diagnosticSummary.containsExecutableOrder, false);
  assert.equal(p.diagnosticSummary.containsSecrets, false);
});

test("operator completion panel summarizes final review safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorCompletionPanel({
    finalReviewPanel: {
      version: "paper_attempt_read_only_order_submission_operator_final_review_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      readyForOrderPlacement: false,
      readOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      finalReview: {
        conclusion: "NO_GO_FOR_ORDER_PLACEMENT",
        operatorInstruction: "REVIEW_ONLY_DO_NOT_PLACE_ORDER",
        orderPlacementApproved: false,
        brokerContactApproved: false,
        executionControlsAvailable: false,
        accountMutationApproved: false
      },
      diagnosticSummary: {
        brokerRequestSent: false,
        brokerResponseReceived: false,
        containsExecutableOrder: false,
        containsSecrets: false
      }
    }
  });

  assert.equal(p.finalReviewSummary.version, "paper_attempt_read_only_order_submission_operator_final_review_panel_v1");
  assert.equal(p.finalReviewSummary.conclusion, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.finalReviewSummary.orderPlacementApproved, false);
  assert.equal(p.finalReviewSummary.brokerRequestSent, false);
  assert.equal(p.completionSummary.finalReviewConclusion, "NO_GO_FOR_ORDER_PLACEMENT");
});
