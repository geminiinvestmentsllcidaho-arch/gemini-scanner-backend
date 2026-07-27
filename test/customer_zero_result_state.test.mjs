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
  assert.equal(normalizeCustomerZeroResultState({ primaryCommand: "WAIT_FOR_CONFIRMATION" }).state, "WAIT");
  assert.equal(normalizeCustomerZeroResultState({ status: "WATCH_ONLY" }).state, "WATCH");
});

test("requires explicit approval before producing ENTER", () => {
  assert.equal(normalizeCustomerZeroResultState({ decision: "ENTER" }).state, "NO_SETUP");
  const result = normalizeCustomerZeroResultState({
    decision: "ENTER",
    permission: "approved",
  });
  assert.equal(result.state, "ENTER");
  assert.equal(result.tradePermission, "review_allowed");
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.paperOrderPlacementAllowed, false);
  assert.equal(result.liveOrderPlacementAllowed, false);
});

test("allows explicit read-only decision review permission to surface ENTER without execution", () => {
  const result = normalizeCustomerZeroResultState({
    decision: "ENTER",
    decisionReviewAllowed: true,
    orderPlacementAllowed: false,
  });
  assert.equal(result.state, "ENTER");
  assert.equal(result.tradePermission, "review_allowed");
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.paperOrderPlacementAllowed, false);
  assert.equal(result.liveOrderPlacementAllowed, false);
});

test("defaults unknown outcomes to NO_SETUP", () => {
  assert.equal(normalizeCustomerZeroResultState({ decision: "mystery_state" }).state, "NO_SETUP");
});
