import assert from "node:assert/strict";
import test from "node:test";
import {
  createAlpacaUnderFiveSharedScanCache,
  intervalSecForMarket,
  msUntilNextBoundary,
  MARKET_OPEN_BROAD_INTERVAL_SEC,
  MARKET_OPEN_FOCUSED_INTERVAL_SEC,
} from "../src/scanner/alpaca_under_five_shared_scan_cache.mjs";

test("calculates shared scan boundaries and two-tier market cadence", () => {
  assert.equal(MARKET_OPEN_FOCUSED_INTERVAL_SEC, 15);
  assert.equal(MARKET_OPEN_BROAD_INTERVAL_SEC, 300);
  assert.equal(intervalSecForMarket(true), 15);
  assert.equal(intervalSecForMarket(false), 300);
  assert.equal(msUntilNextBoundary(12_000, 15), 3_000);
  assert.equal(msUntilNextBoundary(300_000, 300), 300_000);
});

test("server start remains idle with no calls or timers until demand", async () => {
  let clockCalls = 0;
  let scanCalls = 0;
  const scheduled = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 1_000,
    setTimeoutImpl(fn, delayMs) { scheduled.push({ fn, delayMs }); return scheduled.length; },
    clearTimeoutImpl() {},
    async fetchMarketClock() { clockCalls += 1; return { ok: true, marketClock: { isOpen: true } }; },
    async fetchScan() { scanCalls += 1; return { ok: true, marketClock: { isOpen: true }, candidates: [] }; },
  });
  await cache.start();
  const d = cache.getDiagnostics();
  assert.equal(d.running, true);
  assert.equal(d.demandAware, true);
  assert.equal(d.demandActive, false);
  assert.equal(d.idleReason, "waiting_for_demand");
  assert.equal(d.timerScheduled, false);
  assert.equal(clockCalls, 0);
  assert.equal(scanCalls, 0);
  assert.equal(scheduled.length, 0);
});

test("customer demand opens a bounded scan window", async () => {
  let nowMs = 15_000;
  const scheduled = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => nowMs,
    demandWindowSec: 120,
    setTimeoutImpl(fn, delayMs) { scheduled.push({ fn, delayMs }); return scheduled.length; },
    clearTimeoutImpl() {},
    async fetchMarketClock() { return { ok: true, marketClock: { isOpen: true } }; },
    async fetchScan() { return { ok: true, status: "connected_readonly", marketClock: { isOpen: true }, candidates: [{ symbol: "DEMAND" }] }; },
  });
  await cache.start();
  cache.noteDemand();
  await cache.refreshNow();
  const d = cache.getDiagnostics();
  assert.equal(d.demandActive, true);
  assert.equal(d.demandUntil, new Date(135_000).toISOString());
  assert.equal(d.timerScheduled, true);
  assert.equal(d.scanCount, 1);
  assert.equal(cache.getLatest().idleNoDemand, false);
});

test("demand expiry returns scanner to idle without further polling", async () => {
  let nowMs = 15_000;
  const scheduled = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => nowMs,
    demandWindowSec: 15,
    setTimeoutImpl(fn, delayMs) { scheduled.push({ fn, delayMs }); return scheduled.length; },
    clearTimeoutImpl() {},
    async fetchMarketClock() { return { ok: true, marketClock: { isOpen: true } }; },
    async fetchScan() { return { ok: true, marketClock: { isOpen: true }, candidates: [] }; },
  });
  await cache.start();
  cache.noteDemand();
  await cache.refreshNow();
  const expiryTimer = scheduled.at(-1);
  nowMs = 30_000;
  await expiryTimer.fn();
  const d = cache.getDiagnostics();
  assert.equal(d.demandActive, false);
  assert.equal(d.timerScheduled, false);
  assert.equal(d.idleReason, "demand_window_expired");
  assert.equal(cache.getLatest().idleNoDemand, true);
});

