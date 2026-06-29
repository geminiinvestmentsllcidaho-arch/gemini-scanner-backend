import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_decision_panel.mjs";

test("operator decision panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel();
  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_decision_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.decision.orderPlacementApproved, false);
  assert.equal(p.decision.brokerRequestSent, false);
  assert.equal(p.decision.brokerResponseReceived, false);
  assert.equal(p.diagnosticSummary.containsExecutableOrder, false);
  assert.equal(p.diagnosticSummary.containsSecrets, false);
});

test("operator decision panel summarizes checklist safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel({
    checklistPanel: {
      version: "paper_attempt_read_only_order_submission_operator_checklist_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      readyForOrderPlacement: false,
      checklistSummary: { blocked: 2, passed: 3, allSafetyChecksPass: true, allBlockingChecksPass: false },
      diagnosticSummary: { brokerRequestSent: false, brokerResponseReceived: false, containsExecutableOrder: false, containsSecrets: false }
    }
  });
  assert.equal(p.checklistSummary.version, "paper_attempt_read_only_order_submission_operator_checklist_panel_v1");
  assert.equal(p.checklistSummary.blocked, 2);
  assert.equal(p.checklistSummary.allSafetyChecksPass, true);
  assert.equal(p.checklistSummary.allBlockingChecksPass, false);
});
