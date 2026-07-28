import test from "node:test";
import assert from "node:assert/strict";

import {
  bridgeCustomerZeroFreshRankings,
  VERSION,
} from "../src/scanner/customer_zero_fresh_ranking_bridge.mjs";

test("bridges fresh ranking confidence and reasons by symbol", () => {
  const out = bridgeCustomerZeroFreshRankings({
    candidates: [{
      symbol: "abc",
      price: 4.25,
      decision: "WAIT",
      sourceStale: false,
    }],
  }, {
    sourceTs: "2026-07-13T11:00:00.000Z",
    sourceAgeSec: 12,
    maxAgeSec: 180,
    stale: false,
    issues: [],
    rankings: [{
      symbol: "ABC",
      rank: 2,
      setupScore: 81,
      compositeConfidence: 0.84,
      qualityOverall: 0.91,
      reason: ["Strong multi-factor setup"],
    }],
  });

  assert.equal(out.version, VERSION);
  assert.equal(out.candidates[0].rankingConnected, true);
  assert.equal(out.candidates[0].rankingRank, 2);
  assert.equal(out.candidates[0].rankingSetupScore, 81);
  assert.equal(out.candidates[0].rankingConfidence, 0.84);
  assert.equal(out.candidates[0].rankingQuality, 0.91);
  assert.deepEqual(out.candidates[0].rankingReasons, ["Strong multi-factor setup"]);
  assert.equal(out.candidates[0].sourceStale, false);
  assert.equal(out.candidates[0].resultState, "WAIT");
  assert.equal(out.candidates[0].orderPlacementAllowed, false);
});

test("stale ranking root explicitly blocks every candidate", () => {
  const out = bridgeCustomerZeroFreshRankings({
    candidates: [{
      symbol: "OLD",
      price: 3.1,
      decision: "ENTER",
      tradeAllowed: true,
      sourceStale: false,
    }],
  }, {
    sourceTs: "2026-07-13T10:00:00.000Z",
    sourceAgeSec: 999,
    maxAgeSec: 180,
    stale: true,
    issues: ["SCANNER_TELEMETRY_STALE"],
    rankings: [{
      symbol: "OLD",
      rank: 1,
      setupScore: 90,
      compositeConfidence: 0.95,
    }],
  });

  assert.equal(out.candidates[0].sourceStale, true);
  assert.equal(out.candidates[0].resultState, "STALE_DATA");
  assert.deepEqual(out.candidates[0].staleReasons, ["RANKINGS_STALE"]);
  assert.equal(out.rankingBridge.stale, true);
  assert.equal(out.rankingBridge.executionAllowed, false);
});

test("missing symbol ranking fails closed as stale data", () => {
  const out = bridgeCustomerZeroFreshRankings(
    {
      candidates: [{
        symbol: "MISS",
        decision: "ENTER",
        tradeAllowed: true,
        sourceStale: false,
      }],
    },
    {
      sourceAgeSec: 5,
      maxAgeSec: 180,
      stale: false,
      rankings: [{ symbol: "OTHER", setupScore: 77 }],
    }
  );

  assert.equal(out.candidates[0].rankingConnected, false);
  assert.equal(out.candidates[0].sourceStale, true);
  assert.equal(out.candidates[0].resultState, "STALE_DATA");
  assert.deepEqual(out.candidates[0].staleReasons, ["RANKING_MISSING"]);
});

test("quote staleness remains blocking when rankings are fresh", () => {
  const out = bridgeCustomerZeroFreshRankings(
    {
      candidates: [{
        symbol: "QUOTE",
        decision: "WAIT",
        sourceStale: true,
      }],
    },
    {
      sourceAgeSec: 4,
      maxAgeSec: 180,
      stale: false,
      rankings: [{ symbol: "QUOTE", setupScore: 66 }],
    }
  );

  assert.equal(out.candidates[0].resultState, "STALE_DATA");
  assert.deepEqual(out.candidates[0].staleReasons, ["QUOTE_STALE"]);
});


test("runtime health degradation fails every customer candidate closed as stale data", () => {
  const out = bridgeCustomerZeroFreshRankings(
    {
      candidates: [{
        symbol: "SAFE",
        sourceStale: false,
        decision: "ENTER",
        permission: "APPROVED",
      }],
    },
    {
      stale: false,
      sourceTs: "2026-07-28T05:00:00.000Z",
      sourceAgeSec: 1,
      maxAgeSec: 180,
      rankings: [{
        symbol: "SAFE",
        rank: 1,
        setupScore: 95,
        compositeConfidence: 0.95,
        qualityOverall: 0.95,
      }],
    },
    {
      marketClockStale: true,
      streamStale: true,
      marketOpen: true,
      streamConnected: false,
    }
  );

  assert.deepEqual(out.runtimeHealth, {
    degraded: true,
    issues: ["MARKET_CLOCK_STALE", "STREAM_STALE", "STREAM_DISCONNECTED"],
    readOnly: true,
    executionAllowed: false,
  });
  assert.equal(out.candidates[0].sourceStale, true);
  assert.equal(out.candidates[0].resultState, "STALE_DATA");
  assert.deepEqual(out.candidates[0].staleReasons, [
    "MARKET_CLOCK_STALE",
    "STREAM_STALE",
    "STREAM_DISCONNECTED",
  ]);
  assert.equal(out.candidates[0].orderPlacementAllowed, false);
  assert.equal(out.candidates[0].accountMutationAllowed, false);
});

test("fresh closed-session runtime health preserves eligible customer candidate state", () => {
  const out = bridgeCustomerZeroFreshRankings(
    {
      candidates: [{
        symbol: "SAFE",
        sourceStale: false,
        decision: "ENTER",
        permission: "APPROVED",
      }],
    },
    {
      stale: false,
      rankings: [{ symbol: "SAFE", rank: 1, compositeConfidence: 0.9 }],
    },
    {
      marketClockStale: false,
      streamStale: false,
      marketOpen: false,
      streamConnected: false,
    }
  );

  assert.deepEqual(out.runtimeHealth.issues, []);
  assert.equal(out.runtimeHealth.degraded, false);
  assert.equal(out.candidates[0].sourceStale, false);
  assert.equal(out.candidates[0].resultState, "ENTER");
});
