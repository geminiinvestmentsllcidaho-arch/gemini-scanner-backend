import assert from "node:assert/strict";
import test from "node:test";

import {
  createAlpacaUnderFiveSharedScanCache,
  intervalSecForMarket,
  msUntilNextBoundary,
} from "../src/scanner/alpaca_under_five_shared_scan_cache.mjs";

test("calculates exact shared scan boundaries and market cadence", () => {
  assert.equal(intervalSecForMarket(true), 15);
  assert.equal(intervalSecForMarket(false), 300);
  assert.equal(msUntilNextBoundary(12_000, 15), 3_000);
  assert.equal(msUntilNextBoundary(300_000, 300), 300_000);
  assert.equal(msUntilNextBoundary(301_250, 300), 298_750);
});

test("shares one cached scan result across repeated readers", async () => {
  let calls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => Date.parse("2026-07-10T20:45:00.000Z"),
    fetchScan: async () => {
      calls += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: [{ symbol: "TEST" }],
      };
    },
  });

  await cache.refreshNow();
  const first = cache.getLatest();
  const second = cache.getLatest();

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(first.sharedCache.sharedAcrossRequests, true);
  assert.equal(cache.getDiagnostics().scanCount, 1);
});

test("deduplicates concurrent refreshes with one in-flight request", async () => {
  let calls = 0;
  let resolveFetch;
  const fetchPromise = new Promise((resolve) => {
    resolveFetch = resolve;
  });

  const cache = createAlpacaUnderFiveSharedScanCache({
    fetchScan: async () => {
      calls += 1;
      return fetchPromise;
    },
  });

  const left = cache.refreshNow();
  const right = cache.refreshNow();

  assert.equal(calls, 1);

  resolveFetch({
    ok: true,
    status: "connected_readonly",
    marketClock: { isOpen: false },
    candidates: [],
  });

  const [a, b] = await Promise.all([left, right]);
  assert.equal(a, b);
  assert.equal(cache.getDiagnostics().scanCount, 1);
});

test("starts without a full scan and schedules the next closed-market boundary", async () => {
  const scheduled = [];
  let scanCalls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 301_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    fetchMarketClock: async () => ({
      ok: true,
      status: "connected_readonly",
      marketClock: { isOpen: false },
    }),
    fetchScan: async () => {
      scanCalls += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: false },
        candidates: [],
      };
    },
  });

  await cache.start();

  assert.equal(cache.getDiagnostics().running, true);
  assert.equal(cache.getDiagnostics().scanCount, 0);
  assert.equal(scanCalls, 0);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 298_750);

  cache.stop();
  assert.equal(cache.getDiagnostics().running, false);
});

test("scheduler keeps running after a refresh failure", async () => {
  const scheduled = [];
  let calls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 301_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    fetchMarketClock: async () => ({
      ok: true,
      status: "connected_readonly",
      marketClock: { isOpen: true },
    }),
    fetchScan: async () => {
      calls += 1;
      if (calls === 2) throw new Error("temporary scan failure");
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: [],
      };
    },
  });

  await cache.start();
  assert.equal(scheduled.length, 1);

  await scheduled[0].fn();

  assert.equal(cache.getDiagnostics().running, true);
  assert.equal(cache.getDiagnostics().lastError, "temporary scan failure");
  assert.equal(scheduled.length, 2);

  cache.stop();
});

test("initial start failure still schedules a retry", async () => {
  const scheduled = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 301_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    fetchMarketClock: async () => ({
      ok: true,
      status: "connected_readonly",
      marketClock: { isOpen: true },
    }),
    fetchScan: async () => {
      throw new Error("initial scan failure");
    },
  });

  await assert.rejects(cache.start(), /initial scan failure/);

  assert.equal(cache.getDiagnostics().running, true);
  assert.equal(cache.getDiagnostics().lastError, "initial scan failure");
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 298_750);

  cache.stop();
});


test("publishes each completed scan to a non-blocking audit hook", async () => {
  const published = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => Date.parse("2026-07-16T15:55:00.000Z"),
    fetchScan: async () => ({
      ok: true,
      status: "connected_readonly",
      marketClock: { isOpen: true },
      candidates: [{ symbol: "AUDIT", decision: "WAIT" }],
    }),
    async onScanComplete(snapshot) {
      published.push(snapshot);
    },
  });

  const result = await cache.refreshNow();

  assert.equal(published.length, 1);
  assert.equal(published[0], result);
  assert.equal(published[0].sharedCache.scanCount, 1);
});

