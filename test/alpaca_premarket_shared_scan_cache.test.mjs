import test from "node:test";
import assert from "node:assert/strict";
import {
  practicalPremarketIntervalSec,
  isPremarketTradingDay,
  msUntilNextPremarketWake,
  createAlpacaPremarketSharedScanCache,
} from "../src/scanner/alpaca_premarket_shared_scan_cache.mjs";

test("uses practical staged premarket scan intervals", () => {
  assert.equal(practicalPremarketIntervalSec(Date.parse("2026-07-17T10:00:00.000Z")), 300);
  assert.equal(practicalPremarketIntervalSec(Date.parse("2026-07-17T11:30:00.000Z")), 120);
  assert.equal(practicalPremarketIntervalSec(Date.parse("2026-07-17T13:00:00.000Z")), 30);
});

test("recognizes trading day from Alpaca next open date", () => {
  const nowMs = Date.parse("2026-07-17T12:00:00.000Z");
  assert.equal(isPremarketTradingDay({ marketClock: { next_open: "2026-07-17T09:30:00-04:00" } }, nowMs), true);
  assert.equal(isPremarketTradingDay({ marketClock: { next_open: "2026-07-20T09:30:00-04:00" } }, nowMs), false);
});

test("automatically scans during active premarket and remains read only", async () => {
  const nowMs = Date.parse("2026-07-17T12:00:00.000Z");
  let calls = 0;
  let scheduled = null;
  const cache = createAlpacaPremarketSharedScanCache({
    now: () => nowMs,
    fetchScan: async () => {
      calls += 1;
      return {
        status: "connected_readonly",
        marketClock: { next_open: "2026-07-17T09:30:00-04:00" },
        candidates: [],
      };
    },
    setTimeoutImpl(fn, delay) {
      scheduled = { fn, delay };
      return 1;
    },
    clearTimeoutImpl() {},
  });

  const diagnostics = await cache.start();
  assert.equal(calls, 1);
  assert.equal(diagnostics.running, true);
  assert.equal(diagnostics.scanCount, 1);
  assert.equal(diagnostics.orderPlacementAllowed, false);
  assert.equal(diagnostics.accountMutationAllowed, false);
  assert.ok(scheduled?.delay > 0);
});


test("sleeps until the next weekday premarket window outside session", () => {
  const fridayNight = Date.parse("2026-07-18T02:30:00.000Z");
  const mondayWake = Date.parse("2026-07-20T08:00:00.000Z");
  assert.equal(msUntilNextPremarketWake(fridayNight), mondayWake - fridayNight);

  const mondayEarly = Date.parse("2026-07-20T07:30:00.000Z");
  const sameDayWake = Date.parse("2026-07-20T08:00:00.000Z");
  assert.equal(msUntilNextPremarketWake(mondayEarly), sameDayWake - mondayEarly);
});

test("scheduler does not poll every 30 seconds outside premarket", async () => {
  const nowMs = Date.parse("2026-07-18T02:30:00.000Z");
  let scheduled = null;
  const cache = createAlpacaPremarketSharedScanCache({
    now: () => nowMs,
    fetchScan: async () => {
      throw new Error("offsession_fetch_should_not_run");
    },
    setTimeoutImpl(fn, delay) {
      scheduled = { fn, delay };
      return 1;
    },
    clearTimeoutImpl() {},
  });

  const diagnostics = await cache.start();
  assert.equal(diagnostics.scanCount, 0);
  assert.equal(diagnostics.skippedCount, 1);
  assert.ok(scheduled?.delay > 24 * 60 * 60 * 1000);
});


