import test from "node:test";
import assert from "node:assert/strict";

import { buildCustomerReportModel } from "../src/scanner/customer_report_model.mjs";

const now = new Date("2026-07-15T04:00:00.000Z");

test("builds lifetime read-only report scanner summary from in-range events", () => {
  const report = buildCustomerReportModel({
    period: "lifetime",
    now,
    timeZone: "America/Denver",
    maxAgeSec: 86400,
    paperLedgerHistory: [
      {
        createdAt: "2026-07-15T03:59:00.000Z",
        totalRealizedPnl: 25,
        totalCostBasis: 500,
        endingEquity: 1025,
        positions: [],
      },
    ],
    scannerEvents: [
      {
        createdAt: "2026-07-15T03:00:00.000Z",
        resultState: "ENTER",
        rankingConfidence: 80,
        readonlyPotentialScore: 90,
        realizedPnl: 12,
      },
      {
        createdAt: "2026-07-15T03:30:00.000Z",
        resultState: "WAIT",
        rankingConfidence: 60,
        readonlyPotentialScore: 70,
        realizedPnl: -2,
      },
    ],
  });

  assert.equal(report.period, "lifetime");
  assert.equal(report.paperRecordCount, 1);
  assert.equal(report.scanner.signalsGenerated, 2);
  assert.equal(report.scanner.enter, 1);
  assert.equal(report.scanner.wait, 1);
  assert.equal(report.scanner.averageConfidence, 70);
  assert.equal(report.scanner.averagePotentialScore, 80);
  assert.equal(report.scanner.profitableSignals, 1);
  assert.equal(report.scanner.failedSignals, 1);
  assert.equal(report.stale, false);
  assert.equal(report.readOnly, true);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.aiReview.automaticLogicMutationAllowed, false);
  assert.equal(report.aiReview.requiresBacktest, true);
  assert.equal(report.aiReview.requiresOperatorApproval, false);
  assert.ok(Array.isArray(report.aiReview.proposals));
});

test("filters scanner events using saved timezone daily boundary", () => {
  const report = buildCustomerReportModel({
    period: "daily",
    now,
    timeZone: "America/Denver",
    maxAgeSec: 86400,
    paperLedgerHistory: [
      {
        createdAt: "2026-07-15T03:59:00.000Z",
        totalRealizedPnl: 0,
        endingEquity: 1000,
        positions: [],
      },
    ],
    scannerEvents: [
      { createdAt: "2026-07-14T05:59:59.999Z", resultState: "BLOCKED" },
      { createdAt: "2026-07-14T06:00:00.000Z", resultState: "ENTER", tradeAllowed: true },
      { createdAt: "2026-07-15T03:59:59.999Z", resultState: "STALE_DATA" },
    ],
  });

  assert.equal(report.range.startIso, "2026-07-14T06:00:00.000Z");
  assert.equal(report.scanner.signalsGenerated, 2);
  assert.equal(report.scanner.enter, 1);
  assert.equal(report.scanner.blocked, 0);
  assert.equal(report.scanner.stale, 1);
});

test("fails closed when paper ledger source is missing", () => {
  const report = buildCustomerReportModel({
    now,
    timeZone: "America/Denver",
  });

  assert.equal(report.period, "lifetime");
  assert.equal(report.paperRecordCount, 0);
  assert.equal(report.stale, true);
  assert.equal(report.status, "stale_readonly");
  assert.equal(report.sourceTs, null);
  assert.equal(report.scanner.signalsGenerated, 0);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.liveTradingAllowed, false);
});