test("audit hook failures do not fail or stop completed scans", async () => {
  const cache = createAlpacaUnderFiveSharedScanCache({
    fetchScan: async () => ({
      ok: true,
      status: "connected_readonly",
      marketClock: { isOpen: false },
      candidates: [],
    }),
    async onScanComplete() {
      throw new Error("audit unavailable");
    },
  });

  const result = await cache.refreshNow();

  assert.equal(result.ok, true);
  assert.equal(cache.getDiagnostics().scanCount, 1);
  assert.equal(cache.getDiagnostics().lastError, null);
});

test("defers the full universe scan at startup while the market is closed", async () => {
  const scheduled = [];
  let scanCalls = 0;
  let clockCalls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 301_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    async fetchMarketClock() {
      clockCalls += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: {
          isOpen: false,
          nextOpen: "2026-07-21T09:30:00-04:00",
        },
      };
    },
    async fetchScan() {
      scanCalls += 1;
      throw new Error("full scan must not run during closed-market startup");
    },
  });

  await cache.start();

  const latest = cache.getLatest();
  assert.equal(clockCalls, 1);
  assert.equal(scanCalls, 0);
  assert.equal(latest.startupDeferred, true);
  assert.equal(latest.marketClock.isOpen, false);
  assert.equal(cache.getDiagnostics().scanCount, 0);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 298_750);
  cache.stop();
});

test("runs the full universe scan at startup when the market is open", async () => {
  let scanCalls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 15_000,
    setTimeoutImpl() {
      return 1;
    },
    clearTimeoutImpl() {},
    async fetchMarketClock() {
      return { ok: true, marketClock: { isOpen: true } };
    },
    async fetchScan() {
      scanCalls += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: [],
      };
    },
  });

  await cache.start();
  assert.equal(scanCalls, 1);
  assert.equal(cache.getDiagnostics().scanCount, 1);
  cache.stop();
});


test("scheduled closed-market ticks use only the lightweight clock and never run the full scan", async () => {
  const scheduled = [];
  let clockCalls = 0;
  let scanCalls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 301_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    async fetchMarketClock() {
      clockCalls += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: false, nextOpen: "2026-07-21T09:30:00-04:00" },
      };
    },
    async fetchScan() {
      scanCalls += 1;
      throw new Error("full scan must not run while market is closed");
    },
  });

  await cache.start();
  await scheduled[0].fn();
  await scheduled[1].fn();

  assert.equal(clockCalls, 3);
  assert.equal(scanCalls, 0);
  assert.equal(cache.getDiagnostics().scanCount, 0);
  assert.equal(cache.getLatest().marketClock.isOpen, false);
  assert.equal(scheduled.length, 3);
  cache.stop();
});

test("scheduled tick transitions from closed clock checks to one full scan when market opens", async () => {
  const scheduled = [];
  let clockCalls = 0;
  let scanCalls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 301_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    async fetchMarketClock() {
      clockCalls += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: clockCalls >= 2 },
      };
    },
    async fetchScan() {
      scanCalls += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: [{ symbol: "OPEN" }],
      };
    },
  });

  await cache.start();
  assert.equal(scanCalls, 0);

  await scheduled[0].fn();

  assert.equal(clockCalls, 2);
  assert.equal(scanCalls, 1);
  assert.equal(cache.getDiagnostics().scanCount, 1);
  assert.equal(cache.getLatest().marketClock.isOpen, true);
  assert.equal(cache.getLatest().candidates[0].symbol, "OPEN");
  cache.stop();
});

test("scheduled clock failure records diagnostics and keeps the scheduler alive without scanning", async () => {
  const scheduled = [];
  let clockCalls = 0;
  let scanCalls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 301_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    async fetchMarketClock() {
      clockCalls += 1;
      if (clockCalls >= 2) throw new Error("clock unavailable");
      return { ok: true, marketClock: { isOpen: false } };
    },
    async fetchScan() {
      scanCalls += 1;
      return { ok: true, marketClock: { isOpen: true }, candidates: [] };
    },
  });

  await cache.start();
  await scheduled[0].fn();

  assert.equal(scanCalls, 0);
  assert.equal(cache.getDiagnostics().lastError, "clock unavailable");
  assert.equal(cache.getDiagnostics().running, true);
  assert.equal(scheduled.length, 2);
  cache.stop();
});
