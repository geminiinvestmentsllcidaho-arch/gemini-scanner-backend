import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyNextDayWatchSetup,
  classifyOvernightHoldAssessment,
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


test("classifies overnight suitability, elevated risk, and do-not-carry states", () => {
  const now = new Date("2026-07-17T21:00:00.000Z");
  const base = {
    symbol: "NITE",
    averageEntryPrice: 100,
    currentPrice: 103,
    sourceTimestamp: "2026-07-17T20:59:00.000Z",
    allocationPct: 10,
    spreadPct: 0.4,
    afterHoursChangePct: 0.8,
    relativeVolume: 2,
    dollarVolume: 5000000,
    catalystKnown: true,
  };

  const suitable = classifyOvernightHoldAssessment(base, { now });
  assert.equal(suitable.state, "SUITABLE_FOR_OVERNIGHT_REVIEW");
  assert.equal(suitable.nextSessionConfirmationRequired, true);

  const elevated = classifyOvernightHoldAssessment({
    ...base,
    catalystKnown: false,
    relativeVolume: 5,
  }, { now });
  assert.equal(elevated.state, "ELEVATED_OVERNIGHT_RISK");

  const doNotCarry = classifyOvernightHoldAssessment({
    ...base,
    afterHoursChangePct: -6,
  }, { now });
  assert.equal(doNotCarry.state, "DO_NOT_CARRY_WITHOUT_REVIEW");
});

test("overnight assessment fails closed on incomplete or stale evidence", () => {
  const now = new Date("2026-07-17T21:00:00.000Z");

  const incomplete = classifyOvernightHoldAssessment({
    symbol: "MISS",
    averageEntryPrice: 100,
    currentPrice: 101,
    sourceTimestamp: "2026-07-17T20:59:00.000Z",
  }, { now });
  assert.equal(incomplete.state, "INSUFFICIENT_DATA");

  const stale = classifyOvernightHoldAssessment({
    symbol: "OLD",
    averageEntryPrice: 100,
    currentPrice: 101,
    sourceTimestamp: "2026-07-17T20:00:00.000Z",
    relativeVolume: 2,
    dollarVolume: 5000000,
    catalystKnown: true,
  }, { now, maxFreshSec: 900 });
  assert.equal(stale.state, "INSUFFICIENT_DATA");
  assert.equal(stale.orderPlacementAllowed, false);
  assert.equal(stale.accountMutationAllowed, false);
});


test("classifies next-day continuation, pullback, breakout-confirmation, and gap-risk watches", () => {
  const now = new Date("2026-07-17T21:00:00.000Z");
  const base = {
    symbol: "NEXT",
    closePrice: 20,
    afterHoursPrice: 20.4,
    sourceTimestamp: "2026-07-17T20:59:00.000Z",
    dayChangePct: 3,
    relativeVolume: 2,
    spreadPct: 0.4,
    dollarVolume: 5000000,
    trendIntact: true,
  };

  assert.equal(classifyNextDayWatchSetup(base, { now }).state, "CONTINUATION_WATCH");
  assert.equal(classifyNextDayWatchSetup({
    ...base,
    afterHoursPrice: 19.8,
    pulledBackFromHigh: true,
  }, { now }).state, "PULLBACK_WATCH");
  assert.equal(classifyNextDayWatchSetup({
    ...base,
    nearBreakout: true,
  }, { now }).state, "BREAKOUT_CONFIRMATION_REQUIRED");
  assert.equal(classifyNextDayWatchSetup({
    ...base,
    afterHoursPrice: 21,
  }, { now }).state, "GAP_RISK_WATCH");
});

test("next-day watchlist fails closed and never emits an enter recommendation", () => {
  const now = new Date("2026-07-17T21:00:00.000Z");

  const stale = classifyNextDayWatchSetup({
    symbol: "OLD",
    closePrice: 10,
    afterHoursPrice: 10.1,
    sourceTimestamp: "2026-07-17T20:00:00.000Z",
    dayChangePct: 2,
    relativeVolume: 2,
    spreadPct: 0.5,
    dollarVolume: 3000000,
    trendIntact: true,
  }, { now, maxFreshSec: 900 });

  assert.equal(stale.state, "AVOID_WATCH_ONLY");
  assert.equal(stale.enterRecommendationAllowed, false);
  assert.equal(stale.orderPlacementAllowed, false);
  assert.equal(stale.accountMutationAllowed, false);
  assert.equal(stale.nextSessionConfirmationRequired, true);

  const none = classifyNextDayWatchSetup({
    symbol: "FLAT",
    closePrice: 10,
    afterHoursPrice: 10,
    sourceTimestamp: "2026-07-17T20:59:00.000Z",
    dayChangePct: -1,
    relativeVolume: 1,
    spreadPct: 0.5,
    dollarVolume: 3000000,
    trendIntact: false,
  }, { now });

  assert.equal(none.state, "NO_NEXT_DAY_SETUP");
  assert.equal(none.regularSessionConfirmationAllowed, false);
});