test("exposes automatic premarket scheduler status and next wake evidence", async () => {
  const nowMs = Date.parse("2026-07-18T02:00:00.000Z");
  const cache = createAlpacaPremarketSharedScanCache({
    now: () => nowMs,
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {},
  });

  await cache.start();
  const diagnostics = cache.getDiagnostics();

  assert.equal(diagnostics.running, true);
  assert.equal(diagnostics.schedulerState, "sleeping");
  assert.equal(diagnostics.scanCount, 0);
  assert.equal(diagnostics.lastAutomaticScanAt, null);
  assert.equal(diagnostics.lastCandidateCount, 0);
  assert.ok(Date.parse(diagnostics.nextWakeAt) > nowMs);
  assert.ok(diagnostics.nextWakeMs > 0);
  assert.equal(diagnostics.readOnly, true);
  assert.equal(diagnostics.orderPlacementAllowed, false);
});


test("completed premarket scan publishes once and publication failure does not stop scheduler", async () => {
  const nowMs = Date.parse("2026-07-17T12:00:00.000Z");
  let publications = 0;
  const cache = createAlpacaPremarketSharedScanCache({
    now: () => nowMs,
    fetchScan: async () => ({
      status: "connected_readonly",
      marketClock: { next_open: "2026-07-17T09:30:00-04:00" },
      candidates: [{ symbol: "ABC", decision: "WATCH" }],
    }),
    onScanComplete: async () => {
      publications += 1;
      throw new Error("audit unavailable");
    },
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {},
  });

  const snapshot = await cache.start();
  assert.equal(publications, 1);
  assert.equal(snapshot.running, true);
  assert.equal(snapshot.scanCount, 1);
  assert.equal(snapshot.lastError, null);
  assert.equal(snapshot.aiEvidencePublicationCount, 0);
  assert.equal(snapshot.lastAiEvidencePublishedAt, null);
  assert.equal(snapshot.lastAiEvidencePublicationError, "audit unavailable");
  assert.equal(snapshot.orderPlacementAllowed, false);
  assert.equal(snapshot.scannerLogicMutationAllowed, false);
});


test("successful premarket evidence publication is exposed in diagnostics", async () => {
  const nowMs = Date.parse("2026-07-17T12:00:00.000Z");
  const cache = createAlpacaPremarketSharedScanCache({
    now: () => nowMs,
    fetchScan: async () => ({
      status: "connected_readonly",
      marketClock: { next_open: "2026-07-17T09:30:00-04:00" },
      candidates: [{ symbol: "XYZ", decision: "WAIT" }],
    }),
    onScanComplete: async () => {},
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {},
  });

  const diagnostics = await cache.start();
  assert.equal(diagnostics.aiEvidencePublicationCount, 1);
  assert.equal(diagnostics.lastAiEvidencePublishedAt, "2026-07-17T12:00:00.000Z");
  assert.equal(diagnostics.lastAiEvidencePublicationError, null);
  assert.equal(diagnostics.scannerLogicMutationAllowed, false);
});

test("shared premarket cache exposes read-only multiscan consolidation from repeated scans", async () => {
  let nowMs = Date.parse("2026-07-20T12:30:00.000Z");
  let score = 71;
  const cache = createAlpacaPremarketSharedScanCache({
    now: () => nowMs,
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {},
    fetchScan: async () => ({
      version: "test",
      status: "ok",
      generatedAt: new Date(nowMs).toISOString(),
      candidateCount: 1,
      candidates: [{
        symbol: "ABCD",
        decision: "WATCH",
        premarketPotentialScore: score,
        spreadPct: 1,
        dollarVolume: 300000 + ((score - 71) * 100000),
        changePct: 4,
      }],
      marketClock: { next_open: "2026-07-20T13:30:00-04:00" },
    }),
  });

  await cache.refreshNow();
  nowMs += 5 * 60 * 1000;
  score = 74;
  await cache.refreshNow();
  nowMs += 5 * 60 * 1000;
  score = 77;
  await cache.refreshNow();

  const consolidation = cache.getMultiscanConsolidation();
  assert.equal(cache.getScanHistory().length, 3);
  assert.equal(consolidation.candidates[0].symbol, "ABCD");
  assert.equal(consolidation.candidates[0].consolidationStatus, "confirmed_watch_candidate");
  assert.equal(consolidation.orderPlacementAllowed, false);
  assert.equal(consolidation.thresholdMutationAllowed, false);
});


