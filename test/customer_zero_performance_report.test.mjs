import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerZeroPerformanceReport } from "../src/scanner/customer_zero_performance_report.mjs";

test("builds read-only Customer Zero performance totals from paper sources", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "weekly",
    now: new Date("2026-07-13T13:01:00.000Z"),
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


test("normalizes supported periods and calculates equity drawdown from paper sources", () => {
  for (const period of ["daily", "weekly", "monthly", "yearly", "ytd", "lifetime"]) {
    const report = buildCustomerZeroPerformanceReport({
      period,
      sourceTs: "2026-07-13T14:30:00.000Z",
      startingEquity: 1000,
      peakEquity: 1200,
      paperAccount: {
        account: { equity: 1100 },
        summary: { totalUnrealizedPl: 25 },
      },
      paperLedger: { totalRealizedPnl: 75 },
    });

    assert.equal(report.period, period);
    assert.equal(report.startingEquity, 1000);
    assert.equal(report.endingEquity, 1100);
    assert.equal(report.peakEquity, 1200);
    assert.equal(report.drawdown, 100);
    assert.equal(report.drawdownPct, 8.33);
    assert.equal(report.orderPlacementAllowed, false);
  }

  const fallback = buildCustomerZeroPerformanceReport({ period: "invalid" });
  assert.equal(fallback.period, "daily");
});


test("filters cumulative paper position snapshots into selected performance period", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "weekly",
    now: new Date("2026-07-15T12:00:00.000Z"),
    sourceTs: "2026-07-15T11:00:00.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 5 } },
    paperLedgerHistory: [
      { createdAt: "2026-07-12T12:00:00.000Z", totalRealizedPnl: 10, endingEquity: 1010 },
      { createdAt: "2026-07-13T12:00:00.000Z", totalRealizedPnl: 20, endingEquity: 1020 },
      { createdAt: "2026-07-15T11:00:00.000Z", totalRealizedPnl: 50, endingEquity: 1050 },
    ],
  });

  assert.equal(report.periodRecordCount, 2);
  assert.equal(report.periodStartTs, "2026-07-13T12:00:00.000Z");
  assert.equal(report.periodEndTs, "2026-07-15T11:00:00.000Z");
  assert.equal(report.realizedPl, 40);
  assert.equal(report.unrealizedPl, 5);
  assert.equal(report.totalPl, 45);
  assert.equal(report.startingEquity, 1010);
  assert.equal(report.endingEquity, 1050);
  assert.equal(report.orderPlacementAllowed, false);
});


test("performance report marks aged position snapshots stale deterministically", () => {
  const current = buildCustomerZeroPerformanceReport({
    now: new Date("2026-07-13T16:52:10.000Z"),
    sourceTs: "2026-07-13T16:51:10.000Z",
    maxAgeSec: 120,
    paperLedger: {},
  });
  assert.equal(current.sourceAgeSec, 60);
  assert.equal(current.maxAgeSec, 120);
  assert.equal(current.stale, false);
  assert.equal(current.status, "current_readonly");

  const stale = buildCustomerZeroPerformanceReport({
    now: new Date("2026-07-13T16:54:11.000Z"),
    sourceTs: "2026-07-13T16:51:10.000Z",
    maxAgeSec: 120,
    paperLedger: {},
  });
  assert.equal(stale.sourceAgeSec, 181);
  assert.equal(stale.maxAgeSec, 120);
  assert.equal(stale.stale, true);
  assert.equal(stale.status, "stale_readonly");
  assert.equal(stale.orderPlacementAllowed, false);
});

test("performance report uses saved customer timezone for daily period boundary", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "daily",
    now: new Date("2026-07-14T22:30:00.000Z"),
    timeZone: "America/Denver",
    sourceTs: "2026-07-14T22:29:00.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 0 } },
    paperLedgerHistory: [
      { createdAt: "2026-07-14T05:59:00.000Z", totalRealizedPnl: 10, endingEquity: 1010 },
      { createdAt: "2026-07-14T06:00:00.000Z", totalRealizedPnl: 20, endingEquity: 1020 },
      { createdAt: "2026-07-14T22:29:00.000Z", totalRealizedPnl: 50, endingEquity: 1050 },
    ],
  });

  assert.equal(report.period, "daily");
  assert.deepEqual(report.periodRange, {
    startIso: "2026-07-14T06:00:00.000Z",
    endIso: "2026-07-14T22:30:00.000Z",
    timeZone: "America/Denver",
    weekStartsOn: 1,
  });
  assert.equal(report.periodRecordCount, 2);
  assert.equal(report.realizedPl, 40);
  assert.equal(report.startingEquity, 1010);
  assert.equal(report.endingEquity, 1050);
});

