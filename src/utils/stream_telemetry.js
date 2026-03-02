// src/utils/stream_telemetry.js
// Module-level runtime telemetry for market data stream.
// Extension-only consumers (health, diagnostics). No side effects beyond in-memory state.

const telemetry = {
  streamConnected: false,
  lastEventTsMs: null, // number | null
  reconnectAttempts: 0, // number (0 when connected)
};

export function markStreamConnected(isConnected) {
  telemetry.streamConnected = !!isConnected;
}

export function markStreamEvent(tsMs = Date.now()) {
  telemetry.lastEventTsMs = Number.isFinite(tsMs) ? tsMs : Date.now();
}

// Additive: runtime hardening telemetry
export function resetReconnectAttempts() {
  telemetry.reconnectAttempts = 0;
}

export function incrementReconnectAttempts() {
  telemetry.reconnectAttempts = (telemetry.reconnectAttempts || 0) + 1;
  return telemetry.reconnectAttempts;
}

export function getStreamTelemetry({ nowMs = Date.now() } = {}) {
  const staleThresholdSec = Number(process.env.STREAM_STALE_THRESHOLD_SEC || 30); // default 30s

  const lastEventAgeSec =
    Number.isFinite(telemetry.lastEventTsMs)
      ? Math.floor((nowMs - telemetry.lastEventTsMs) / 1000)
      : null;

  const streamStale =
    telemetry.streamConnected &&
    lastEventAgeSec !== null &&
    Number.isFinite(staleThresholdSec) &&
    lastEventAgeSec > staleThresholdSec;

  return {
    streamConnected: telemetry.streamConnected,
    reconnectAttempts: telemetry.reconnectAttempts,
    lastEventAgeSec,
    staleThresholdSec,
    streamStale,
  };
}
