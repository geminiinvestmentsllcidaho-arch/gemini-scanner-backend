import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorChecklistPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_checklist_panel.mjs";

test("operator checklist panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorChecklistPanel();
  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_checklist_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.checklistSummary.allSafetyChecksPass, true);
  assert.equal(p.checklistSummary.allBlockingChecksPass, false);
  assert.ok(p.checklistSummary.blocked >= 2);
  assert.equal(p.diagnosticSummary.brokerRequestSent, false);
  assert.equal(p.diagnosticSummary.brokerResponseReceived, false);
});
