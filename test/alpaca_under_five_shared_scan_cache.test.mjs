import assert from "node:assert/strict";
import test from "node:test";

import {
  createAlpacaUnderFiveSharedScanCache,
  msUntilNextBoundary,
} from "../src/scanner/alpaca_under_five_shared_scan_cache.mjs";

test("calculates exact shared scan boundaries", () => {
  assert.equal(msUntilNextBoundary(12_000, 15), 3_000);
  assert.equal(msUntilNextBoundary(30_000, 30), 30_000);
  assert.equal(msUntilNextBoundary(31_250, 30), 28_750);
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

test("starts with one scan and schedules the next aligned boundary", async () => {
  const scheduled = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 31_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    fetchScan: async () => ({
      ok: true,
      status: "connected_readonly",
      marketClock: { isOpen: false },
      candidates: [],
    }),
  });

  await cache.start();

  assert.equal(cache.getDiagnostics().running, true);
  assert.equal(cache.getDiagnostics().scanCount, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 28_750);

  cache.stop();
  assert.equal(cache.getDiagnostics().running, false);
});

test("scheduler keeps running after a refresh failure", async () => {
  const scheduled = [];
  let calls = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 31_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    fetchScan: async () => {
      calls += 1;
      if (calls === 2) throw new Error("temporary scan failure");
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: false },
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
    now: () => 31_250,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    fetchScan: async () => {
      throw new Error("initial scan failure");
    },
  });

  await assert.rejects(cache.start(), /initial scan failure/);

  assert.equal(cache.getDiagnostics().running, true);
  assert.equal(cache.getDiagnostics().lastError, "initial scan failure");
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 28_750);

  cache.stop();
});
