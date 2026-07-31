import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperManualRoundTripStatus } from "../src/scanner/paper_manual_round_trip_status.mjs";

test("status exposes ordered operator states with later stages locked", () => {
  let status = buildPaperManualRoundTripStatus(
    { status: "awaiting_baseline", baselineObserved: false, issues: [] },
    { status: "connected_readonly", positions: [{ symbol: "SPY", qty: 1 }], openOrders: [] },
  );
  assert.equal(status.operatorState, "EXISTING_POSITIONS_MUST_BE_CLOSED");
  assert.equal(status.safety.stage2Locked, true);

  status = buildPaperManualRoundTripStatus(
    { status: "awaiting_baseline", baselineObserved: false, issues: [] },
    { status: "connected_readonly", positions: [], openOrders: [] },
  );
  assert.equal(status.operatorState, "READY_TO_CAPTURE_ZERO_POSITION_BASELINE");

  status = buildPaperManualRoundTripStatus(
    { status: "awaiting_manual_enter", baselineObserved: true, enterDetected: false, issues: [] },
    { status: "connected_readonly", positions: [], openOrders: [] },
  );
  assert.equal(status.operatorState, "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY");
  assert.equal(status.safety.orderPlacementAllowed, false);
});


test("status blocks baseline for incomplete snapshots and open orders", () => {
  let status = buildPaperManualRoundTripStatus(
    { status: "awaiting_baseline", baselineObserved: false, issues: ["paper_positions_unavailable"] },
    { status: "connected_readonly", positions: null, openOrders: [] },
  );
  assert.equal(status.operatorState, "BASELINE_SNAPSHOT_INCOMPLETE");

  status = buildPaperManualRoundTripStatus(
    { status: "awaiting_baseline", baselineObserved: false, issues: ["manual_baseline_requires_zero_open_orders"] },
    { status: "connected_readonly", positions: [], openOrders: [{ symbol: "SPY" }] },
  );
  assert.equal(status.operatorState, "OPEN_ORDERS_MUST_CLEAR");
  assert.equal(status.openOrdersCount, 1);
});
