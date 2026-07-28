import test from "node:test";
import assert from "node:assert/strict";

import { health } from "../src/utils/health.js";
import {
  markStreamConnected,
  markStreamMarketSession,
} from "../src/utils/stream_telemetry.js";

function readHealth() {
  let payload = null;
  health(null, {
    json(value) {
      payload = value;
    },
  });
  return payload;
}

test("closed authoritative session does not degrade health for an intentionally disconnected stream", () => {
  markStreamConnected(false);
  markStreamMarketSession(false);

  const payload = readHealth();
  assert.equal(payload.stream.marketOpen, false);
  assert.equal(payload.stream.streamConnected, false);
  assert.equal(payload.degraded, false);
  assert.deepEqual(payload.issues, []);
});

test("open authoritative session degrades health for a disconnected stream", () => {
  markStreamConnected(false);
  markStreamMarketSession(true);

  const payload = readHealth();
  assert.equal(payload.stream.marketOpen, true);
  assert.equal(payload.stream.streamConnected, false);
  assert.equal(payload.degraded, true);
  assert.deepEqual(payload.issues, ["STREAM_DISCONNECTED"]);
});

test("unknown session does not claim an actionable stream disconnect", () => {
  markStreamConnected(false);
  markStreamMarketSession(null);

  const payload = readHealth();
  assert.equal(payload.stream.marketOpen, null);
  assert.equal(payload.degraded, false);
  assert.deepEqual(payload.issues, []);
});
