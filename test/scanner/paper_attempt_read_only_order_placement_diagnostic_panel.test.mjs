import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyOrderPlacementDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_order_placement_diagnostic_panel.mjs";

test("paper attempt read-only order placement diagnostic panel stays non-executable", () => {
  const panel = buildPaperAttemptReadOnlyOrderPlacementDiagnosticPanel({ now: new Date("2026-01-01T00:00:00.000Z") });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_read_only_order_placement_diagnostic_panel_v1");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.readOnly, true);
  assert.equal(panel.orderPlacementOnly, true);
  assert.equal(panel.noExecutionControls, true);

  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.brokerExecutionAllowed, false);
  assert.equal(panel.liveTradingAllowed, false);
  assert.equal(panel.autoTradingAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);

  assert.equal(panel.orderPlacement.requiredBeforeExecution, true);
  assert.equal(panel.orderPlacement.current, "disabled");
  assert.equal(panel.orderPlacement.endpointAllowed, false);
  assert.equal(panel.orderPlacement.submitFunctionAllowed, false);
  assert.equal(panel.orderPlacement.brokerContactAllowed, false);
  assert.equal(panel.orderPlacement.brokerExecutionAllowed, false);
  assert.equal(panel.orderPlacement.accountMutationAllowed, false);
  assert.equal(panel.orderPlacement.orderPlacementAllowed, false);
  assert.equal(panel.orderPlacement.executionMode, "diagnostic_only");

  assert.ok(panel.blockers.includes("order_placement_endpoint_disabled"));
  assert.ok(panel.blockers.includes("order_submission_function_disabled"));
  assert.equal(panel.diagnosticSummary.allExecutionControlsDisabled, true);
  assert.equal(panel.generatedAt, "2026-01-01T00:00:00.000Z");
});
