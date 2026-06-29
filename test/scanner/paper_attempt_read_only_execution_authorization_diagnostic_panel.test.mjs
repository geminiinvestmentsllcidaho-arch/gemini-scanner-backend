import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyExecutionAuthorizationDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_execution_authorization_diagnostic_panel.mjs";

test("paper attempt read-only execution authorization diagnostic panel stays non-executable", () => {
  const panel = buildPaperAttemptReadOnlyExecutionAuthorizationDiagnosticPanel({ now: new Date("2026-01-01T00:00:00.000Z") });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_read_only_execution_authorization_diagnostic_panel_v1");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.readOnly, true);
  assert.equal(panel.executionAuthorizationOnly, true);
  assert.equal(panel.noExecutionControls, true);

  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.liveTradingAllowed, false);
  assert.equal(panel.autoTradingAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);

  assert.equal(panel.executionAuthorization.requiredBeforeExecution, true);
  assert.equal(panel.executionAuthorization.current, "not_authorized");
  assert.equal(panel.executionAuthorization.creationAllowed, false);
  assert.equal(panel.executionAuthorization.mutationAllowed, false);
  assert.equal(panel.executionAuthorization.brokerExecutionAllowed, false);
  assert.equal(panel.executionAuthorization.orderPlacementAllowed, false);
  assert.equal(panel.executionAuthorization.authorizationMode, "diagnostic_only");

  assert.ok(panel.blockers.includes("execution_authorization_creation_disabled"));
  assert.ok(panel.blockers.includes("broker_execution_disabled"));
  assert.equal(panel.diagnosticSummary.allExecutionControlsDisabled, true);
  assert.equal(panel.generatedAt, "2026-01-01T00:00:00.000Z");
});
