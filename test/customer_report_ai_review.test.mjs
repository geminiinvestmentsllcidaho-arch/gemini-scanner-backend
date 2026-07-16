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
  assert.equal(review.requiresOperatorApproval, true);
  assert.equal(review.generatedAt, "2026-07-15T12:00:00Z");
  assert.ok(review.proposals.some((proposal) => proposal.id === "drawdown_risk_review"));
  assert.ok(review.proposals.length >= 5);
  assert.ok(review.proposals.every((proposal) => proposal.suggestedPatch === null));
});
