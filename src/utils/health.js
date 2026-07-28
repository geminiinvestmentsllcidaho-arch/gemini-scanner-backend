// src/utils/health.js
import { getStreamTelemetry } from "./stream_telemetry.js";

export function buildRuntimeHealthState(stream = getStreamTelemetry()) {
  const issues = [];
  if (stream.marketClockStale) issues.push("MARKET_CLOCK_STALE");
  if (stream.streamStale) issues.push("STREAM_STALE");
  if (stream.marketOpen === true && !stream.streamConnected) issues.push("STREAM_DISCONNECTED");

  const degraded = issues.length > 0;
  return Object.freeze({
    degraded,
    issues: Object.freeze([...issues]),
    stream,
  });
}

export function health(req, res) {
  const state = buildRuntimeHealthState();

  // Extension-only: keep existing keys, add no mutation capability.
  return res.json({
    status: "ok",
    ...state,
  });
}

export function readiness(req, res) {
  const state = buildRuntimeHealthState();
  const payload = {
    ready: !state.degraded,
    ...state,
  };

  if (state.degraded && typeof res?.status === "function") {
    return res.status(503).json(payload);
  }

  return res.json(payload);
}
