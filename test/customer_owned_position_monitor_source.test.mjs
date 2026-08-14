import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchCustomerOwnedPositionMonitorSource,
} from "../src/scanner/customer_owned_position_monitor_source.mjs";

test("does not fetch when there are no owned positions", async () => {
  let calls = 0;
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount: { positions: [] },
    fetchSymbols: async () => {
      calls += 1;
      return { candidates: [] };
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.status, "no_owned_positions");
  assert.deepEqual(result.candidates, []);
  assert.equal(result.orderPlacementAllowed, false);
});

test("fetches owned symbols without a price ceiling", async () => {
  let options = null;
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount: {
      positions: [{ symbol: "spy", qty: 1, currentPrice: 740 }],
    },
    fetchSymbols: async (input) => {
      options = input;
      return {
        ok: true,
        status: "connected_readonly",
        candidates: [{
          symbol: "SPY",
          price: 740,
          resultState: "EXIT",
          readonlyPotentialScore: 91,
        }],
      };
    },
  });

  assert.deepEqual(options.symbols, ["SPY"]);
  assert.equal(options.maxPrice, Number.POSITIVE_INFINITY);
  assert.equal(options.minDailyVolume, 0);
  assert.equal(result.status, "owned_positions_covered");
  assert.equal(result.candidates[0].symbol, "SPY");
  assert.equal(result.candidates[0].resultState, "EXIT");
  assert.equal(result.candidates[0].sourceCoverage, "owned_position_symbol_fetch");
  assert.equal(result.candidates[0].orderPlacementAllowed, false);
});

test("keeps every owned symbol visible with a safe WATCH fallback", async () => {
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount: {
      positions: [
        { symbol: "SPY", qty: 1, currentPrice: 739.85 },
        { symbol: "QQQ", qty: 2, currentPrice: 610 },
      ],
    },
    fetchSymbols: async () => ({
      ok: true,
      status: "connected_readonly",
      candidates: [{ symbol: "SPY", price: 739.85, resultState: "WATCH" }],
    }),
  });

  assert.equal(result.status, "owned_positions_partially_covered");
  assert.deepEqual(result.missingSymbols, ["QQQ"]);
  assert.deepEqual(result.candidates.map((row) => row.symbol), ["SPY", "QQQ"]);
  assert.equal(result.candidates[1].resultState, "WATCH");
  assert.equal(result.candidates[1].sourceCoverage, "owned_position_fallback");
  assert.deepEqual(result.candidates[1].sourceFlags, ["owned_position_market_candidate_missing"]);
  assert.equal(result.accountMutationAllowed, false);
});

test("dashboard integration can route an independently sourced owned EXIT", async () => {
  const { buildCustomerZeroUnderFiveDashboard } = await import(
    "../src/scanner/customer_under_five_dashboard.mjs"
  );
  const dashboard = buildCustomerZeroUnderFiveDashboard(
    {
      ok: true,
      candidates: [{ symbol: "NEW", price: 4, resultState: "ENTER" }],
      marketClock: { isOpen: true },
    },
    {
      maxPrice: 5,
      paperAccount: {
        connected: true,
        accountHealthy: true,
        positions: [{ symbol: "SPY", qty: 1, averageEntryPrice: 749.19 }],
        account: { equity: 100000, buyingPower: 300000 },
      },
      ownedPositionCandidates: [{
        symbol: "SPY",
        price: 740,
        resultState: "EXIT",
        readonlyPotentialScore: 91,
        ownedPositionMonitorOnly: true,
      }],
      now: new Date("2026-07-29T15:00:00.000Z"),
    },
  );

  assert.deepEqual(dashboard.candidates.map((row) => row.symbol), ["NEW"]);
  assert.deepEqual(dashboard.positionAlerts.map((row) => row.symbol), ["SPY"]);
  assert.equal(dashboard.positionAlerts[0].priority, "highest");
  assert.equal(dashboard.positionAlerts[0].orderPlacementAllowed, false);
});

test("applies the owned-position EXIT review policy before routing", async () => {
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount: {
      positions: [{
        symbol: "LOSS", qty: 1, averageEntryPrice: 100,
        currentPrice: 96, unrealizedPlpc: -0.04,
      }],
    },
    fetchSymbols: async () => ({
      ok: true,
      status: "connected_readonly",
      candidates: [{
        symbol: "LOSS", price: 96, changePct: -0.2, sourceStale: false,
        readonlyPotentialScore: 70, resultState: "WAIT", decision: "WAIT",
      }],
    }),
  });
  assert.equal(result.candidates[0].resultState, "EXIT");
  assert.equal(result.candidates[0].ownedExitReviewTriggered, true);
  assert.equal(result.candidates[0].automaticExitAllowed, false);
  assert.equal(result.candidates[0].orderPlacementAllowed, false);
});

