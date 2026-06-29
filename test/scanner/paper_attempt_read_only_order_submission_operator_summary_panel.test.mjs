import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_summary_panel.mjs";

test("operator summary panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_summary_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.safetySummary.orderPlacementApproved, false);
  assert.equal(p.safetySummary.brokerContactApproved, false);
  assert.equal(p.safetySummary.brokerRequestSent, false);
  assert.equal(p.completionSummary.readOnlyChainComplete, true);
});

test("operator summary panel summarizes completion safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel({
    completionPanel: {
      version: "paper_attempt_read_only_order_submission_operator_completion_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      completionStatus: "review_chain_complete_order_submission_blocked",
      readyForOrderPlacement: false,
      readOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      completionSummary: {
        readOnlyChainComplete: true,
        orderPlacementApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true
      },
      diagnosticSummary: {
        brokerRequestSent: false,
        brokerResponseReceived: false
      }
    }
  });

  assert.equal(p.completionSummary.version, "paper_attempt_read_only_order_submission_operator_completion_panel_v1");
  assert.equal(p.completionSummary.orderPlacementApproved, false);
  assert.equal(p.completionSummary.noBrokerRequestSent, true);
  assert.equal(p.safetySummary.containsExecutableOrder, false);
});
