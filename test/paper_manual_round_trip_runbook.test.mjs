import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperManualRoundTripRunbook } from "../scripts/paper_manual_round_trip_runbook.mjs";

test("runbook covers the complete manual round trip and locks later stages", () => {
  const runbook = buildPaperManualRoundTripRunbook();
  assert.equal(runbook.steps.length, 11);
  assert.equal(runbook.safety.orderPlacementAllowed, false);
  assert.equal(runbook.safety.stage2Locked, true);
  assert.equal(runbook.safety.stage3Locked, true);
});
