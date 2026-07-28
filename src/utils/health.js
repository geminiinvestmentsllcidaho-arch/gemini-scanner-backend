// src/utils/health.js
import { getStreamTelemetry } from "./stream_telemetry.js";

export function health(req, res) {
  const stream = getStreamTelemetry();

  const issues = [];
  if (stream.marketClockStale) issues.push("MARKET_CLOCK_STALE");
  if (stream.streamStale) issues.push("STREAM_STALE");
  if (stream.marketOpen === true && !stream.streamConnected) issues.push("STREAM_DISCONNECTED");

  const degraded = issues.length > 0;

  // Extension-only: keep existing keys, add new ones.
  res.json({
    status: "ok",
    degraded,
    issues,
    stream,
  });
}

export function readiness(req, res) {
  const stream = getStreamTelemetry();

  const issues = [];
  if (stream.marketClockStale) issues.push("MARKET_CLOCK_STALE");
  if (stream.streamStale) issues.push("STREAM_STALE");
  if (stream.marketOpen === true && !stream.streamConnected) issues.push("STREAM_DISCONNECTED");

  const ready = issues.length === 0;
  const payload = {
    ready,
    degraded: !ready,
    issues,
    stream,
  };

  if (!ready && typeof res?.status === "function") {
    return res.status(503).json(payload);
  }

  return res.json(payload);
}
