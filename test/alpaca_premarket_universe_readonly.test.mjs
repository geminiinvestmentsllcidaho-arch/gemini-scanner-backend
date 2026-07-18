import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchAlpacaPremarketUniverseReadonly,
  premarketSession,
  scorePremarketCandidate,
} from "../src/scanner/alpaca_premarket_universe_readonly.mjs";

test("detects the weekday premarket session in Eastern Time", () => {
  const session = premarketSession(new Date("2026-07-17T12:00:00.000Z"));
  assert.equal(session.session, "premarket");
  assert.equal(session.active, true);
  assert.equal(session.timezone, "America/New_York");
});

test("scores a fresh liquid premarket gap as watch-only", () => {
  const candidate = scorePremarketCandidate({
    symbol: "TEST",
    changePct: 6,
    spreadPct: 0.4,
    dollarVolume: 5000000,
    sourceStale: false,
  });
  assert.equal(candidate.decision, "WATCH");
  assert.equal(candidate.readOnly, true);
  assert.equal(candidate.orderPlacementAllowed, false);
  assert.equal(candidate.buyRecommendation, false);
});

test("blocks stale premarket evidence", () => {
  const candidate = scorePremarketCandidate({
    symbol: "STALE",
    changePct: 8,
    spreadPct: 0.2,
    dollarVolume: 9000000,
    sourceStale: true,
  });
  assert.equal(candidate.decision, "DO_NOT_ENTER");
  assert.ok(candidate.blockingFlags.includes("stale_source"));
});

test("builds a sorted read-only premarket universe", async () => {
  const result = await fetchAlpacaPremarketUniverseReadonly({
    now: new Date("2026-07-17T12:00:00.000Z"),
    minGapPct: 2,
    sourceFetcher: async () => ({
      version: "source_v1",
      status: "connected_readonly",
      assetCount: 2,
      snapshotCount: 2,
      candidates: [
        {
          symbol: "BBB",
          changePct: 3,
          spreadPct: 0.6,
          dollarVolume: 1000000,
          sourceStale: false,
        },
        {
          symbol: "AAA",
          changePct: 7,
          spreadPct: 0.3,
          dollarVolume: 5000000,
          sourceStale: false,
        },
      ],
      runtime: {
        brokerContactAllowed: true,
      },
    }),
  });

  assert.equal(result.candidateCount, 2);
  assert.equal(result.candidates[0].symbol, "AAA");
  assert.equal(result.readOnly, true);
  assert.equal(result.paperOnly, true);
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});
