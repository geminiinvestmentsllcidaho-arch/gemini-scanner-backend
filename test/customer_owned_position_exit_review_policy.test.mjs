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

test("uses fresh owned-position return for early-loss review independent of previous-close day change", () => {
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
  assert.equal(confirmed.ownedExitReviewReason, "OWNED_POSITION_EARLY_LOSS_REVIEW");
  const stale = applyOwnedPositionExitReviewPolicy({ ...base, sourceStale: true }, position);
  assert.equal(stale.resultState, "WAIT");
  assert.equal(stale.ownedExitReviewTriggered, false);

  const extendedWinnerFromPriorClose = applyOwnedPositionExitReviewPolicy({
    ...base,
    symbol: "LATE",
    changePct: 12,
    readonlyPotentialScore: 95,
    readonlyPotentialFlags: [],
  }, {
    symbol: "LATE", averageEntryPrice: 100, currentPrice: 98.4, unrealizedPlpc: -0.016,
  });
  assert.equal(extendedWinnerFromPriorClose.resultState, "EXIT");
  assert.equal(extendedWinnerFromPriorClose.ownedExitReviewReason, "OWNED_POSITION_EARLY_LOSS_REVIEW");

  const justAboveBoundary = applyOwnedPositionExitReviewPolicy({
    ...base,
    symbol: "BOUNDARY",
    changePct: -5,
    readonlyPotentialScore: 20,
    readonlyPotentialFlags: ["negative_momentum"],
  }, {
    symbol: "BOUNDARY", averageEntryPrice: 100, currentPrice: 98.51, unrealizedPlpc: -0.0149,
  });
  assert.equal(justAboveBoundary.ownedExitReviewTriggered, false);

  const exactBoundary = applyOwnedPositionExitReviewPolicy({
    ...base,
    symbol: "EXACT",
    changePct: 8,
    readonlyPotentialScore: 99,
    readonlyPotentialFlags: [],
  }, {
    symbol: "EXACT", averageEntryPrice: 100, currentPrice: 98.5, unrealizedPlpc: -0.015,
  });
  assert.equal(exactBoundary.ownedExitReviewTriggered, true);
  assert.equal(exactBoundary.ownedExitReviewReason, "OWNED_POSITION_EARLY_LOSS_REVIEW");
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

test("converts severe profitable multi-share weakening into full EXIT", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "RISK",
    price: 105,
    changePct: -1.2,
    sourceStale: false,
    sourceAgeSec: 8,
    maxSourceAgeSec: 120,
    readonlyPotentialScore: 45,
    readonlyPotentialFlags: ["negative_momentum"],
    resultState: "WATCH",
    decision: "WATCH",
  }, {
    symbol: "RISK",
    qty: 8,
    averageEntryPrice: 100,
    currentPrice: 105,
    unrealizedPlpc: 0.05,
  });
  assert.equal(result.resultState, "EXIT");
  assert.equal(result.decision, "EXIT");
  assert.equal(result.ownedExitReviewTriggered, true);
  assert.equal(result.ownedExitReviewReason, "OWNED_POSITION_MULTI_SHARE_PROFIT_PROTECTION_EXIT");
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

test("fresh global capital invalidation requires full EXIT with deterministic precedence", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "CAP", price: 100, sourceStale: false, resultState: "WATCH", decision: "WATCH",
    capitalProtectionFresh: true, capitalProtectionStale: false,
    capitalInvalidationState: "hard_stop",
    capitalDrawdownBrakeState: "hard_brake",
    capitalExitRouteState: "forced_exit_route",
    capitalProtectionCommandState: "protect_now",
    capitalProtectionPermission: "exit_required",
  }, { symbol: "CAP", qty: 1, averageEntryPrice: 100, currentPrice: 100 });
  assert.equal(result.resultState, "EXIT");
  assert.equal(result.decision, "EXIT");
  assert.equal(result.ownedExitReviewTriggered, true);
  assert.equal(result.ownedExitReviewReason, "CAPITAL_INVALIDATION_EXIT_REQUIRED");
});

test("fresh hard capital protection requires full EXIT without hard invalidation", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "BRAKE", price: 100, sourceStale: false, resultState: "WATCH", decision: "WATCH",
    capitalProtectionFresh: true, capitalProtectionStale: false,
    capitalInvalidationState: "managed",
    capitalDrawdownBrakeState: "hard_brake",
    capitalExitRouteState: "forced_exit_route",
    capitalProtectionCommandState: "protect_now",
    capitalProtectionPermission: "exit_required",
  }, { symbol: "BRAKE", qty: 2, averageEntryPrice: 100, currentPrice: 100 });
  assert.equal(result.resultState, "EXIT");
  assert.equal(result.ownedExitReviewReason, "CAPITAL_PROTECTION_EXIT_REQUIRED");
});

test("stale capital protection evidence cannot force full EXIT", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "STALECAP", price: 100, sourceStale: false, resultState: "WATCH", decision: "WATCH",
    capitalProtectionFresh: false, capitalProtectionStale: true,
    capitalInvalidationState: "hard_stop",
    capitalDrawdownBrakeState: "hard_brake",
    capitalExitRouteState: "forced_exit_route",
    capitalProtectionCommandState: "protect_now",
    capitalProtectionPermission: "exit_required",
  }, { symbol: "STALECAP", qty: 1, averageEntryPrice: 100, currentPrice: 100 });
  assert.equal(result.ownedExitReviewTriggered, false);
  assert.equal(result.ownedExitReviewReason, null);
});

test("soft capital protection remains non-full-exit", () => {
  const result = applyOwnedPositionExitReviewPolicy({
    symbol: "SOFT", price: 100, sourceStale: false, resultState: "WATCH", decision: "WATCH",
    capitalProtectionFresh: true, capitalProtectionStale: false,
    capitalInvalidationState: "tight_stop",
    capitalDrawdownBrakeState: "soft_brake",
    capitalExitRouteState: "staged_exit_route",
    capitalProtectionCommandState: "protective_reduce",
    capitalProtectionPermission: "reduction_preferred",
  }, { symbol: "SOFT", qty: 8, averageEntryPrice: 100, currentPrice: 100 });
  assert.equal(result.ownedExitReviewTriggered, false);
  assert.equal(result.ownedExitReviewReason, null);
});