test("applies production-shaped scale-in review policy before routing", async () => {
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount: {
      positions: [{
        symbol: "GAIN", qty: 2, averageEntryPrice: 100,
        currentPrice: 102, unrealizedPlpc: 0.02,
      }],
    },
    fetchSymbols: async () => ({
      ok: true,
      status: "connected_readonly",
      candidates: [{
        symbol: "GAIN",
        price: 102,
        changePct: 0.8,
        sourceAgeSec: 5,
        maxSourceAgeSec: 120,
        sourceStale: false,
        readonlyPotentialScore: 82,
        readonlyPotentialFlags: [],
        resultState: "ENTER",
        decision: "ENTER",
      }],
    }),
  });

  const candidate = result.candidates[0];
  assert.equal(candidate.resultState, "ENTER");
  assert.equal(candidate.decision, "ENTER");
  assert.equal(candidate.ownedScaleInReviewTriggered, true);
  assert.equal(candidate.ownedScaleInReviewReason, "OWNED_POSITION_CONFIRMED_STRENGTH_REVIEW");
  assert.equal(candidate.ownedReturnPct, 2);
  assert.equal(candidate.automaticScaleInAllowed, false);
  assert.equal(candidate.brokerContactAllowed, false);
  assert.equal(candidate.orderPlacementAllowed, false);
  assert.equal(candidate.accountMutationAllowed, false);
});

test("applies production-shaped scale-out review policy before routing", async () => {
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount:{positions:[{symbol:"WIN",qty:8,averageEntryPrice:100,currentPrice:103,unrealizedPlpc:0.03}]},
    fetchSymbols:async()=>({ok:true,status:"connected_readonly",candidates:[{symbol:"WIN",price:103,changePct:-0.4,sourceStale:false,sourceAgeSec:15,maxSourceAgeSec:120,readonlyPotentialScore:62,readonlyPotentialFlags:["negative_momentum"],resultState:"WATCH",decision:"WATCH"}]}),
  });
  const candidate=result.candidates[0];
  assert.equal(candidate.ownedScaleOutReviewTriggered,true);
  assert.equal(candidate.ownedScaleOutReviewReason,"OWNED_POSITION_PROFIT_PROTECTION_REVIEW");
  assert.equal(candidate.ownedScaleOutSuggestedQty,2);
  assert.equal(candidate.orderPlacementAllowed,false);
});


test("normalizes an owned non-actionable market decision to WATCH monitoring", async () => {
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount: {
      positions: [{
        symbol: "SPY",
        qty: 1,
        averageEntryPrice: 749.19,
        currentPrice: 732.9,
        unrealizedPlpc: -0.02174,
      }],
    },
    fetchSymbols: async () => ({
      ok: true,
      status: "connected_readonly",
      candidates: [{
        symbol: "SPY",
        price: 728,
        changePct: -1.7272,
        readonlyPotentialScore: 39,
        readonlyPotentialFlags: ["negative_momentum", "stale_source"],
        sourceAgeSec: 50000,
        maxSourceAgeSec: 120,
        sourceStale: true,
        resultState: "DO_NOT_ENTER",
        decision: "DO_NOT_ENTER",
      }],
    }),
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].resultState, "WATCH");
  assert.equal(result.candidates[0].decision, "WATCH");
  assert.equal(result.candidates[0].ownedPositionAssessment, "WATCH");
  assert.equal(result.candidates[0].ownedExitReviewTriggered, false);
  assert.equal(result.candidates[0].ownedScaleOutReviewTriggered, false);
  assert.equal(result.candidates[0].ownedScaleInReviewTriggered, false);
  assert.equal(result.candidates[0].orderPlacementAllowed, false);
});


test("owned monitor surfaces profitable single-share weakening as full EXIT for automatic exit worker", async () => {
  const result = await fetchCustomerOwnedPositionMonitorSource({
    paperAccount: {
      positions: [{
        symbol: "ONE",
        qty: 1,
        averageEntryPrice: 100,
        currentPrice: 105,
        unrealizedPlpc: 0.05,
      }],
    },
    fetchSymbols: async () => ({
      ok: true,
      status: "connected_readonly",
      candidates: [{
        symbol: "ONE",
        price: 105,
        changePct: -0.4,
        sourceStale: false,
        sourceAgeSec: 5,
        maxSourceAgeSec: 120,
        readonlyPotentialScore: 62,
        readonlyPotentialFlags: ["negative_momentum"],
        resultState: "WAIT",
        decision: "WAIT",
      }],
    }),
  });
  const candidate = result.candidates[0];
  assert.equal(candidate.resultState, "EXIT");
  assert.equal(candidate.decision, "EXIT");
  assert.equal(candidate.ownedExitReviewTriggered, true);
  assert.equal(candidate.ownedExitReviewReason, "OWNED_POSITION_SINGLE_SHARE_PROFIT_PROTECTION_EXIT");
  assert.equal(candidate.ownedScaleOutReviewTriggered, false);
  assert.equal(candidate.orderPlacementAllowed, false);
});
