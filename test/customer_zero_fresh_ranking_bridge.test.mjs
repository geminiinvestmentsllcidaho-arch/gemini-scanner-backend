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
      rankings: [{
        symbol: "SAFE",
        rank: 1,
        setupScore: 90,
        compositeConfidence: 0.9,
        qualityOverall: 0.9,
        p3GateOk: true,
      }],
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


test("bridges symbol-level ranking authorization evidence without enabling execution", () => {
  const out = bridgeCustomerZeroFreshRankings(
    {
      candidates: [{
        symbol: "AUTH",
        decision: "ENTER",
        sourceStale: false,
        blockingFlags: [],
      }],
    },
    {
      sourceTs: "2026-08-15T18:00:00.000Z",
      sourceAgeSec: 5,
      maxAgeSec: 180,
      stale: false,
      issues: [],
      rankings: [{
        symbol: "AUTH",
        rank: 1,
        setupScore: 88,
        normalizedScore: 1,
        compositeConfidence: 0.91,
        qualityOverall: 0.93,
        p3GateOk: true,
        qualityTier: "high",
        confidenceTier: "high",
        deploymentPriority: "high",
        targetPositionPct: 0.06,
        maxPositionPct: 0.09,
        reason: ["valid P3 gate"],
      }],
    },
    {
      streamConnected: true,
      marketClockStale: false,
      streamStale: false,
      marketOpen: true,
    }
  );

  const candidate = out.candidates[0];
  assert.equal(candidate.rankingConnected, true);
  assert.equal(candidate.rankingSetupScore, 88);
  assert.equal(candidate.rankingNormalizedScore, 1);
  assert.equal(candidate.rankingConfidence, 0.91);
  assert.equal(candidate.rankingQuality, 0.93);
  assert.equal(candidate.rankingP3GateOk, true);
  assert.equal(candidate.rankingQualityTier, "high");
  assert.equal(candidate.rankingConfidenceTier, "high");
  assert.equal(candidate.rankingDeploymentPriority, "high");
  assert.equal(candidate.rankingTargetPositionPct, 0.06);
  assert.equal(candidate.rankingMaxPositionPct, 0.09);
  assert.equal(candidate.decisionAssistOnly, true);
  assert.equal(candidate.orderPlacementAllowed, false);
  assert.equal(candidate.accountMutationAllowed, false);
});


test("canonical strategy authorization controls visible ENTER while preserving manual evidence", () => {
  const baseSource = {
    candidates: [{
      symbol: "ALIGN",
      decision: "ENTER",
      sourceStale: false,
      blockingFlags: [],
      briefExplanation: "Manual potential logic produced ENTER.",
    }],
  };
  const telemetry = {
    streamConnected: true,
    marketClockStale: false,
    streamStale: false,
    marketOpen: true,
  };
  const rankingRoot = (overrides = {}) => ({
    sourceTs: "2026-08-20T18:30:00.000Z",
    sourceAgeSec: 1,
    maxAgeSec: 180,
    stale: false,
    issues: [],
    rankings: [{
      symbol: "ALIGN",
      rank: 1,
      setupScore: 90,
      compositeConfidence: 0.9,
      qualityOverall: 0.9,
      p3GateOk: true,
      ...overrides,
    }],
  });

  for (const [overrides, blocker] of [
    [{ p3GateOk: false }, "STRATEGY_P3_GATE_NOT_OK"],
    [{ setupScore: 69.99 }, "STRATEGY_SETUP_SCORE_BELOW_MINIMUM"],
    [{ compositeConfidence: 0.49 }, "STRATEGY_RANKING_CONFIDENCE_BELOW_MINIMUM"],
    [{ qualityOverall: 0.64 }, "STRATEGY_RANKING_QUALITY_BELOW_MINIMUM"],
  ]) {
    const candidate = bridgeCustomerZeroFreshRankings(baseSource, rankingRoot(overrides), telemetry).candidates[0];
    assert.equal(candidate.manualDecision, "ENTER");
    assert.equal(candidate.manualResultState, "ENTER");
    assert.equal(candidate.resultState, "BLOCKED");
    assert.equal(candidate.strategyAuthorization.authorized, false);
    assert.ok(candidate.canonicalAuthorizationBlockers.includes(blocker));
  }

  const authorized = bridgeCustomerZeroFreshRankings(baseSource, rankingRoot(), telemetry).candidates[0];
  assert.equal(authorized.manualResultState, "ENTER");
  assert.equal(authorized.resultState, "ENTER");
  assert.equal(authorized.strategyAuthorization.authorized, true);
  assert.deepEqual(authorized.canonicalAuthorizationBlockers, []);
});