test("performance report can default to lifetime without fabricating a lower boundary", () => {
  const report = buildCustomerZeroPerformanceReport({
    defaultPeriod: "lifetime",
    now: new Date("2026-07-14T22:30:00.000Z"),
    timeZone: "America/Denver",
    sourceTs: "2026-07-14T22:29:00.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 0 } },
    paperLedgerHistory: [
      { createdAt: "2025-12-31T23:00:00.000Z", totalRealizedPnl: 10, endingEquity: 1010 },
      { createdAt: "2026-07-14T22:29:00.000Z", totalRealizedPnl: 50, endingEquity: 1050 },
    ],
  });

  assert.equal(report.period, "lifetime");
  assert.equal(report.periodRange.startIso, null);
  assert.equal(report.periodRecordCount, 2);
  assert.equal(report.realizedPl, 50);
  assert.equal(report.orderPlacementAllowed, false);
});


test("broker-backed performance uses completed Alpaca PAPER round trips and ignores legacy snapshots", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "weekly",
    now: new Date("2026-08-09T22:00:00.000Z"),
    brokerObservationTs: "2026-08-09T21:59:30.000Z",
    paperAccount: { account: { equity: 10025 }, summary: { totalUnrealizedPl: 5 } },
    paperLedger: { totalRealizedPnl: 9999, totalFees: 12, totalSlippage: 8, startingEquity: 1, peakEquity: 99999 },
    paperLedgerHistory: [{ createdAt: "2026-08-09T21:59:00.000Z", totalRealizedPnl: 9999, endingEquity: 99999 }],
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistoryCompleteness: { historyComplete: true, historyPossiblyTruncated: false },
    fillLedgerHistory: [
      { fillId: "b1", symbol: "AAPL", side: "buy", qty: 2, fillPrice: 100, createdAt: "2026-08-09T20:00:00.000Z" },
      { fillId: "s1", symbol: "AAPL", side: "sell", qty: 2, fillPrice: 104, createdAt: "2026-08-09T21:00:00.000Z" },
      { fillId: "b2", symbol: "MSFT", side: "buy", qty: 1, fillPrice: 200, createdAt: "2026-08-09T21:10:00.000Z" },
      { fillId: "s2", symbol: "MSFT", side: "sell", qty: 1, fillPrice: 197, createdAt: "2026-08-09T21:20:00.000Z" },
    ],
  });
  assert.equal(report.realizedPl, 5);
  assert.equal(report.unrealizedPl, 5);
  assert.equal(report.totalPl, 10);
  assert.equal(report.winners, 1);
  assert.equal(report.losers, 1);
  assert.equal(report.closedTrades, 2);
  assert.equal(report.winRatePct, 50);
  assert.equal(report.largestGain, 8);
  assert.equal(report.largestLoss, -3);
  assert.equal(report.sourceTs, "2026-08-09T21:59:30.000Z");
  assert.equal(report.sourceAgeSec, 30);
  assert.equal(report.freshnessSource, "alpaca_paper_readonly_observation");
  assert.equal(report.performanceSource, "alpaca_paper_order_history");
  assert.equal(report.startingEquity, null);
  assert.equal(report.endingEquity, 10025);
  assert.equal(report.peakEquity, null);
  assert.equal(report.drawdown, null);
  assert.equal(report.drawdownPct, null);
  assert.equal(report.totalReturnPct, null);
  assert.equal(report.fees, 0.03);
  assert.equal(report.slippage, null);
  assert.equal(report.netAfterCosts, 9.97);
  assert.equal(report.feeModel, "ALPACA_LIVE_EQUIVALENT_REGULATORY_FEES");
  assert.equal(report.feeScheduleId, "alpaca_brokerage_fee_schedule_2026_07_20");
  assert.equal(report.feeEstimationOnly, true);
  assert.equal(report.paperBrokerActualFees, false);
  assert.equal(report.brokerHistoryComplete, true);
});

test("broker-backed lifetime performance applies live-equivalent fees to BTG across separate trading days", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "lifetime",
    now: new Date("2026-08-13T16:00:00.000Z"),
    brokerObservationTs: "2026-08-13T15:59:30.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 0 } },
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [
      { symbol: "BTG", side: "buy", qty: 1, fillPrice: 4.12, createdAt: "2026-08-05T19:29:04.466729Z" },
      { symbol: "BTG", side: "sell", qty: 1, fillPrice: 5.21, createdAt: "2026-08-12T19:11:56.07754Z" },
    ],
  });
  assert.equal(report.realizedPl, 1.09);
  assert.equal(report.fees, 0.04);
  assert.equal(report.netAfterCosts, 1.05);
  assert.equal(report.feeEstimationOnly, true);
  assert.equal(report.paperBrokerActualFees, false);
  assert.equal(report.orderPlacementAllowed, false);
});