test("calculates report performance trade and activity metrics from cumulative paper snapshots", () => {
  const report = buildCustomerReportModel({
    period: "daily",
    now,
    timeZone: "America/Denver",
    maxAgeSec: 86400,
    paperAccount: {
      account: { equity: 1110 },
      summary: { totalUnrealizedPl: 10 },
    },
    paperLedgerHistory: [
      {
        createdAt: "2026-07-14T05:59:59.000Z",
        totalRealizedPnl: 20,
        totalCostBasis: 200,
        endingEquity: 1020,
        positions: [
          { symbol: "AAA", realizedPnl: 20, costBasis: 120 },
          { symbol: "BBB", realizedPnl: 0, costBasis: 80 },
        ],
      },
      {
        createdAt: "2026-07-14T06:30:00.000Z",
        totalRealizedPnl: 50,
        totalCostBasis: 300,
        endingEquity: 1070,
        positions: [
          { symbol: "AAA", realizedPnl: 60, costBasis: 180 },
          { symbol: "BBB", realizedPnl: -10, costBasis: 120 },
        ],
      },
      {
        createdAt: "2026-07-15T03:59:00.000Z",
        totalRealizedPnl: 100,
        totalCostBasis: 400,
        endingEquity: 1110,
        positions: [
          { symbol: "AAA", realizedPnl: 100, costBasis: 240 },
          { symbol: "BBB", realizedPnl: -20, costBasis: 160 },
        ],
      },
    ],
  });

  assert.equal(report.performance.startingBalance, 1020);
  assert.equal(report.performance.endingBalance, 1110);
  assert.equal(report.performance.realizedPl, 80);
  assert.equal(report.performance.unrealizedPl, 10);
  assert.equal(report.performance.totalPl, 90);
  assert.equal(report.performance.totalReturnPct, 8.82);
  assert.equal(report.performance.totalCapitalUsed, 400);
  assert.equal(report.performance.maxDrawdown, 0);
  assert.equal(report.trades.totalTrades, 2);
  assert.equal(report.trades.metricDefinition, "symbols_with_nonzero_realized_pnl_delta");
  assert.equal(report.trades.fillEventsObserved, 0);
  assert.equal(report.trades.winningTrades, 1);
  assert.equal(report.trades.losingTrades, 1);
  assert.equal(report.trades.winRatePct, 50);
  assert.equal(report.trades.averageGain, 80);
  assert.equal(report.trades.averageLoss, -20);
  assert.equal(report.trades.averageDollarsPerTrade, 200);
  assert.equal(report.trades.averageHoldTime, null);
  assert.equal(report.largestWinners[0].symbol, "AAA");
  assert.equal(report.largestLosers[0].symbol, "BBB");
  assert.equal(report.activity.length, 2);
  assert.equal(report.equityCurve.length, 2);
});


test("uses paper account equity and P/L for a non-fabricated fallback baseline", () => {
  const report = buildCustomerReportModel({
    period: "lifetime",
    now,
    timeZone: "America/Denver",
    maxAgeSec: 99999999,
    paperAccount: {
      account: { equity: 100005.81 },
      summary: { totalUnrealizedPl: 5.81 },
    },
    paperLedgerHistory: [
      {
        createdAt: "2026-07-01T15:40:23.808Z",
        totalCostBasis: 999.9,
        totalRealizedPnl: 0,
        positions: [
          { symbol: "SOFI", qty: 99, avgEntryPrice: 10.1, costBasis: 999.9, realizedPnl: 0, fillCount: 1 },
        ],
      },
      {
        createdAt: "2026-07-01T15:41:04.277Z",
        totalCostBasis: 1999.8,
        totalRealizedPnl: 0,
        positions: [
          { symbol: "SOFI", qty: 198, avgEntryPrice: 10.1, costBasis: 1999.8, realizedPnl: 0, fillCount: 2 },
        ],
      },
    ],
  });

  assert.equal(report.performance.startingBalance, 100000);
  assert.equal(report.performance.endingBalance, 100005.81);
  assert.equal(report.performance.totalPl, 5.81);
  assert.equal(report.performance.totalReturnPct, 0.01);
  assert.equal(report.trades.totalTrades, 0);
  assert.equal(report.trades.metricDefinition, "symbols_with_nonzero_realized_pnl_delta");
  assert.equal(report.trades.fillEventsObserved, 2);
  assert.deepEqual(report.equityCurve.map((point) => point.equity), [null, null]);
});


