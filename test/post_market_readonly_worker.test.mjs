import assert from "node:assert/strict";
import test from "node:test";
import { runPostMarketReadonlyWorkerCycle } from "../src/scanner/post_market_readonly_worker.mjs";

const now = new Date("2026-07-17T21:00:00.000Z");
const paper = () => ({ ok: true, status: "connected_readonly", account: { portfolioValue: 10000 }, positions: [{ symbol: "AAA", averageEntryPrice: 10, currentPrice: 9.5, marketValue: 950, unrealizedPlpc: -0.05 }] });
const evidence = () => ({ ok: true, status: "connected_readonly", candidates: [
  { symbol: "AAA", currentPrice: 9.5, changePct: -2, relativeVolume: 3, spreadPct: 0.5, dollarVolume: 4000000, catalystKnown: true, sourceTs: "2026-07-17T20:59:00.000Z" },
  { symbol: "NEXT", currentPrice: 20, afterHoursPrice: 20.4, afterHoursChangePct: 2, dayChangePct: 3, relativeVolume: 2, spreadPct: 0.4, dollarVolume: 5000000, trendIntact: true, sourceTs: "2026-07-17T20:59:00.000Z" },
] });

test("runs complete read-only post-market review", async () => {
  const result = await runPostMarketReadonlyWorkerCycle({ now, fetchPaperAccount: async () => paper(), fetchMarketEvidence: async () => evidence() });
  assert.equal(result.status, "completed_readonly");
  assert.equal(result.positionReviews[0].state, "REDUCE_RISK_REVIEW");
  assert.equal(result.overnightReviews[0].state, "ELEVATED_OVERNIGHT_RISK");
  assert.equal(result.nextOpenWatchlist[1].state, "CONTINUATION_WATCH");
  assert.equal(result.qualityReview.sourceRecordCount, 2);
  assert.ok(result.fingerprint);
});

test("fails closed when a source is unavailable", async () => {
  const result = await runPostMarketReadonlyWorkerCycle({ now, fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [] }), fetchMarketEvidence: async () => ({ ok: false, status: "snapshot_fetch_failed", candidates: [] }) });
  assert.equal(result.status, "source_unavailable_fail_closed");
  assert.equal(result.success, false);
  assert.equal(result.orderPlacementAllowed, false);
});

test("fails closed when an API rejects", async () => {
  const result = await runPostMarketReadonlyWorkerCycle({ now, fetchPaperAccount: async () => { throw new Error("network unavailable"); }, fetchMarketEvidence: async () => evidence() });
  assert.equal(result.status, "source_fetch_failed_closed");
  assert.equal(result.failureReason, "network unavailable");
});

test("suppresses duplicate unchanged snapshots", async () => {
  const first = await runPostMarketReadonlyWorkerCycle({ now, fetchPaperAccount: async () => paper(), fetchMarketEvidence: async () => evidence() });
  const second = await runPostMarketReadonlyWorkerCycle({ now, previousFingerprint: first.fingerprint, fetchPaperAccount: async () => paper(), fetchMarketEvidence: async () => evidence() });
  assert.equal(second.duplicateSnapshot, true);
});


test("fails closed without fabricating freshness when held-position evidence is missing", async () => {
  const result = await runPostMarketReadonlyWorkerCycle({
    now,
    fetchPaperAccount: async () => paper(),
    fetchMarketEvidence: async () => ({
      ok: true,
      status: "connected_readonly",
      candidates: [],
    }),
  });

  assert.equal(result.status, "completed_readonly");
  assert.equal(result.positionReviews[0].symbol, "AAA");
  assert.equal(result.positionReviews[0].state, "REVIEW_UNAVAILABLE");
  assert.equal(result.positionReviews[0].sourceTimestamp, null);
  assert.deepEqual(result.positionReviews[0].flags, ["SOURCE_TIMESTAMP_UNAVAILABLE"]);
  assert.equal(result.overnightReviews[0].state, "INSUFFICIENT_DATA");
  assert.equal(result.qualityReview.proposalReport.proposalCount, 0);
});

test("stale evidence produces no calibration proposals", async () => {
  const stale = evidence();
  stale.candidates = stale.candidates.map((candidate) => ({ ...candidate, sourceTs: "2026-07-17T20:00:00.000Z" }));
  const result = await runPostMarketReadonlyWorkerCycle({ now, maxFreshSec: 900, fetchPaperAccount: async () => paper(), fetchMarketEvidence: async () => stale });
  assert.ok(result.sourceFreshness.stalePositionCount >= 1);
  assert.equal(result.qualityReview.proposalReport.proposalCount, 0);
});

