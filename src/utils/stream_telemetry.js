// src/utils/stream_telemetry.js
// Module-level runtime telemetry for market data stream.
// Extension-only consumers (health, diagnostics). No side effects beyond in-memory state.

const telemetry = {
  streamConnected: false,
  lastEventTsMs: null, // number | null
  reconnectAttempts: 0, // number (0 when connected)

  // --- Additive reliability metrics ---
  reconnectCountTotal: 0,
  watchdogTriggerCount: 0,
  lastReconnectTs: null,

  uptimeAccumMs: 0,
  lastConnectedAtMs: null,
};

export function markStreamConnected(isConnected) {
  const next = !!isConnected;

  // Transition: disconnected -> connected
  if (next && !telemetry.streamConnected) {
    telemetry.lastConnectedAtMs = Date.now();
  }

  // Transition: connected -> disconnected
  if (!next && telemetry.streamConnected && telemetry.lastConnectedAtMs) {
    telemetry.uptimeAccumMs += Date.now() - telemetry.lastConnectedAtMs;
    telemetry.lastConnectedAtMs = null;
  }

  telemetry.streamConnected = next;
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

  // --- Additive ---
  telemetry.reconnectCountTotal += 1;
  telemetry.lastReconnectTs = Date.now();

  return telemetry.reconnectAttempts;
}

// --- Additive watchdog hook ---
export function incrementWatchdogTriggers() {
  telemetry.watchdogTriggerCount += 1;
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

  // --- Additive uptime calculation ---
  const liveUptimeMs =
    telemetry.streamConnected && telemetry.lastConnectedAtMs
      ? nowMs - telemetry.lastConnectedAtMs
      : 0;

  const streamUptimeMs = telemetry.uptimeAccumMs + liveUptimeMs;

  return {
    streamConnected: telemetry.streamConnected,
    reconnectAttempts: telemetry.reconnectAttempts,
    lastEventAgeSec,
    staleThresholdSec,
    streamStale,

    // --- Additive fields ---
    reconnectCountTotal: telemetry.reconnectCountTotal,
    watchdogTriggerCount: telemetry.watchdogTriggerCount,
    streamUptimeMs,
    lastReconnectTs: telemetry.lastReconnectTs,
  };
}