test("summarizes fresh live opportunity scan candidates by event timestamp", () => {
  const now = new Date("2026-07-17T19:00:00.000Z");
  const report = buildCustomerReportModel({
    period: "daily",
    now,
    timeZone: "America/Boise",
    scannerEvents: [
      {
        symbol: "ASTS",
        createdAt: "2026-07-17T18:51:20.643Z",
        resultState: "WAIT",
        readonlyPotentialScore: 99.91,
      },
      {
        symbol: "UVXY",
        createdAt: "2026-07-17T18:51:20.643Z",
        resultState: "DO_NOT_ENTER",
        readonlyPotentialScore: 99.8,
      },
    ],
  });

  assert.equal(report.scanner.signalsGenerated, 2);
  assert.equal(report.scanner.wait, 1);
  assert.equal(report.scanner.doNotEnter, 1);
  assert.equal(report.scanner.averagePotentialScore, 99.85);
  assert.equal(report.aiReview.input.scanner.signalsGenerated, 2);
  assert.equal(report.readOnly, true);
  assert.equal(report.orderPlacementAllowed, false);
});


test("reports explicit snapshot-derived realized outcome semantics", () => {
  const cases = [
    ["open multi-fill", { qty: 0, realizedPnl: 0, fillCount: 0 }, { qty: 20, realizedPnl: 0, fillCount: 2 }, 0],
    ["profitable close", { qty: 10, realizedPnl: 0, fillCount: 1 }, { qty: 0, realizedPnl: 25, fillCount: 2 }, 1],
    ["losing close", { qty: 10, realizedPnl: 0, fillCount: 1 }, { qty: 0, realizedPnl: -15, fillCount: 2 }, 1],
    ["break-even close", { qty: 10, realizedPnl: 0, fillCount: 1 }, { qty: 0, realizedPnl: 0, fillCount: 2 }, 0],
    ["partial close remains open", { qty: 20, realizedPnl: 0, fillCount: 2 }, { qty: 10, realizedPnl: 10, fillCount: 3 }, 1],
  ];

  for (const [name, before, after, expected] of cases) {
    const report = buildCustomerReportModel({
      period: "daily",
      now,
      timeZone: "America/Denver",
      maxAgeSec: 86400,
      paperLedgerHistory: [
        { createdAt: "2026-07-14T05:59:59.000Z", totalRealizedPnl: before.realizedPnl, positions: [{ symbol: "TEST", ...before }] },
        { createdAt: "2026-07-15T03:59:00.000Z", totalRealizedPnl: after.realizedPnl, positions: [{ symbol: "TEST", ...after }] },
      ],
    });
    assert.equal(report.trades.tradesWithRealizedPnl, expected, name);
    assert.equal(report.trades.totalTrades, expected, name);
    assert.equal(report.trades.fillEventsObserved, after.fillCount, name);
    assert.equal(report.trades.positionsOpened, null, name);
    assert.equal(report.trades.closedTrades, null, name);
    assert.equal(report.trades.completedRoundTrips, null, name);
  }
});

test("multiple round trips in one symbol are not fabricated from snapshots", () => {
  const report = buildCustomerReportModel({
    period: "daily",
    now,
    timeZone: "America/Denver",
    maxAgeSec: 86400,
    paperLedgerHistory: [
      { createdAt: "2026-07-14T05:59:59.000Z", totalRealizedPnl: 0, positions: [{ symbol: "AAA", qty: 0, realizedPnl: 0, fillCount: 0 }] },
      { createdAt: "2026-07-15T03:59:00.000Z", totalRealizedPnl: 12, positions: [{ symbol: "AAA", qty: 0, realizedPnl: 12, fillCount: 4 }] },
    ],
  });

  assert.equal(report.trades.tradesWithRealizedPnl, 1);
  assert.equal(report.trades.fillEventsObserved, 4);
  assert.equal(report.trades.completedRoundTrips, null);
});


