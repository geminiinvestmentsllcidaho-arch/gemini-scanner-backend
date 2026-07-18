import test from "node:test";
import assert from "node:assert/strict";
import {
  practicalPremarketIntervalSec,
  isPremarketTradingDay,
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
