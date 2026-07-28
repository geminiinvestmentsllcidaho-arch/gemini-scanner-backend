import test from "node:test";
import assert from "node:assert/strict";

import { buildRuntimeHealthState } from "../src/utils/health.js";

test("shared runtime health authority returns identical issue semantics for health and readiness", () => {
  const state = buildRuntimeHealthState({
    marketClockStale: true,
    streamStale: true,
    marketOpen: true,
    streamConnected: false,
  });

  assert.equal(state.degraded, true);
  assert.deepEqual(state.issues, [
    "MARKET_CLOCK_STALE",
    "STREAM_STALE",
    "STREAM_DISCONNECTED",
  ]);
});

test("shared runtime health authority preserves fresh closed-session readiness", () => {
  const stream = {
    marketClockStale: false,
    streamStale: false,
    marketOpen: false,
    streamConnected: false,
  };
  const state = buildRuntimeHealthState(stream);

  assert.equal(state.degraded, false);
  assert.deepEqual(state.issues, []);
  assert.equal(state.stream, stream);
});

test("shared runtime health authority output is immutable at the state and issue-list boundaries", () => {
  const state = buildRuntimeHealthState({
    marketClockStale: false,
    streamStale: false,
    marketOpen: null,
    streamConnected: false,
  });

  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.issues), true);
  assert.throws(() => state.issues.push("MUTATION"), TypeError);
});
