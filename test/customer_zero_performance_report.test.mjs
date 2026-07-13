import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerZeroPerformanceReport } from "../src/scanner/customer_zero_performance_report.mjs";

test("builds read-only Customer Zero performance totals from paper sources", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "weekly",
    sourceTs: "2026-07-13T13:00:00.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 12.34 } },
    paperLedger: { totalRealizedPnl: -2.34 },
  });
  assert.equal(report.period, "weekly");
  assert.equal(report.realizedPl, -2.34);
  assert.equal(report.unrealizedPl, 12.34);
  assert.equal(report.totalPl, 10);
  assert.equal(report.tone, "positive");
  assert.equal(report.stale, false);
  assert.equal(report.scannerEstimateUsed, false);
  assert.equal(report.orderPlacementAllowed, false);
});

test("missing timestamp fails closed as stale and neutral zero", () => {
  const report = buildCustomerZeroPerformanceReport();
  assert.equal(report.totalPl, 0);
  assert.equal(report.tone, "neutral");
  assert.equal(report.stale, true);
  assert.equal(report.status, "stale_readonly");
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});


test("calculates winner loser gain loss and cost statistics from paper ledger positions", () => {
  const report = buildCustomerZeroPerformanceReport({
    sourceTs: "2026-07-13T14:00:00.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 5 } },
    paperLedger: {
      totalRealizedPnl: 20,
      totalFees: 2.5,
      totalSlippage: 1.5,
      positions: [
        { symbol: "AAA", realizedPnl: 30 },
        { symbol: "BBB", realizedPnl: -10 },
        { symbol: "CCC", realizedPnl: 0 },
      ],
    },
  });

  assert.equal(report.winners, 1);
  assert.equal(report.losers, 1);
  assert.equal(report.closedTrades, 2);
  assert.equal(report.winRatePct, 50);
  assert.equal(report.averageGain, 30);
  assert.equal(report.averageLoss, -10);
  assert.equal(report.largestGain, 30);
  assert.equal(report.largestLoss, -10);
  assert.equal(report.fees, 2.5);
  assert.equal(report.slippage, 1.5);
  assert.equal(report.netAfterCosts, 21);
  assert.equal(report.orderPlacementAllowed, false);
});
