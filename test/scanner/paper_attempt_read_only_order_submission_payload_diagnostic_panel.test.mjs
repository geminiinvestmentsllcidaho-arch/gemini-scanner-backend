import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyOrderSubmissionPayloadDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_payload_diagnostic_panel.mjs";

test("paper attempt read-only order submission payload diagnostic panel stays non-executable", () => {
  const panel = buildPaperAttemptReadOnlyOrderSubmissionPayloadDiagnosticPanel({ now: new Date("2026-01-01T00:00:00.000Z") });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_read_only_order_submission_payload_diagnostic_panel_v1");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.readOnly, true);
  assert.equal(panel.orderSubmissionPayloadOnly, true);
  assert.equal(panel.noExecutionControls, true);

  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.brokerExecutionAllowed, false);
  assert.equal(panel.liveTradingAllowed, false);
  assert.equal(panel.autoTradingAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);

  assert.equal(panel.orderSubmissionPayload.requiredBeforeExecution, true);
  assert.equal(panel.orderSubmissionPayload.current, "disabled");
  assert.equal(panel.orderSubmissionPayload.payloadGenerationAllowed, false);
  assert.equal(panel.orderSubmissionPayload.brokerRequestBodyAllowed, false);
  assert.equal(panel.orderSubmissionPayload.brokerTransportAllowed, false);
  assert.equal(panel.orderSubmissionPayload.brokerContactAllowed, false);
  assert.equal(panel.orderSubmissionPayload.brokerExecutionAllowed, false);
  assert.equal(panel.orderSubmissionPayload.accountMutationAllowed, false);
  assert.equal(panel.orderSubmissionPayload.orderPlacementAllowed, false);
  assert.equal(panel.orderSubmissionPayload.executionMode, "diagnostic_only");

  assert.equal(panel.payloadPreview.generated, false);
  assert.equal(panel.payloadPreview.redacted, true);
  assert.equal(panel.payloadPreview.brokerDestination, "none");
  assert.equal(panel.payloadPreview.requestMethod, "none");
  assert.equal(panel.payloadPreview.containsAccountIdentifiers, false);
  assert.equal(panel.payloadPreview.containsSecrets, false);
  assert.equal(panel.payloadPreview.containsExecutableOrder, false);

  assert.ok(panel.blockers.includes("submission_payload_generation_disabled"));
  assert.ok(panel.blockers.includes("broker_request_body_disabled"));
  assert.equal(panel.diagnosticSummary.allExecutionControlsDisabled, true);
  assert.equal(panel.generatedAt, "2026-01-01T00:00:00.000Z");
});
