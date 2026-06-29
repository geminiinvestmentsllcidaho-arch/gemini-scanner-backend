import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_lifecycle_diagnostic_panel.mjs";

test("lifecycle diagnostic panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_lifecycle_diagnostic_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);

  assert.equal(p.lifecycle.current, "blocked_before_order_submission");
  assert.equal(p.lifecycle.orderSubmissionAttempted, false);
  assert.equal(p.lifecycle.orderSubmissionCompleted, false);
  assert.equal(p.lifecycle.brokerRequestSent, false);
  assert.equal(p.lifecycle.brokerResponseReceived, false);
  assert.equal(p.lifecycle.allStagesSafe, true);
  assert.equal(p.diagnosticSummary.containsExecutableOrder, false);
  assert.equal(p.diagnosticSummary.containsSecrets, false);
});

test("lifecycle diagnostic panel summarizes provided prior stages safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel({
    payloadDiagnostic: {
      version: "payload_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      payload: { current: "preview_only", containsExecutableOrder: false, containsSecrets: false }
    },
    transportDiagnostic: {
      version: "transport_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      transport: { current: "disabled", brokerRequestSent: false, containsExecutableOrder: false, containsSecrets: false }
    },
    responseDiagnostic: {
      version: "response_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      response: { current: "not_received", brokerResponseReceived: false, responseContainsExecutableOrder: false, responseContainsSecrets: false }
    }
  });

  assert.equal(p.payloadSummary.version, "payload_v1");
  assert.equal(p.transportSummary.version, "transport_v1");
  assert.equal(p.responseSummary.version, "response_v1");
  assert.equal(p.lifecycle.payloadStage, "preview_only");
  assert.equal(p.lifecycle.transportStage, "disabled");
  assert.equal(p.lifecycle.responseStage, "not_received");
  assert.equal(p.lifecycle.allStagesSafe, true);
});
