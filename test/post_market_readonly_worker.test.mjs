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


test("bounds market evidence to paper positions plus configured watchlist symbols", async () => {
  let evidenceOptions = null;
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
      evidenceOptions = options;
      return evidence();
    },
  });

  assert.equal(result.status, "completed_readonly");
  assert.deepEqual(evidenceOptions.symbols, ["AAA", "NVDA", "NEXT", "MSFT"]);
  assert.equal(evidenceOptions.maxAssets, 4);
  assert.equal(evidenceOptions.symbols.length <= 50, true);
});

test("uses a small default evidence universe when positions and watchlist are empty", async () => {
  let evidenceOptions = null;
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
      evidenceOptions = options;
      return evidence();
    },
  });

  assert.deepEqual(evidenceOptions.symbols, ["AAPL", "MSFT", "NVDA", "SPY"]);
  assert.equal(evidenceOptions.maxAssets, 4);
});
