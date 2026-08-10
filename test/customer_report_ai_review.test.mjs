import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerReportAiReviewInput,
  buildDeterministicLogicProposals,
} from "../src/scanner/customer_report_ai_review.mjs";

test("builds bounded read-only report review input", () => {
  const input = buildCustomerReportAiReviewInput({
    period: "weekly",
    stale: false,
    performance: { totalPl: 120, totalReturnPct: 1.2 },
    trades: { totalTrades: 8, winRatePct: 37.5 },
    scanner: { signalsGenerated: 20, blocked: 9, averageConfidence: 0.55 },
  });
  assert.equal(input.period, "weekly");
  assert.equal(input.safety.automaticLogicMutationAllowed, false);
  assert.equal(input.safety.orderPlacementAllowed, false);
  assert.equal(input.scanner.doNotEnter, 0);
  assert.deepEqual(input.activity, []);
  assert.equal(input.completeness.activityCount, 0);
});

test("creates proposals without mutating scanner logic", () => {
  const review = buildDeterministicLogicProposals({
    period: "weekly",
    stale: true,
    sourceTs: "2026-07-15T12:00:00Z",
    performance: { maxDrawdown: 800, startingBalance: 10000 },
    trades: {
      totalTrades: 10,
      winRatePct: 30,
      averageGain: 50,
      averageLoss: -90,
    },
    scanner: {
      signalsGenerated: 20,
      blocked: 10,
      stale: 2,
      averageConfidence: 0.5,
    },
  });
  assert.equal(review.automaticLogicMutationAllowed, false);
  assert.equal(review.requiresBacktest, true);
  assert.equal(review.requiresOperatorApproval, false);
  assert.equal(review.generatedAt, "2026-07-15T12:00:00Z");
  assert.ok(review.proposals.some((proposal) => proposal.id === "drawdown_risk_review"));
  assert.ok(review.proposals.length >= 5);
  assert.ok(review.proposals.every((proposal) => proposal.suggestedPatch === null));
});


test("includes bounded report evidence for missing-information review", () => {
  const input = buildCustomerReportAiReviewInput({
    period: "daily",
    sourceTs: "2026-07-15T20:00:00Z",
    sourceAgeSec: 15,
    maxAgeSec: 120,
    paperRecordCount: 3,
    trades: { averageHoldTime: null },
    scanner: { signalsGenerated: 2, doNotEnter: 1 },
    activity: Array.from({ length: 30 }, (_, index) => ({
      symbol: "T" + index,
      qty: index + 1,
      avgEntryPrice: 10 + index,
      costBasis: 100 + index,
      realizedPnl: index - 5,
      lastFillPrice: 11 + index,
      lastUpdatedAt: "2026-07-15T20:00:00Z",
      fillCount: 1,
      secret: "must-not-pass",
    })),
    largestWinners: [{ symbol: "WIN", realizedPnl: 50, secret: "omit" }],
    largestLosers: [{ symbol: "LOSS", realizedPnl: -20, secret: "omit" }],
    equityCurve: Array.from({ length: 60 }, (_, index) => ({
      timestamp: "2026-07-15T20:" + String(index).padStart(2, "0") + ":00Z",
      equity: 1000 + index,
    })),
  });

  assert.equal(input.activity.length, 25);
  assert.equal(input.activity[0].symbol, "T0");
  assert.equal("secret" in input.activity[0], false);
  assert.equal(input.largestWinners[0].symbol, "WIN");
  assert.equal(input.largestLosers[0].symbol, "LOSS");
  assert.equal(input.equityCurve.length, 50);
  assert.equal(input.completeness.paperRecordCount, 3);
  assert.equal(input.completeness.activityCount, 30);
  assert.equal(input.completeness.equityPointCount, 60);
  assert.equal(input.completeness.equityAvailablePointCount, 60);
  assert.equal(input.completeness.averageHoldTimeAvailable, false);
  assert.equal(input.dataSemantics.lastFillPrice.includes("not a current market quote"), true);
  assert.equal(input.dataSemantics.totalTrades.includes("Legacy alias"), true);
  assert.equal(input.dataSemantics.tradesWithRealizedPnl.includes("non-zero realized P/L delta"), true);
  assert.equal(input.dataSemantics.equityCurve.includes("null means unavailable"), true);
  assert.equal(input.scanner.doNotEnter, 1);
});

test("marks unavailable equity evidence without converting null to zero", () => {
  const input = buildCustomerReportAiReviewInput({
    equityCurve: [
      { timestamp: "2026-07-01T00:00:00Z", equity: null },
      { timestamp: "2026-07-02T00:00:00Z" },
    ],
  });

  assert.deepEqual(input.equityCurve.map((row) => row.equity), [null, null]);
  assert.equal(input.completeness.equityPointCount, 2);
  assert.equal(input.completeness.equityAvailablePointCount, 0);
});

test("broker-backed AI semantics do not describe excluded snapshot evidence as active report data", () => {
  const input = buildCustomerReportAiReviewInput({
    freshnessSource: "alpaca_paper_readonly_observation",
    paperRecordCount: 0,
    activity: [],
    equityCurve: [],
    trades: {
      lifecycleSourceAvailable: true,
      tradesWithRealizedPnl: 1,
      completedRoundTrips: 1,
    },
  });
  assert.match(input.dataSemantics.activity, /excluded from broker-backed reports/);
  assert.match(input.dataSemantics.totalTrades, /broker-confirmed Alpaca PAPER filled-order history/);
  assert.match(input.dataSemantics.historicalSimulatedOpenPositions, /broker-confirmed Alpaca PAPER filled-order history/);
  assert.doesNotMatch(input.dataSemantics.historicalSimulatedOpenPositions, /local simulated fill ledger/);
  assert.match(input.dataSemantics.tradesWithRealizedPnl, /broker-confirmed completed Alpaca PAPER round trips/);
  assert.match(input.dataSemantics.completedRoundTrips, /broker-confirmed Alpaca PAPER filled-order history/);
  assert.match(input.dataSemantics.equityCurve, /Historical equity points are unavailable/);
});
test("broker-backed low-win-rate proposal uses broker-confirmed lifecycle wording", () => {
  const review = buildDeterministicLogicProposals({
    freshnessSource: "alpaca_paper_readonly_observation",
    stale: false,
    performance: {},
    trades: {
      lifecycleSourceAvailable: true,
      totalTrades: 5,
      winRatePct: 20,
      averageGain: 1,
      averageLoss: -1,
    },
    scanner: {},
  });
  const proposal = review.proposals.find((item) => item.id === "raise_entry_quality_review");
  assert.ok(proposal);
  assert.match(proposal.observation, /broker-confirmed Alpaca PAPER completed round trips/);
  assert.doesNotMatch(proposal.observation, /completed fill-ledger round trips/);
});