test("hydrates persisted premarket scans across restart and preserves read-only consolidation", () => {
  const initialScanHistory = [
    {
      scanId: "premarket-1",
      generatedAt: "2026-07-20T12:20:00.000Z",
      candidates: [{ symbol: "ABCD", decision: "WATCH", readonlyPotentialScore: 70, spreadPct: 1, dollarVolume: 300000, changePct: 4 }],
    },
    {
      scanId: "premarket-2",
      generatedAt: "2026-07-20T12:25:00.000Z",
      candidates: [{ symbol: "ABCD", decision: "WATCH", readonlyPotentialScore: 73, spreadPct: 0.9, dollarVolume: 500000, changePct: 4.5 }],
    },
    {
      scanId: "premarket-3",
      generatedAt: "2026-07-20T12:30:00.000Z",
      candidates: [{ symbol: "ABCD", decision: "WATCH", readonlyPotentialScore: 76, spreadPct: 0.8, dollarVolume: 700000, changePct: 5 }],
    },
  ];

  const firstCache = createAlpacaPremarketSharedScanCache({
    initialScanHistory,
    now: () => Date.parse("2026-07-20T14:00:00.000Z"),
  });
  const restartedCache = createAlpacaPremarketSharedScanCache({
    initialScanHistory: firstCache.getScanHistory(),
    now: () => Date.parse("2026-07-20T14:05:00.000Z"),
  });

  const diagnostics = restartedCache.getDiagnostics();
  assert.equal(diagnostics.multiscanHistoryCount, 3);
  assert.equal(diagnostics.multiscanConsolidation.sourceScanCount, 3);
  assert.equal(diagnostics.multiscanConsolidation.candidates[0].symbol, "ABCD");
  assert.equal(diagnostics.multiscanConsolidation.candidates[0].consolidationStatus, "confirmed_watch_candidate");
  assert.equal(diagnostics.orderPlacementAllowed, false);
  assert.equal(diagnostics.accountMutationAllowed, false);
  assert.equal(diagnostics.scannerLogicMutationAllowed, false);
  assert.equal(diagnostics.thresholdMutationAllowed, false);
});

test("hydration safely excludes malformed entries, deduplicates, orders, and bounds history", () => {
  const cache = createAlpacaPremarketSharedScanCache({
    initialScanHistory: [
      null,
      {},
      { scanId: "duplicate", generatedAt: "2026-07-20T12:10:00.000Z", candidates: [] },
      { scanId: "newest", generatedAt: "2026-07-20T12:30:00.000Z", candidates: [] },
      { scanId: "duplicate", generatedAt: "2026-07-20T12:20:00.000Z", candidates: [] },
      { scanId: "oldest", generatedAt: "2026-07-20T12:00:00.000Z", candidates: [] },
      { scanId: "invalid-date", generatedAt: "not-a-date", candidates: [] },
    ],
    scanOptions: { maxHistoryScans: 10 },
  });

  assert.deepEqual(cache.getScanHistory().map((scan) => scan.scanId), ["oldest", "duplicate", "newest"]);
  assert.equal(cache.getDiagnostics().multiscanHistoryCount, 3);
  assert.equal(cache.getDiagnostics().orderPlacementAllowed, false);
});

test("empty or non-array hydration is safe", () => {
  const cache = createAlpacaPremarketSharedScanCache({ initialScanHistory: "not-an-array" });
  assert.deepEqual(cache.getScanHistory(), []);
  assert.equal(cache.getMultiscanConsolidation().candidateCount, 0);
  assert.equal(cache.getDiagnostics().thresholdMutationAllowed, false);
});
