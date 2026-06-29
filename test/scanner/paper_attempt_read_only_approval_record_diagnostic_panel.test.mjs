import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyApprovalRecordDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_approval_record_diagnostic_panel.mjs";

test("paper attempt read-only approval record diagnostic panel stays non-executable", () => {
  const panel = buildPaperAttemptReadOnlyApprovalRecordDiagnosticPanel({ now: new Date("2026-01-01T00:00:00.000Z") });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_read_only_approval_record_diagnostic_panel_v1");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.readOnly, true);
  assert.equal(panel.approvalRecordOnly, true);
  assert.equal(panel.noExecutionControls, true);

  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.liveTradingAllowed, false);
  assert.equal(panel.autoTradingAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);

  assert.equal(panel.approvalRecord.requiredBeforeExecution, true);
  assert.equal(panel.approvalRecord.current, "not_created");
  assert.equal(panel.approvalRecord.creationAllowed, false);
  assert.equal(panel.approvalRecord.mutationAllowed, false);
  assert.equal(panel.approvalRecord.executionAuthorizationAllowed, false);
  assert.equal(panel.approvalRecord.recordMode, "diagnostic_only");

  assert.ok(panel.blockers.includes("approval_record_creation_disabled"));
  assert.ok(panel.blockers.includes("execution_authorization_disabled"));
  assert.equal(panel.diagnosticSummary.allExecutionControlsDisabled, true);
  assert.equal(panel.generatedAt, "2026-01-01T00:00:00.000Z");
});
