import test from "node:test";
import assert from "node:assert/strict";

import { health } from "../src/utils/health.js";
import {
  markStreamConnected,
  markStreamMarketSession,
} from "../src/utils/stream_telemetry.js";

function captureHealth() {
  let body;
  health(null, {
    json(value) {
      body = value;
    },
  });
  return body;
}

test("stale market clock degrades health explicitly", () => {
  markStreamConnected(false);
  markStreamMarketSession(false, { nowMs: Date.now() - 181_000 });
  const result = captureHealth();

  assert.equal(result.status, "ok");
  assert.equal(result.degraded, true);
  assert.deepEqual(result.issues, ["MARKET_CLOCK_STALE"]);
  assert.equal(result.stream.marketClockStale, true);
});

test("fresh market clock keeps closed-session disconnected stream healthy", () => {
  markStreamConnected(false);
  markStreamMarketSession(false, { nowMs: Date.now() });
  const result = captureHealth();

  assert.equal(result.status, "ok");
  assert.equal(result.degraded, false);
  assert.deepEqual(result.issues, []);
  assert.equal(result.stream.marketClockStale, false);
});
