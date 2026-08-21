import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_RANKING_CONFIDENCE,
  MIN_RANKING_QUALITY,
  MIN_RANKING_SETUP_SCORE,
  MAX_ENTRY_PRICE,
  getPaperAutoExecutionStrategyAuthorizationPolicy,
  authorizePaperAutoExecutionCandidate,
} from "../src/scanner/paper_auto_execution_strategy_authorization.mjs";

function qualified(overrides = {}) {
  return {
    symbol: "ABC",
    state: "ENTER",
    sourceStale: false,
    blockingFlags: [],
    staleReasons: [],
    rankingConnected: true,
    rankingP3GateOk: true,
    rankingSetupScore: 82,
    rankingConfidence: 0.8,
    rankingQuality: 0.9,
    price: 4,
    ...overrides,
  };
}

test("exposes canonical read-only strategy authorization policy from the deterministic source of truth", () => {
  const policy = getPaperAutoExecutionStrategyAuthorizationPolicy();
  assert.equal(policy.version, "paper_auto_execution_strategy_authorization_v1");
  assert.equal(policy.requiredState, "ENTER");
  assert.equal(policy.maximumEntryPrice, MAX_ENTRY_PRICE);
  assert.deepEqual(policy.minimums, {
    setupScore: MIN_RANKING_SETUP_SCORE,
    rankingConfidence: MIN_RANKING_CONFIDENCE,
    rankingQuality: MIN_RANKING_QUALITY,
  });
  assert.equal(policy.rankingConnectedRequired, true);
  assert.equal(policy.p3GateRequired, true);
  assert.equal(policy.freshSourceRequired, true);
  assert.equal(policy.blockersAbsentRequired, true);
  assert.equal(policy.symbolLevelOnly, true);
  assert.equal(policy.portfolioRootAuthorizationUsed, false);
  assert.equal(policy.paperOnly, true);
  assert.equal(policy.executionAuthority, "deterministic_strategy_authorization");
  assert.equal(policy.aiAuthorizationAllowed, false);
  assert.equal(policy.aiOverrideAllowed, false);
  assert.equal(policy.thresholdMutationAllowed, false);
  assert.equal(policy.rankingSizingAuthoritative, false);
  assert.equal(policy.aiSizingOverrideAllowed, false);
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(policy.minimums), true);
});

test("authorizes only a fresh ENTER candidate with complete qualified symbol-level ranking evidence", () => {
  const out = authorizePaperAutoExecutionCandidate(qualified());
  assert.equal(out.authorized, true);
  assert.deepEqual(out.blockers, []);
  assert.equal(out.symbolLevelOnly, true);
  assert.equal(out.portfolioRootAuthorizationUsed, false);
  assert.equal(out.paperOnly, true);
});

test("fails closed when result state is not ENTER", () => {
  const out = authorizePaperAutoExecutionCandidate(qualified({ state: "WAIT" }));
  assert.equal(out.authorized, false);
  assert.ok(out.blockers.includes("STRATEGY_STATE_NOT_ENTER"));
});

test("fails closed for stale, blocked, missing ranking, or failed P3 evidence", () => {
  const stale = authorizePaperAutoExecutionCandidate(qualified({
    sourceStale: true,
    staleReasons: ["RANKINGS_STALE"],
  }));
  assert.equal(stale.authorized, false);
  assert.ok(stale.blockers.includes("STRATEGY_SOURCE_STALE"));
  assert.ok(stale.blockers.includes("RANKINGS_STALE"));

  const blocked = authorizePaperAutoExecutionCandidate(qualified({
    blockingFlags: ["wide_spread"],
  }));
  assert.equal(blocked.authorized, false);
  assert.ok(blocked.blockers.includes("wide_spread"));

  const missing = authorizePaperAutoExecutionCandidate(qualified({
    rankingConnected: false,
  }));
  assert.equal(missing.authorized, false);
  assert.ok(missing.blockers.includes("STRATEGY_RANKING_NOT_CONNECTED"));

  const p3 = authorizePaperAutoExecutionCandidate(qualified({
    rankingP3GateOk: false,
  }));
  assert.equal(p3.authorized, false);
  assert.ok(p3.blockers.includes("STRATEGY_P3_GATE_NOT_OK"));
});

test("fails closed below exact ranking minimums and permits exact boundary values", () => {
  const lowScore = authorizePaperAutoExecutionCandidate(qualified({
    rankingSetupScore: MIN_RANKING_SETUP_SCORE - 0.01,
  }));
  assert.equal(lowScore.authorized, false);
  assert.ok(lowScore.blockers.includes("STRATEGY_SETUP_SCORE_BELOW_MINIMUM"));

  const lowConfidence = authorizePaperAutoExecutionCandidate(qualified({
    rankingConfidence: MIN_RANKING_CONFIDENCE - 0.01,
  }));
  assert.equal(lowConfidence.authorized, false);
  assert.ok(lowConfidence.blockers.includes("STRATEGY_RANKING_CONFIDENCE_BELOW_MINIMUM"));

  const lowQuality = authorizePaperAutoExecutionCandidate(qualified({
    rankingQuality: MIN_RANKING_QUALITY - 0.01,
  }));
  assert.equal(lowQuality.authorized, false);
  assert.ok(lowQuality.blockers.includes("STRATEGY_RANKING_QUALITY_BELOW_MINIMUM"));

  const boundary = authorizePaperAutoExecutionCandidate(qualified({
    rankingSetupScore: MIN_RANKING_SETUP_SCORE,
    rankingConfidence: MIN_RANKING_CONFIDENCE,
    rankingQuality: MIN_RANKING_QUALITY,
  }));
  assert.equal(boundary.authorized, true);
});

test("fails closed when required ranking metrics are absent or non-finite", () => {
  const out = authorizePaperAutoExecutionCandidate(qualified({
    rankingSetupScore: null,
    rankingConfidence: undefined,
    rankingQuality: "not-a-number",
  }));
  assert.equal(out.authorized, false);
  assert.ok(out.blockers.includes("STRATEGY_SETUP_SCORE_REQUIRED"));
  assert.ok(out.blockers.includes("STRATEGY_RANKING_CONFIDENCE_REQUIRED"));
  assert.ok(out.blockers.includes("STRATEGY_RANKING_QUALITY_REQUIRED"));
});

test("fails closed above the under-five automatic entry ceiling and permits exactly five dollars", () => {
  const above = authorizePaperAutoExecutionCandidate(qualified({
    price: MAX_ENTRY_PRICE + 0.01,
  }));
  assert.equal(above.authorized, false);
  assert.ok(above.blockers.includes("STRATEGY_ENTRY_PRICE_ABOVE_MAXIMUM"));

  const boundary = authorizePaperAutoExecutionCandidate(qualified({
    price: MAX_ENTRY_PRICE,
  }));
  assert.equal(boundary.authorized, true);
});

test("fails closed when automatic entry price is missing or non-finite", () => {
  for (const price of [null, undefined, "not-a-number"]) {
    const out = authorizePaperAutoExecutionCandidate(qualified({ price }));
    assert.equal(out.authorized, false);
    assert.ok(out.blockers.includes("STRATEGY_ENTRY_PRICE_REQUIRED"));
  }
});
