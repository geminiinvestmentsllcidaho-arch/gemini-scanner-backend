import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerScannerFreshnessDiagnostic, VERSION } from "../src/scanner/customer_scanner_freshness_diagnostic.mjs";

test("freshness diagnostic separates ranking staleness from quote freshness", () => {
  const out = buildCustomerScannerFreshnessDiagnostic({
    nowMs: Date.parse("2026-07-24T14:00:00.000Z"),
    cacheDiagnostics: { running: true, scanCount: 12, hasSnapshot: true, latest: { marketClock: { isOpen: true }, candidateCount: 1, candidates: [{ symbol: "ABC", sourceTs: "2026-07-24T13:59:50.000Z", sourceAgeSec: 10, maxSourceAgeSec: 120, sourceStale: false, decision: "WAIT" }], sharedCache: { generatedAt: "2026-07-24T13:59:55.000Z", clockCheckedAt: "2026-07-24T13:59:55.000Z" } } },
    rankingRoot: { source: "/missing/dryrun.jsonl", sourceTs: "2026-07-10T16:23:11.550Z", sourceAgeSec: 1235328, maxAgeSec: 180, stale: true, scannerHealth: "stale", count: 1, issues: ["SCANNER_TELEMETRY_STALE"], rankings: [{ symbol: "ABC", rank: 1 }] },
    streamTelemetry: { streamConnected: true, streamStale: false, lastEventAgeSec: 0, staleThresholdSec: 90, reconnectAttempts: 0 },
  });
  assert.equal(out.version, VERSION);
  assert.equal(out.quoteFreshness.staleCount, 0);
  assert.equal(out.rankingFreshness.stale, true);
  assert.deepEqual(out.candidates[0].staleReasons, ["RANKINGS_STALE"]);
  assert.equal(out.candidates[0].finalResultState, "STALE_DATA");
  assert.equal(out.stream.connected, true);
  assert.deepEqual(out.runtimeHealth, { degraded: false, issues: [] });
  assert.equal(out.safety.orderPlacementAllowed, false);
});

test("freshness diagnostic reports missing ranking independently", () => {
  const out = buildCustomerScannerFreshnessDiagnostic({ cacheDiagnostics: { latest: { candidates: [{ symbol: "MISS", sourceStale: false }] } }, rankingRoot: { stale: false, rankings: [{ symbol: "OTHER" }] } });
  assert.deepEqual(out.candidates[0].staleReasons, ["RANKING_MISSING"]);
  assert.equal(out.staleReasonCounts.RANKING_MISSING, 1);
});

test("freshness diagnostic exposes authoritative stream session telemetry read only", () => {
  const marketClockUpdatedAtMs = Date.parse("2026-07-27T21:00:00.000Z");
  const out = buildCustomerScannerFreshnessDiagnostic({
    nowMs: marketClockUpdatedAtMs + 5_000,
    cacheDiagnostics: { latest: { candidates: [] } },
    rankingRoot: { stale: false, rankings: [] },
    streamTelemetry: {
      streamConnected: true,
      streamStale: false,
      lastEventAgeSec: 300,
      staleThresholdSec: 90,
      reconnectAttempts: 0,
      reconnectCountTotal: 4,
      watchdogTriggerCount: 2,
      streamUptimeMs: 123456,
      lastReconnectTs: "2026-07-27T20:55:00.000Z",
      marketOpen: false,
      marketClockUpdatedAtMs,
    },
  });

  assert.deepEqual(out.stream, {
    connected: true,
    stale: false,
    lastEventAgeSec: 300,
    staleThresholdSec: 90,
    reconnectAttempts: 0,
    reconnectCountTotal: 4,
    watchdogTriggerCount: 2,
    streamUptimeMs: 123456,
    lastReconnectTs: "2026-07-27T20:55:00.000Z",
    marketOpen: false,
    marketClockUpdatedAtMs,
    marketClockUpdatedAt: "2026-07-27T21:00:00.000Z",
    marketClockStale: false,
  });
  assert.equal(out.safety.readOnly, true);
  assert.equal(out.safety.orderPlacementAllowed, false);
});

test("freshness diagnostic normalizes unknown stream session telemetry safely", () => {
  const out = buildCustomerScannerFreshnessDiagnostic({
    cacheDiagnostics: { latest: { candidates: [] } },
    rankingRoot: { stale: false, rankings: [] },
    streamTelemetry: {
      marketOpen: "false",
      marketClockUpdatedAtMs: "invalid",
      lastReconnectTs: "invalid",
    },
  });

  assert.equal(out.stream.marketOpen, null);
  assert.equal(out.stream.marketClockUpdatedAtMs, null);
  assert.equal(out.stream.marketClockUpdatedAt, null);
  assert.equal(out.stream.lastReconnectTs, null);
});

test("freshness diagnostic propagates shared runtime health issues without mutation capability", () => {
  const out = buildCustomerScannerFreshnessDiagnostic({
    cacheDiagnostics: { latest: { candidates: [] } },
    rankingRoot: { stale: false, rankings: [] },
    streamTelemetry: {
      streamConnected: false,
      streamStale: true,
      marketOpen: true,
      marketClockStale: true,
    },
  });

  assert.deepEqual(out.runtimeHealth, {
    degraded: true,
    issues: ["MARKET_CLOCK_STALE", "STREAM_STALE", "STREAM_DISCONNECTED"],
  });
  assert.equal(out.stream.marketClockStale, true);
  assert.equal(out.safety.readOnly, true);
  assert.equal(out.safety.orderPlacementAllowed, false);
});
