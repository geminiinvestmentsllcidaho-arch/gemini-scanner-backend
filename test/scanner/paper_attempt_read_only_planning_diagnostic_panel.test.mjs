import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyPlanningDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_planning_diagnostic_panel.mjs";

test("paper attempt read-only planning diagnostic panel stays non-executable", () => {
  const panel = buildPaperAttemptReadOnlyPlanningDiagnosticPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_read_only_planning_diagnostic_panel_v1");
  assert.equal(panel.panelType, "operator_dashboard_card");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.reviewOnly, true);
  assert.equal(panel.auditOnly, true);
  assert.equal(panel.diagnosticsOnly, true);
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.planningOnly, true);
  assert.equal(panel.readOnly, true);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.liveTradingAllowed, false);
  assert.equal(panel.autoTradingAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);
  assert.ok(panel.planningChecklist.length >= 4);
  assert.ok(panel.blockers.includes("order_placement_not_ready"));
  assert.equal(panel.diagnosticSummary.allExecutionControlsDisabled, true);
});