test("uses fill-ledger lifecycle reconstruction for true completed trade metrics", () => {
  const report = buildCustomerReportModel({
    period: "month",
    now: new Date("2026-07-21T20:00:00.000Z"),
    timeZone: "UTC",
    paperLedgerHistory: [
      { createdAt: "2026-07-01T00:00:00.000Z", totalRealizedPnl: 0, positions: [] },
      { createdAt: "2026-07-21T19:00:00.000Z", totalRealizedPnl: 5, positions: [] },
    ],
    fillLedgerHistory: [
      { fillId: "a1", createdAt: "2026-07-02T14:00:00.000Z", symbol: "AAA", side: "buy", qty: 10, fillPrice: 10 },
      { fillId: "a2", createdAt: "2026-07-02T15:00:00.000Z", symbol: "AAA", side: "sell", qty: 10, fillPrice: 11 },
      { fillId: "b1", createdAt: "2026-07-03T14:00:00.000Z", symbol: "BBB", side: "buy", qty: 5, fillPrice: 20 },
      { fillId: "b2", createdAt: "2026-07-03T15:00:00.000Z", symbol: "BBB", side: "sell", qty: 5, fillPrice: 19 },
      { fillId: "c1", createdAt: "2026-07-04T14:00:00.000Z", symbol: "CCC", side: "buy", qty: 2, fillPrice: 30 },
      { fillId: "c2", createdAt: "2026-07-04T15:00:00.000Z", symbol: "CCC", side: "sell", qty: 2, fillPrice: 30 },
    ],
  });

  assert.equal(report.trades.lifecycleSourceAvailable, true);
  assert.equal(report.trades.metricDefinition, "completed_long_round_trips_reconstructed_from_fill_ledger");
  assert.equal(report.trades.totalTrades, 3);
  assert.equal(report.trades.completedRoundTrips, 3);
  assert.equal(report.trades.closedTrades, 3);
  assert.equal(report.trades.winningTrades, 1);
  assert.equal(report.trades.losingTrades, 1);
  assert.equal(report.trades.breakevenTrades, 1);
  assert.equal(report.trades.winRatePct, 50);
  assert.equal(report.trades.fillEventsObserved, 6);
  assert.equal(report.trades.positionsOpened, 3);
  assert.equal(report.trades.averageHoldTimeMs, 3600000);
  assert.equal(report.trades.averageHoldTime, 3600000);
  assert.equal(report.trades.averageDollarsPerTrade, 86.67);
  assert.equal(report.trades.completedTrades.length, 3);
});


test("exposes flag-only source-intent replay observability with fill-ledger lifecycle evidence", () => {
  const report = buildCustomerReportModel({
    period: "month",
    now: new Date("2026-07-21T20:00:00.000Z"),
    timeZone: "UTC",
    paperLedgerHistory: [
      { createdAt: "2026-07-21T19:00:00.000Z", totalRealizedPnl: 0, positions: [] },
    ],
    fillLedgerHistory: [
      {
        fillId: "fill-1",
        sourceTicketId: "ticket-1",
        sourceIntentId: "intent-1",
        createdAt: "2026-07-01T15:00:00.000Z",
        symbol: "SOFI",
        side: "buy",
        qty: 99,
        fillPrice: 10.1,
      },
      {
        fillId: "fill-2",
        sourceTicketId: "ticket-2",
        sourceIntentId: "intent-1",
        createdAt: "2026-07-01T15:03:00.000Z",
        symbol: "SOFI",
        side: "buy",
        qty: 99,
        fillPrice: 10.1,
      },
    ],
  });

  assert.equal(report.trades.sourceIntentReplayAuditAvailable, true);
  assert.equal(report.trades.sourceIntentReplayAudit.hasPossibleReplay, true);
  assert.equal(report.trades.sourceIntentReplayAudit.possibleReplayCount, 1);
  assert.deepEqual(
    report.trades.sourceIntentReplayAudit.affectedTicketIds,
    ["ticket-1", "ticket-2"],
  );
  assert.equal(report.trades.sourceIntentReplayAudit.recordsMutated, false);
  assert.equal(report.trades.sourceIntentReplayAudit.positionsAdjusted, false);
  assert.equal(report.trades.sourceIntentReplayAudit.orderPlacement, false);
  assert.equal(report.trades.openPositions[0].qty, 198);
});

