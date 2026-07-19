import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPostMarketPositionRisk,
  postMarketSession,
} from "../src/scanner/post_market_position_review.mjs";

test("detects bounded weekday post-market session in Eastern Time", () => {
  const active = postMarketSession(new Date("2026-07-17T20:30:00.000Z"));
  assert.equal(active.session, "post_market");
  assert.equal(active.active, true);
  assert.equal(active.regularSessionConfirmationAllowed, false);

  const regularClose = postMarketSession(new Date("2026-07-17T20:04:00.000Z"));
  assert.equal(regularClose.active, false);

  const weekend = postMarketSession(new Date("2026-07-18T21:00:00.000Z"));
  assert.equal(weekend.active, false);
});

test("classifies healthy, caution, reduce-risk, and exit-review states deterministically", () => {
  const now = new Date("2026-07-17T21:00:00.000Z");
  const base = {
    symbol: "TEST",
    averageEntryPrice: 100,
    currentPrice: 102,
    sourceTimestamp: "2026-07-17T20:58:00.000Z",
    allocationPct: 10,
    spreadPct: 0.4,
    afterHoursChangePct: 0.5,
  };

  assert.equal(classifyPostMarketPositionRisk(base, { now }).state, "POSITION_HEALTHY");
  assert.equal(classifyPostMarketPositionRisk({ ...base, currentPrice: 99 }, { now }).state, "HOLD_WITH_CAUTION");
  assert.equal(classifyPostMarketPositionRisk({ ...base, currentPrice: 95 }, { now }).state, "REDUCE_RISK_REVIEW");
  assert.equal(classifyPostMarketPositionRisk({ ...base, currentPrice: 90 }, { now }).state, "EXIT_REVIEW_REQUIRED");
});

test("fails closed on stale or unavailable evidence", () => {
  const now = new Date("2026-07-17T21:00:00.000Z");
  const stale = classifyPostMarketPositionRisk({
    symbol: "STALE",
    averageEntryPrice: 100,
    currentPrice: 98,
    sourceTimestamp: "2026-07-17T20:00:00.000Z",
  }, { now, maxFreshSec: 900 });

  assert.equal(stale.state, "DATA_STALE");
  assert.equal(stale.orderPlacementAllowed, false);
  assert.equal(stale.accountMutationAllowed, false);

  const unavailable = classifyPostMarketPositionRisk({
    symbol: "NONE",
    sourceTimestamp: "2026-07-17T20:59:00.000Z",
  }, { now });

  assert.equal(unavailable.state, "REVIEW_UNAVAILABLE");
  assert.equal(unavailable.regularSessionConfirmationAllowed, false);
});

test("normalizes Alpaca decimal unrealized percentage without permitting execution", () => {
  const result = classifyPostMarketPositionRisk({
    symbol: "ALP",
    averageEntryPrice: 100,
    currentPrice: 96,
    unrealizedPlpc: -0.04,
    sourceTimestamp: "2026-07-17T20:59:00.000Z",
  }, { now: new Date("2026-07-17T21:00:00.000Z") });

  assert.equal(result.metrics.unrealizedPlPct, -4);
  assert.equal(result.state, "REDUCE_RISK_REVIEW");
  assert.equal(result.reviewOnly, true);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});
