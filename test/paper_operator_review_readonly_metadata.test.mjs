import assert from "node:assert/strict";
import test from "node:test";

import { buildPaperReadinessGateAppScreen } from "../src/scanner/paper_readiness_gate_app_screen.mjs";

function assertReadonlyMetadata(value) {
  assert.equal(value.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(value.readyForOrderPlacement, false);
  assert.equal(value.credentialSource, "not_applicable_readonly_diagnostics");
  assert.equal(value.paperOnly, true);
  assert.equal(value.readOnly, true);
  assert.deepEqual(value.allowedMethods, ["GET"]);
  assert.equal(value.secretsRedacted, true);
  assert.equal(value.orderSubmitAllowed, false);
  assert.equal(value.orderPlacementAllowed, false);
  assert.equal(value.accountMutationAllowed, false);
}

test("paper readiness gate exposes explicit safe readonly metadata", () => {
  const screen = buildPaperReadinessGateAppScreen({
    gate: {
      ok: false,
      readyForPaperTrading: false,
      failed: ["blocked"],
      checks: [{ key: "blocked", ok: false }],
    },
    now: new Date("2026-07-10T16:00:00.000Z"),
  });
  assertReadonlyMetadata(screen);
});
