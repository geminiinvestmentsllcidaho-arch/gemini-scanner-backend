import assert from "node:assert/strict";
import test from "node:test";
import {
  createAlpacaUnderFiveSharedScanCache,
  intervalSecForMarket,
  msUntilNextBoundary,
} from "../src/scanner/alpaca_under_five_shared_scan_cache.mjs";

test("calculates shared scan boundaries and market cadence", () => {
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
