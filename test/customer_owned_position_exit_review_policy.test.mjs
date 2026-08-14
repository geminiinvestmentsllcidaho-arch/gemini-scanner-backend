import test from "node:test";
import assert from "node:assert/strict";
import { applyOwnedPositionExitReviewPolicy } from "../src/scanner/customer_owned_position_exit_review_policy.mjs";

test("keeps the current SPY-like drawdown in monitored WAIT", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "SPY", price: 739.05, changePct: -0.2356, sourceStale: false,
    sourceAgeSec: 0, maxSourceAgeSec: 120, readonlyPotentialScore: 64.95,
    readonlyPotentialFlags: ["negative_momentum"], resultState: "WAIT", decision: "WAIT",
  }, {
    symbol: "SPY", averageEntryPrice: 749.19, currentPrice: 739.02, unrealizedPlpc: -0.01357,
  });
  assert.equal(result.resultState, "WAIT");
  assert.equal(result.ownedExitReviewTriggered, false);
  assert.equal(result.automaticExitAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});

test("surfaces a hard-loss owned position as EXIT review without execution", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "LOSS", price: 96, changePct: -0.2, sourceStale: false,
    readonlyPotentialScore: 70, resultState: "WAIT", decision: "WAIT",
  }, {
    symbol: "LOSS", averageEntryPrice: 100, currentPrice: 96, unrealizedPlpc: -0.04,
  });
  assert.equal(result.resultState, "EXIT");
  assert.equal(result.ownedExitReviewTriggered, true);
  assert.equal(result.ownedExitReviewReason, "OWNED_POSITION_HARD_LOSS_REVIEW");
  assert.equal(result.automaticExitAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});

test("requires fresh multi-factor confirmation for tighter deterioration review", () => {
  const base = {
    symbol: "WEAK", price: 98.2, changePct: -0.8, sourceStale: false,
    readonlyPotentialScore: 55, readonlyPotentialFlags: ["negative_momentum"],
    resultState: "WAIT", decision: "WAIT",
  };
  const position = {
    symbol: "WEAK", averageEntryPrice: 100, currentPrice: 98.2, unrealizedPlpc: -0.018,
  };
  const confirmed = applyOwnedPositionExitReviewPolicy(base, position);
  assert.equal(confirmed.resultState, "EXIT");
  assert.equal(confirmed.ownedExitReviewReason, "OWNED_POSITION_CONFIRMED_DETERIORATION_REVIEW");
  const stale = applyOwnedPositionExitReviewPolicy({ ...base, sourceStale: true }, position);
  assert.equal(stale.resultState, "WAIT");
  assert.equal(stale.ownedExitReviewTriggered, false);
});


test("converts fresh profitable weakening into full EXIT for an exact single-share owned position", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "WIN",
    price: 105,
    changePct: -0.4,
    sourceStale: false,
    sourceAgeSec: 8,
    maxSourceAgeSec: 120,
    readonlyPotentialScore: 62,
    readonlyPotentialFlags: ["negative_momentum"],
    resultState: "WATCH",
    decision: "WATCH",
  }, {
    symbol: "WIN",
    qty: 1,
    averageEntryPrice: 100,
    currentPrice: 105,
    unrealizedPlpc: 0.05,
  });
  assert.equal(result.resultState, "EXIT");
  assert.equal(result.decision, "EXIT");
  assert.equal(result.ownedExitReviewTriggered, true);
  assert.equal(result.ownedExitReviewReason, "OWNED_POSITION_SINGLE_SHARE_PROFIT_PROTECTION_EXIT");
});

test("does not full-exit a profitable single share while momentum remains positive", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "RUN",
    price: 109,
    changePct: 4.5,
    sourceStale: false,
    sourceAgeSec: 4,
    maxSourceAgeSec: 120,
    readonlyPotentialScore: 69,
    readonlyPotentialFlags: ["lower_dollar_volume"],
    resultState: "WATCH",
    decision: "WATCH",
  }, {
    symbol: "RUN",
    qty: 1,
    averageEntryPrice: 100,
    currentPrice: 109,
    unrealizedPlpc: 0.09,
  });
  assert.equal(result.ownedExitReviewTriggered, false);
  assert.equal(result.ownedExitReviewReason, null);
});

test("keeps profitable multi-share weakening in partial scale-out review path instead of full EXIT", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "TRIM",
    price: 105,
    changePct: -0.4,
    sourceStale: false,
    sourceAgeSec: 8,
    maxSourceAgeSec: 120,
    readonlyPotentialScore: 62,
    readonlyPotentialFlags: ["negative_momentum"],
    resultState: "WATCH",
    decision: "WATCH",
  }, {
    symbol: "TRIM",
    qty: 8,
    averageEntryPrice: 100,
    currentPrice: 105,
    unrealizedPlpc: 0.05,
  });
  assert.equal(result.ownedExitReviewTriggered, false);
  assert.equal(result.ownedExitReviewReason, null);
});

test("stale profitable single-share evidence cannot trigger profit-protection EXIT", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "STALE",
    price: 105,
    changePct: -1,
    sourceStale: true,
    sourceAgeSec: 300,
    maxSourceAgeSec: 120,
    readonlyPotentialScore: 50,
    readonlyPotentialFlags: ["negative_momentum", "stale_source"],
    resultState: "WATCH",
    decision: "WATCH",
  }, {
    symbol: "STALE",
    qty: 1,
    averageEntryPrice: 100,
    currentPrice: 105,
    unrealizedPlpc: 0.05,
  });
  assert.equal(result.ownedExitReviewTriggered, false);
});