test("repeated demand does not postpone an already scheduled market-open scan", async () => {
  let nowMs = 0;
  let scanCalls = 0;
  let timerId = 0;
  const timers = new Map();
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => nowMs,
    setTimeoutImpl(fn, delayMs) {
      const id = ++timerId;
      timers.set(id, { fn, at: nowMs + delayMs, cancelled: false });
      return id;
    },
    clearTimeoutImpl(id) {
      const timer = timers.get(id);
      if (timer) timer.cancelled = true;
    },
    async fetchMarketClock() {
      return { ok: true, marketClock: { isOpen: true } };
    },
    async fetchScan() {
      scanCalls += 1;
      return { ok: true, status: "connected_readonly", marketClock: { isOpen: true }, candidates: [] };
    },
  });

  await cache.start();
  cache.noteDemand();
  await cache.refreshNow();
  assert.equal(scanCalls, 1);
  assert.equal(cache.getDiagnostics().nextWakeAt, new Date(15_000).toISOString());

  for (const t of [5_000, 10_000, 14_999]) {
    nowMs = t;
    cache.noteDemand();
    assert.equal(cache.getDiagnostics().nextWakeAt, new Date(15_000).toISOString());
  }

  nowMs = 15_000;
  const due = [...timers.values()]
    .filter((timer) => !timer.cancelled && timer.at <= nowMs)
    .sort((a, b) => a.at - b.at)[0];
  assert.ok(due);
  await due.fn();

  assert.equal(scanCalls, 2);
  assert.equal(cache.getDiagnostics().nextWakeAt, new Date(30_000).toISOString());
});

test("market-open scheduler performs focused candidate refreshes between five-minute broad scans", async () => {
  let nowMs = 0;
  const calls = [];
  let timerId = 0;
  const timers = new Map();
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => nowMs,
    setTimeoutImpl(fn, delayMs) {
      const id = ++timerId;
      timers.set(id, { fn, at: nowMs + delayMs, cancelled: false });
      return id;
    },
    clearTimeoutImpl(id) {
      const timer = timers.get(id);
      if (timer) timer.cancelled = true;
    },
    async fetchMarketClock() {
      return { ok: true, marketClock: { isOpen: true } };
    },
    async fetchScan(options = {}) {
      calls.push(options);
      const symbols = Array.isArray(options.symbols) ? options.symbols : null;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: symbols
          ? symbols.map((symbol) => ({ symbol }))
          : [{ symbol: "AAA" }, { symbol: "BBB" }],
      };
    },
  });

  await cache.start();
  cache.noteDemand();
  await cache.refreshNow();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].symbols, undefined);
  assert.equal(cache.getDiagnostics().broadScanCount, 1);
  assert.equal(cache.getDiagnostics().focusedScanCount, 0);

  nowMs = 15_000;
  const due = [...timers.values()]
    .filter((timer) => !timer.cancelled && timer.at <= nowMs)
    .sort((a, b) => a.at - b.at)[0];
  assert.ok(due);
  await due.fn();

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].symbols, ["AAA", "BBB"]);
  assert.equal(cache.getDiagnostics().broadScanCount, 1);
  assert.equal(cache.getDiagnostics().focusedScanCount, 1);
  assert.equal(cache.getDiagnostics().latest.sharedCache.scanTier, "focused");
  assert.equal(cache.getDiagnostics().nextWakeAt, new Date(30_000).toISOString());
});

test("market-open scheduler returns to broad discovery at the five-minute boundary", async () => {
  let nowMs = 0;
  const calls = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => nowMs,
    demandWindowSec: 600,
    setTimeoutImpl() { return 1; },
    clearTimeoutImpl() {},
    async fetchMarketClock() {
      return { ok: true, marketClock: { isOpen: true } };
    },
    async fetchScan(options = {}) {
      calls.push(options);
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: [{ symbol: "AAA" }],
      };
    },
  });

  await cache.start();
  cache.noteDemand();
  await cache.refreshNow();
  nowMs = 300_000;
  await cache.refreshFocusedNow();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].symbols, ["AAA"]);

  await cache.refreshNow();
  assert.equal(calls.length, 3);
  assert.equal(calls[2].symbols, undefined);
  assert.equal(cache.getDiagnostics().broadScanCount, 2);
  assert.equal(cache.getDiagnostics().focusedScanCount, 1);
  assert.equal(cache.getDiagnostics().latest.sharedCache.scanTier, "broad");
});

