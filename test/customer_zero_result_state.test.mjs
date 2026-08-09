import test from "node:test";
import assert from "node:assert/strict";

import {
  CUSTOMER_ZERO_RESULT_STATES,
  normalizeCustomerZeroResultState,
} from "../src/scanner/customer_zero_result_state.mjs";

test("exports the stable Customer Zero result-state universe", () => {
  assert.deepEqual(CUSTOMER_ZERO_RESULT_STATES, [
    "ENTER",
    "DO_NOT_ENTER",
    "WAIT",
    "EXIT",
    "BLOCKED",
    "WATCH",
    "NO_SETUP",
    "STALE_DATA",
  ]);
});

test("stale data overrides every other state", () => {
  const result = normalizeCustomerZeroResultState({
    stale: true,
    decision: "ENTER",
    tradeAllowed: true,
  });
  assert.equal(result.state, "STALE_DATA");
  assert.equal(result.orderPlacementAllowed, false);
});

test("exit receives priority over blocked and entry states", () => {
  const result = normalizeCustomerZeroResultState({
    exitRequired: true,
    blocked: true,
    decision: "ENTER",
    tradeAllowed: true,
  });
  assert.equal(result.state, "EXIT");
});

test("maps blocked, do-not-enter, wait, and watch states conservatively", () => {
  assert.equal(normalizeCustomerZeroResultState({ scannerReadiness: "blocked" }).state, "BLOCKED");
  assert.equal(normalizeCustomerZeroResultState({ appDecision: "DO_NOT_ENTER" }).state, "DO_NOT_ENTER");
  assert.equal(normalizeCustomerZeroResultState({ primaryCommand: "WAIT" }).state, "WAIT");
  assert.equal(normalizeCustomerZeroResultState({ status: "WATCH_ONLY" }).state, "WATCH");
});

test("surfaces explicit ENTER without a separate approval gate", () => {
  const result = normalizeCustomerZeroResultState({ decision: "ENTER" });
  assert.equal(result.state, "ENTER");
  assert.equal(result.tradePermission, "allowed");
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.paperOrderPlacementAllowed, false);
  assert.equal(result.liveOrderPlacementAllowed, false);
});

test("legacy approval fields do not control an explicit ENTER result", () => {
  for (const source of [
    { decision: "ENTER", permission: "denied" },
    { decision: "ENTER", stage2FinalPermission: "denied" },
    { decision: "ENTER", decisionReviewAllowed: false, tradeAllowed: false, orderPlacementAllowed: false },
  ]) {
    const result = normalizeCustomerZeroResultState(source);
    assert.equal(result.state, "ENTER");
    assert.equal(result.orderPlacementAllowed, false);
    assert.equal(result.paperOrderPlacementAllowed, false);
    assert.equal(result.liveOrderPlacementAllowed, false);
  }
});

test("defaults unknown outcomes to NO_SETUP", () => {
  assert.equal(normalizeCustomerZeroResultState({ decision: "mystery_state" }).state, "NO_SETUP");
});
