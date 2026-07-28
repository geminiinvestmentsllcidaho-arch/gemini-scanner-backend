import test from "node:test";
import assert from "node:assert/strict";

import { markStreamConnected, markStreamMarketSession } from "../src/utils/stream_telemetry.js";
import { readiness } from "../src/utils/health.js";

function invokeReadiness() {
  let statusCode = 200;
  let payload;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return value;
    },
  };

  readiness(null, res);
  return { statusCode, payload };
}

test("readiness fails closed when market clock telemetry is stale", () => {
  markStreamConnected(false);
  markStreamMarketSession(false, { nowMs: Date.now() - 181_000 });

  const result = invokeReadiness();

  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.ready, false);
  assert.equal(result.payload.degraded, true);
  assert.deepEqual(result.payload.issues, ["MARKET_CLOCK_STALE"]);
});

test("readiness remains ready for a fresh closed session with an intentionally disconnected stream", () => {
  markStreamConnected(false);
  markStreamMarketSession(false, { nowMs: Date.now() });

  const result = invokeReadiness();

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.ready, true);
  assert.equal(result.payload.degraded, false);
  assert.deepEqual(result.payload.issues, []);
});

test("readiness fails closed for an authoritative open session with a disconnected stream", () => {
  markStreamConnected(false);
  markStreamMarketSession(true, { nowMs: Date.now() });

  const result = invokeReadiness();

  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.ready, false);
  assert.equal(result.payload.degraded, true);
  assert.deepEqual(result.payload.issues, ["STREAM_DISCONNECTED"]);
});