test("preserves snapshot-derived compatibility metrics when fill ledger is not supplied", () => {
  const report = buildCustomerReportModel({
    period: "month",
    now: new Date("2026-07-21T20:00:00.000Z"),
    timeZone: "UTC",
    paperLedgerHistory: [
      { createdAt: "2026-07-01T00:00:00.000Z", totalRealizedPnl: 0, positions: [{ symbol: "AAA", qty: 10, realizedPnl: 0, fillCount: 1 }] },
      { createdAt: "2026-07-21T19:00:00.000Z", totalRealizedPnl: 5, positions: [{ symbol: "AAA", qty: 0, realizedPnl: 5, fillCount: 2 }] },
    ],
  });

  assert.equal(report.trades.lifecycleSourceAvailable, false);
  assert.equal(report.trades.sourceIntentReplayAuditAvailable, false);
  assert.equal(report.trades.sourceIntentReplayAudit, null);
  assert.equal(report.trades.metricDefinition, "symbols_with_nonzero_realized_pnl_delta");
  assert.equal(report.trades.tradesWithRealizedPnl, 1);
  assert.equal(report.trades.completedRoundTrips, null);
});


test("broker-backed period performance does not fabricate starting balance return or max drawdown from mixed sources", () => {
  const report = buildCustomerReportModel({
    period: "daily",
    now: new Date("2026-08-09T20:00:00Z"),
    timeZone: "UTC",
    paperAccount: {
      account: { equity: 100050 },
      summary: { totalUnrealizedPl: 25 },
      positions: [],
    },
    paperLedgerHistory: [
      { createdAt: "2026-08-09T10:00:00Z", endingEquity: 99900, totalRealizedPnl: 900, totalCostBasis: 500, positions: [] },
      { createdAt: "2026-08-09T19:00:00Z", endingEquity: 100000, totalRealizedPnl: 1000, totalCostBasis: 600, positions: [] },
    ],
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [
      { fillId: "buy-1", createdAt: "2026-08-09T14:00:00Z", symbol: "AAA", side: "buy", qty: 1, fillPrice: 100 },
      { fillId: "sell-1", createdAt: "2026-08-09T15:00:00Z", symbol: "AAA", side: "sell", qty: 1, fillPrice: 125 },
    ],
    brokerObservationTs: "2026-08-09T20:00:00Z",
  });
  assert.equal(report.performance.realizedPl, 25);
  assert.equal(report.performance.unrealizedPl, 25);
  assert.equal(report.performance.totalPl, 50);
  assert.equal(report.performance.endingBalance, 100050);
  assert.equal(report.performance.startingBalance, null);
  assert.equal(report.performance.totalReturnPct, null);
  assert.equal(report.performance.maxDrawdown, null);
});