test("keeps all execution and mutation locks closed", async () => {
  const result = await runPostMarketReadonlyWorkerCycle({ now, fetchPaperAccount: async () => paper(), fetchMarketEvidence: async () => evidence() });
  for (const key of ["automaticLearningAllowed", "scannerLogicMutationAllowed", "thresholdMutationAllowed", "orderPlacementAllowed", "brokerContactAllowed", "accountMutationAllowed"]) assert.equal(result[key], false);
  assert.equal(result.readOnly, true);
  assert.equal(result.paperOnly, true);
  assert.equal(result.humanReviewRequired, true);
});


test("separates held-position evidence from configured watchlist evidence", async () => {
  const calls = [];
  const result = await runPostMarketReadonlyWorkerCycle({
    now,
    env: { ALPACA_SYMBOLS: "NEXT, MSFT, next, BAD SYMBOL" },
    fetchPaperAccount: async () => ({
      ok: true,
      status: "connected_readonly",
      account: { portfolioValue: 10000 },
      positions: [
        { symbol: "AAA", marketValue: 950 },
        { symbol: "NVDA", marketValue: 500 },
      ],
    }),
    fetchMarketEvidence: async (options) => {
      calls.push(options);
      return evidence();
    },
  });

  assert.equal(result.status, "completed_readonly");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].symbols, ["AAA", "NVDA"]);
  assert.equal(calls[0].minPrice, 0);
  assert.equal(calls[0].maxPrice, Number.POSITIVE_INFINITY);
  assert.equal(calls[0].minDailyVolume, 0);
  assert.deepEqual(calls[1].symbols, ["NEXT", "MSFT"]);
  assert.equal(Object.hasOwn(calls[1], "minPrice"), false);
  assert.equal(Object.hasOwn(calls[1], "maxPrice"), false);
  assert.equal(Object.hasOwn(calls[1], "minDailyVolume"), false);
});

test("uses a small default evidence universe when positions and watchlist are empty", async () => {
  const calls = [];
  await runPostMarketReadonlyWorkerCycle({
    now,
    env: {},
    fetchPaperAccount: async () => ({
      ok: true,
      status: "connected_readonly",
      account: { portfolioValue: 10000 },
      positions: [],
    }),
    fetchMarketEvidence: async (options) => {
      calls.push(options);
      return evidence();
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].symbols, ["AAPL", "MSFT", "NVDA", "SPY"]);
  assert.equal(calls[0].maxAssets, 4);
  assert.equal(Object.hasOwn(calls[0], "minPrice"), false);
  assert.equal(Object.hasOwn(calls[0], "maxPrice"), false);
  assert.equal(Object.hasOwn(calls[0], "minDailyVolume"), false);
});

test("propagates provider relative volume into held-position overnight evidence", async () => {
  const result = await runPostMarketReadonlyWorkerCycle({
    now,
    fetchPaperAccount: async () => paper(),
    fetchMarketEvidence: async () => ({
      ok: true,
      status: "connected_readonly",
      candidates: [{
        symbol: "AAA",
        currentPrice: 9.5,
        changePct: -2,
        relativeVolume: 3,
        spreadPct: 0.5,
        dollarVolume: 4000000,
        catalystKnown: true,
        sourceTs: "2026-07-17T20:59:00.000Z",
      }],
    }),
  });

  assert.equal(result.overnightReviews[0].metrics.relativeVolume, 3);
  assert.equal(result.overnightReviews[0].flags.includes("RELATIVE_VOLUME_UNAVAILABLE"), false);
  assert.equal(result.readOnly, true);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});

test("held-position evidence takes merge precedence over a repeated watchlist symbol", async () => {
  let call = 0;
  const result = await runPostMarketReadonlyWorkerCycle({
    now,
    env: { ALPACA_SYMBOLS: "AAA,NEXT" },
    fetchPaperAccount: async () => paper(),
    fetchMarketEvidence: async (options) => {
      call += 1;
      const held = options.minPrice === 0;
      return {
        ok: true,
        status: "connected_readonly",
        candidates: options.symbols.map((symbol) => ({
          symbol,
          currentPrice: held ? 9.5 : 99,
          changePct: -2,
          relativeVolume: held ? 3 : 1,
          spreadPct: 0.5,
          dollarVolume: 4000000,
          catalystKnown: true,
          sourceTs: "2026-07-17T20:59:00.000Z",
        })),
      };
    },
  });

  assert.equal(call, 2);
  assert.equal(result.positionReviews[0].metrics.currentPrice, 9.5);
  assert.equal(result.overnightReviews[0].metrics.relativeVolume, 3);
  assert.equal(result.readOnly, true);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});
