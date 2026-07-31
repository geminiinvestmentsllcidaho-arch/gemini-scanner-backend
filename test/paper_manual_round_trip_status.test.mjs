import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperManualRoundTripStatus } from "../src/scanner/paper_manual_round_trip_status.mjs";

test("status exposes ordered operator states with later stages locked", () => {
  let status = buildPaperManualRoundTripStatus(
    { status: "awaiting_baseline", baselineObserved: false, issues: [] },
    { status: "connected_readonly", positions: [{ symbol: "SPY", qty: 1 }] },
  );
  assert.equal(status.operatorState, "EXISTING_POSITIONS_MUST_BE_CLOSED");
  assert.equal(status.safety.stage2Locked, true);

  status = buildPaperManualRoundTripStatus(
    { status: "awaiting_baseline", baselineObserved: false, issues: [] },
    { status: "connected_readonly", positions: [] },
  );
  assert.equal(status.operatorState, "READY_TO_CAPTURE_ZERO_POSITION_BASELINE");

  status = buildPaperManualRoundTripStatus(
    { status: "awaiting_manual_enter", baselineObserved: true, enterDetected: false, issues: [] },
    { status: "connected_readonly", positions: [] },
  );
  assert.equal(status.operatorState, "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY");
  assert.equal(status.safety.orderPlacementAllowed, false);
});