test("broker-backed reports ignore legacy snapshot performance and activity evidence", () => {
  const report = buildCustomerReportModel({
    period: "daily",
    now: new Date("2026-08-09T20:00:00Z"),
    timeZone: "UTC",
    paperAccount: {
      account: { equity: 100050 },
      summary: { totalUnrealizedPl: 25 },
      positions: [],
    },
    paperLedgerHistory: [
      {
        createdAt: "2026-08-09T19:00:00Z",
        endingEquity: 123456,
        totalRealizedPnl: 9999,
        totalCostBasis: 999999,
        positions: [{ symbol: "LEGACY", qty: 1, costBasis: 999999, realizedPnl: 9999, fillCount: 99 }],
      },
    ],
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [
      { fillId: "buy-win", createdAt: "2026-08-09T14:00:00Z", symbol: "AAA", side: "buy", qty: 2, fillPrice: 100 },
      { fillId: "sell-win", createdAt: "2026-08-09T15:00:00Z", symbol: "AAA", side: "sell", qty: 2, fillPrice: 110 },
      { fillId: "buy-loss", createdAt: "2026-08-09T16:00:00Z", symbol: "BBB", side: "buy", qty: 1, fillPrice: 50 },
      { fillId: "sell-loss", createdAt: "2026-08-09T17:00:00Z", symbol: "BBB", side: "sell", qty: 1, fillPrice: 45 },
    ],
    brokerObservationTs: "2026-08-09T20:00:00Z",
  });

  assert.equal(report.paperRecordCount, 0);
  assert.deepEqual(report.activity, []);
  assert.deepEqual(report.equityCurve, []);
  assert.equal(report.performance.totalCapitalUsed, 250);
  assert.equal(report.trades.averageDollarsPerTrade, 125);
  assert.equal(report.trades.tradesWithRealizedPnl, 2);
  assert.equal(report.trades.largestWinner.symbol, "AAA");
  assert.equal(report.trades.largestLoser.symbol, "BBB");
  assert.equal(report.largestWinners[0].symbol, "AAA");
  assert.equal(report.largestLosers[0].symbol, "BBB");
  assert.equal(report.largestWinners.some((row) => row.symbol === "LEGACY"), false);
  assert.equal(report.largestLosers.some((row) => row.symbol === "LEGACY"), false);
});

test("broker-backed lifetime performance avoids inferring starting capital without broker cash-flow history", () => {
  const report = buildCustomerReportModel({
    period: "lifetime",
    now: new Date("2026-08-09T20:00:00Z"),
    timeZone: "UTC",
    paperAccount: {
      account: { equity: 100050 },
      summary: { totalUnrealizedPl: 25 },
      positions: [],
    },
    paperLedgerHistory: [
      { createdAt: "2026-07-01T10:00:00Z", endingEquity: 100000, totalRealizedPnl: 0, positions: [] },
    ],
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [
      { fillId: "buy-1", createdAt: "2026-08-09T14:00:00Z", symbol: "AAA", side: "buy", qty: 1, fillPrice: 100 },
      { fillId: "sell-1", createdAt: "2026-08-09T15:00:00Z", symbol: "AAA", side: "sell", qty: 1, fillPrice: 125 },
    ],
    brokerObservationTs: "2026-08-09T20:00:00Z",
  });
  assert.equal(report.performance.realizedPl, 25);
  assert.equal(report.performance.unrealizedPl, 25);
  assert.equal(report.performance.totalPl, 50);
  assert.equal(report.performance.endingBalance, 100050);
  assert.equal(report.performance.startingBalance, null);
  assert.equal(report.performance.totalReturnPct, null);
  assert.equal(report.performance.maxDrawdown, null);
});

test("real Alpaca PAPER fill history does not fabricate legacy source-intent replay audit", async () => {
  const { buildCustomerReportModel } = await import("../src/scanner/customer_report_model.mjs");
  const report = buildCustomerReportModel({
    period: "lifetime",
    now: new Date("2026-08-09T20:00:00Z"),
    timeZone: "UTC",
    paperAccount: { positions: [], summary: {} },
    paperLedgerHistory: [],
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [{
      fillId: "broker-order-1",
      brokerOrderId: "broker-order-1",
      clientOrderId: "paper-auto-enter-1",
      symbol: "AAPL",
      side: "buy",
      qty: 1,
      fillPrice: 100,
      filledAt: "2026-08-09T18:00:00Z",
      createdAt: "2026-08-09T18:00:00Z",
      source: "alpaca_paper_order_history",
      paperOnly: true,
      brokerConfirmed: true,
    }],
  });
  assert.equal(report.trades.lifecycleSourceAvailable, true);
  assert.equal(report.trades.sourceIntentReplayAuditAvailable, false);
  assert.equal(report.trades.sourceIntentReplayAudit, null);
})