test("focused refresh uses the exact previously discovered candidate symbol set without changing candidate rules", async () => {
  const calls = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 1_000,
    async fetchScan(options = {}) {
      calls.push(options);
      if (Array.isArray(options.symbols)) {
        return {
          ok: true,
          status: "connected_readonly",
          marketClock: { isOpen: true },
          candidates: options.symbols.map((symbol) => ({ symbol })),
        };
      }
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: [{ symbol: "BBB" }, { symbol: "AAA" }, { symbol: "BBB" }],
      };
    },
  });

  await cache.refreshNow();
  await cache.refreshFocusedNow();

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].symbols, ["BBB", "AAA"]);
  assert.equal(cache.getDiagnostics().broadScanCount, 1);
  assert.equal(cache.getDiagnostics().focusedScanCount, 1);
});

test("focused refresh keeps using the exact broad-discovery symbol set even when a focused result temporarily shrinks", async () => {
  const calls = [];
  let focusedCall = 0;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 1_000,
    async fetchScan(options = {}) {
      calls.push(options);
      if (!Array.isArray(options.symbols)) {
        return {
          ok: true,
          status: "connected_readonly",
          marketClock: { isOpen: true },
          candidates: [{ symbol: "AAA" }, { symbol: "BBB" }],
        };
      }
      focusedCall += 1;
      return {
        ok: true,
        status: "connected_readonly",
        marketClock: { isOpen: true },
        candidates: focusedCall === 1 ? [{ symbol: "AAA" }] : options.symbols.map((symbol) => ({ symbol })),
      };
    },
  });

  await cache.refreshNow();
  await cache.refreshFocusedNow();
  assert.deepEqual(cache.getLatest().candidates.map((candidate) => candidate.symbol), ["AAA"]);
  assert.deepEqual(cache.getDiagnostics().broadCandidateSymbols, ["AAA", "BBB"]);

  await cache.refreshFocusedNow();

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].symbols, ["AAA", "BBB"]);
  assert.deepEqual(calls[2].symbols, ["AAA", "BBB"]);
  assert.equal(cache.getDiagnostics().broadScanCount, 1);
  assert.equal(cache.getDiagnostics().focusedScanCount, 2);
});

test("wake refresh schedules market-open cadence after idle without waiting for demand expiry", async () => {
  let nowMs = 0;
  const scheduled = [];
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => nowMs,
    setTimeoutImpl(fn, delayMs) {
      scheduled.push({ fn, delayMs, at: nowMs + delayMs });
      return scheduled.length;
    },
    clearTimeoutImpl() {},
    async fetchMarketClock() {
      return { ok: true, marketClock: { isOpen: true } };
    },
    async fetchScan() {
      return { ok: true, status: "connected_readonly", marketClock: { isOpen: true }, candidates: [] };
    },
  });

  await cache.start();
  cache.noteDemand();
  assert.equal(cache.getDiagnostics().timerScheduled, false);

  await cache.refreshNow();
  assert.equal(cache.getDiagnostics().nextWakeAt, new Date(15_000).toISOString());
});

test("shared cache does not freeze source freshness at scan start", async () => {
  let receivedOptions = null;
  const cache = createAlpacaUnderFiveSharedScanCache({
    now: () => 1_000,
    async fetchScan(options) {
      receivedOptions = options;
      return { ok: true, marketClock: { isOpen: true }, candidates: [] };
    },
  });

  await cache.refreshNow();

  assert.deepEqual(receivedOptions, {});
  assert.equal(Object.prototype.hasOwnProperty.call(receivedOptions, "nowMs"), false);
});

test("concurrent refreshes deduplicate", async () => {
  let calls = 0;
  let resolveFetch;
  const pending = new Promise((resolve) => { resolveFetch = resolve; });
  const cache = createAlpacaUnderFiveSharedScanCache({ fetchScan: async () => { calls += 1; return pending; } });
  const left = cache.refreshNow();
  const right = cache.refreshNow();
  assert.equal(calls, 1);
  resolveFetch({ ok: true, marketClock: { isOpen: true }, candidates: [] });
  const [a, b] = await Promise.all([left, right]);
  assert.equal(a, b);
  assert.equal(cache.getDiagnostics().scanCount, 1);
});

test("audit hook failures remain non-blocking", async () => {
  const cache = createAlpacaUnderFiveSharedScanCache({
    fetchScan: async () => ({ ok: true, marketClock: { isOpen: true }, candidates: [] }),
    async onScanComplete() { throw new Error("audit unavailable"); },
  });
  const result = await cache.refreshNow();
  assert.equal(result.ok, true);
  assert.equal(cache.getDiagnostics().lastError, null);
});
