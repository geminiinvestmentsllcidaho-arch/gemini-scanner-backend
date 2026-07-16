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
  assert.equal(report.aiReview.requiresOperatorApproval, true);
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