test("propagates broker history truncation metadata", () => {
  const report = buildCustomerReportModel({
    period: "lifetime", now: new Date("2026-08-09T20:00:00Z"), timeZone: "UTC",
    paperAccount: { account: { equity: 100050 }, summary: { totalUnrealizedPl: 25 }, positions: [] },
    paperLedgerHistory: [],
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [
      { fillId: "buy-1", createdAt: "2026-08-09T14:00:00Z", symbol: "AAA", side: "buy", qty: 1, fillPrice: 100 },
      { fillId: "sell-1", createdAt: "2026-08-09T15:00:00Z", symbol: "AAA", side: "sell", qty: 1, fillPrice: 125 },
    ],
    fillLedgerHistoryCompleteness: { historyLimit: 500, sourceRecordCount: 500, historyLimitReached: true, historyComplete: false, historyPossiblyTruncated: true },
    brokerObservationTs: "2026-08-09T20:00:00Z",
  })
  assert.deepEqual(report.brokerHistoryCompleteness, { historyLimit: 500, sourceRecordCount: 500, historyLimitReached: true, historyComplete: false, historyPossiblyTruncated: true })
  assert.equal(report.performance.startingBalance, null)
  assert.equal(report.performance.totalReturnPct, null)
  assert.equal(report.performance.maxDrawdown, null)
})


test("broker-backed performance epoch excludes pre-reset completed trades without widening a narrower requested period", () => {
  const lifetime = buildCustomerReportModel({
    period: "lifetime",
    now: new Date("2026-08-18T12:00:00Z"),
    timeZone: "UTC",
    performanceEpochStartedAt: "2026-08-17T13:45:01.000Z",
    paperAccount: {
      account: { equity: 10002 },
      summary: { totalUnrealizedPl: 0 },
      positions: [],
    },
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [
      { fillId: "old-buy", createdAt: "2026-08-12T18:00:00Z", symbol: "OLD", side: "buy", qty: 1, fillPrice: 4 },
      { fillId: "old-sell", createdAt: "2026-08-12T19:00:00Z", symbol: "OLD", side: "sell", qty: 1, fillPrice: 5 },
      { fillId: "new-buy", createdAt: "2026-08-17T14:00:00Z", symbol: "NEW", side: "buy", qty: 2, fillPrice: 10 },
      { fillId: "new-sell", createdAt: "2026-08-17T14:30:00Z", symbol: "NEW", side: "sell", qty: 2, fillPrice: 11 },
    ],
    brokerObservationTs: "2026-08-18T11:59:30Z",
    scannerEvents: [
      { createdAt: "2026-08-12T18:30:00Z", resultState: "ENTER", rankingConfidence: 99 },
      { createdAt: "2026-08-17T14:15:00Z", resultState: "ENTER", rankingConfidence: 90 },
    ],
  });

  assert.equal(lifetime.performanceEpochActive, true);
  assert.equal(lifetime.performanceEpochStartedAt, "2026-08-17T13:45:01.000Z");
  assert.equal(lifetime.range.startIso, "2026-08-17T13:45:01.000Z");
  assert.equal(lifetime.trades.completedRoundTrips, 1);
  assert.equal(lifetime.trades.completedTrades[0].symbol, "NEW");
  assert.equal(lifetime.performance.realizedPl, 2);
  assert.equal(lifetime.scanner.signalsGenerated, 1);

  const daily = buildCustomerReportModel({
    period: "daily",
    now: new Date("2026-08-18T12:00:00Z"),
    timeZone: "UTC",
    performanceEpochStartedAt: "2026-08-17T13:45:01.000Z",
    paperAccount: { account: { equity: 10000 }, summary: { totalUnrealizedPl: 0 }, positions: [] },
    fillLedgerHistorySource: "alpaca_paper_order_history",
    fillLedgerHistory: [],
    brokerObservationTs: "2026-08-18T11:59:30Z",
  });
  assert.equal(daily.range.startIso, "2026-08-18T00:00:00.000Z");
  assert.equal(daily.performanceEpochActive, true);
});
