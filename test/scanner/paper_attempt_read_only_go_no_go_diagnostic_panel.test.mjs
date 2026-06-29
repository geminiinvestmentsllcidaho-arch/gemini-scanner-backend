import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyGoNoGoDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_go_no_go_diagnostic_panel.mjs";

test("paper attempt read-only go/no-go diagnostic panel stays non-executable", () => {
  const panel = buildPaperAttemptReadOnlyGoNoGoDiagnosticPanel({ now: new Date("2026-01-01T00:00:00.000Z") });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_read_only_go_no_go_diagnostic_panel_v1");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.readOnly, true);
  assert.equal(panel.goNoGoOnly, true);
  assert.equal(panel.noExecutionControls, true);

  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.liveTradingAllowed, false);
  assert.equal(panel.autoTradingAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);

  assert.equal(panel.manualDecision.required, true);
  assert.equal(panel.manualDecision.current, "not_approved");
  assert.equal(panel.manualDecision.approvalRecordAllowed, false);
  assert.equal(panel.manualDecision.executionAuthorizationAllowed, false);
  assert.equal(panel.manualDecision.recordMode, "diagnostic_only");

  assert.ok(panel.blockers.includes("manual_go_no_go_not_approved"));
  assert.ok(panel.blockers.includes("broker_execution_disabled"));
  assert.equal(panel.diagnosticSummary.allExecutionControlsDisabled, true);
});
