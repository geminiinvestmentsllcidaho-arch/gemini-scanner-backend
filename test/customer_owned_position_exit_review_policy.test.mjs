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
