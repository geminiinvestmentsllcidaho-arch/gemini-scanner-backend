import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_response_diagnostic_panel.mjs";

test("response diagnostic panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_response_diagnostic_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);

  assert.equal(p.response.current, "not_received");
  assert.equal(p.response.brokerResponseExpected, false);
  assert.equal(p.response.brokerResponseReceived, false);
  assert.equal(p.response.responseContainsExecutableOrder, false);
  assert.equal(p.response.responseContainsSecrets, false);
  assert.equal(p.response.httpStatus, null);
  assert.equal(p.response.brokerOrderId, null);
});

test("response diagnostic panel summarizes prior transport safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel({
    priorDiagnostic: {
      version: "paper_attempt_read_only_order_submission_transport_diagnostic_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      readyForOrderPlacement: false,
      transport: {
        current: "disabled",
        requestWouldBeSent: false,
        brokerRequestSent: false,
        containsExecutableOrder: false,
        containsSecrets: false
      },
      diagnosticSummary: { allExecutionControlsDisabled: true }
    }
  });

  assert.equal(p.priorTransportSummary.version, "paper_attempt_read_only_order_submission_transport_diagnostic_panel_v1");
  assert.equal(p.priorTransportSummary.transportCurrent, "disabled");
  assert.equal(p.priorTransportSummary.brokerRequestSent, false);
  assert.equal(p.response.priorTransportSafe, true);
  assert.ok(p.issueFlags.length >= 3);
});