test("broker-backed performance attributes realized P/L to completed trades closed inside the selected period", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "daily",
    now: new Date("2026-08-09T22:00:00.000Z"),
    timeZone: "UTC",
    brokerObservationTs: "2026-08-09T21:59:00.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 0 } },
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [
      { symbol: "OLD", side: "buy", qty: 1, fillPrice: 10, createdAt: "2026-08-08T20:00:00.000Z" },
      { symbol: "OLD", side: "sell", qty: 1, fillPrice: 20, createdAt: "2026-08-08T21:00:00.000Z" },
      { symbol: "NEW", side: "buy", qty: 1, fillPrice: 30, createdAt: "2026-08-08T23:00:00.000Z" },
      { symbol: "NEW", side: "sell", qty: 1, fillPrice: 34, createdAt: "2026-08-09T01:00:00.000Z" },
    ],
  });
  assert.equal(report.realizedPl, 4);
  assert.equal(report.closedTrades, 1);
  assert.equal(report.winners, 1);
  assert.equal(report.periodRecordCount, 1);
  assert.equal(report.periodStartTs, "2026-08-09T01:00:00.000Z");
  assert.equal(report.periodEndTs, "2026-08-09T01:00:00.000Z");
});


test("performance epoch excludes pre-reset completed trades and fees while preserving full fill history for reconstruction", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "lifetime",
    now: new Date("2026-08-17T15:00:00.000Z"),
    brokerObservationTs: "2026-08-17T14:59:30.000Z",
    performanceEpochStartedAt: "2026-08-17T13:45:01.000Z",
    paperAccount: { account: { equity: 10000 }, summary: { totalUnrealizedPl: 0 } },
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistoryCompleteness: { historyComplete: true, historyPossiblyTruncated: false },
    fillLedgerHistory: [
      { symbol: "SPY", side: "buy", qty: 1, fillPrice: 749.19, createdAt: "2026-07-01T14:00:00.000Z" },
      { symbol: "SPY", side: "sell", qty: 1, fillPrice: 745.02, createdAt: "2026-07-31T14:00:00.000Z" },
      { symbol: "BTG", side: "buy", qty: 1, fillPrice: 4.12, createdAt: "2026-08-05T19:29:04.466Z" },
      { symbol: "BTG", side: "sell", qty: 1, fillPrice: 5.21, createdAt: "2026-08-12T19:11:56.077Z" },
      { symbol: "NEW", side: "buy", qty: 2, fillPrice: 10, createdAt: "2026-08-17T14:00:00.000Z" },
      { symbol: "NEW", side: "sell", qty: 2, fillPrice: 11, createdAt: "2026-08-17T14:30:00.000Z" },
    ],
  });
  assert.equal(report.performanceEpochActive, true);
  assert.equal(report.performanceEpochStartedAt, "2026-08-17T13:45:01.000Z");
  assert.equal(report.periodRange.startIso, "2026-08-17T13:45:01.000Z");
  assert.equal(report.closedTrades, 1);
  assert.equal(report.winners, 1);
  assert.equal(report.losers, 0);
  assert.equal(report.realizedPl, 2);
});

test("performance epoch intersects a narrower requested report period instead of widening it", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "daily",
    timeZone: "UTC",
    now: new Date("2026-08-18T12:00:00.000Z"),
    brokerObservationTs: "2026-08-18T11:59:30.000Z",
    performanceEpochStartedAt: "2026-08-17T13:45:01.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 0 } },
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [],
  });
  assert.equal(report.periodRange.startIso, "2026-08-18T00:00:00.000Z");
  assert.equal(report.performanceEpochActive, true);
});

test("future performance epoch cannot invert the customer-zero report range", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "lifetime",
    now: new Date("2026-08-15T23:08:00.000Z"),
    timeZone: "America/Denver",
    brokerObservationTs: "2026-08-15T23:07:30.000Z",
    performanceEpochStartedAt: "2026-08-16T23:08:00.000Z",
    paperAccount: { account: { equity: 10000 }, summary: { totalUnrealizedPl: 0 } },
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [],
  });
  assert.equal(report.performanceEpochActive, false);
  assert.equal(report.performanceEpochStartedAt, null);
  assert.equal(report.periodRange.startIso, null);
  assert.equal(report.periodRange.endIso, "2026-08-15T23:08:00.000Z");
});
