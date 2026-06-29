import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_transport_diagnostic_panel.mjs";

test("transport panel safety locks", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_transport_diagnostic_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);

  assert.equal(p.transport.current, "disabled");
  assert.equal(p.transport.requestWouldBeSent, false);
  assert.equal(p.transport.brokerRequestSent, false);
  assert.equal(p.transport.networkDispatchAllowed, false);
  assert.equal(p.transport.adapterDispatchAllowed, false);
  assert.equal(p.transport.containsExecutableOrder, false);
  assert.equal(p.transport.containsSecrets, false);

  assert.equal(Array.isArray(p.issueFlags), true);
  assert.ok(p.issueFlags.length >= 3);
});
