import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  reconstructCustomerReportTradeLifecycle,
} from "../src/scanner/customer_report_trade_lifecycle.mjs";

const fill = (createdAt, symbol, side, qty, fillPrice, fillId = null) => ({
  fillId,
  createdAt,
  symbol,
  side,
  qty,
  fillPrice,
});

const range = {
  start: new Date("2026-07-01T00:00:00.000Z"),
  end: new Date("2026-07-31T23:59:59.999Z"),
};

test("reconstructs a profitable completed long round trip", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range,
    fillRecords: [
      fill("2026-07-02T14:30:00.000Z", "AAA", "buy", 10, 10, "b1"),
      fill("2026-07-02T15:30:00.000Z", "AAA", "sell", 10, 12, "s1"),
    ],
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.fillEventsObserved, 2);
  assert.equal(report.positionsOpened, 1);
  assert.equal(report.closedTrades, 1);
  assert.equal(report.completedRoundTrips, 1);
  assert.equal(report.winningTrades, 1);
  assert.equal(report.losingTrades, 0);
  assert.equal(report.breakevenTrades, 0);
  assert.equal(report.winRatePct, 100);
  assert.equal(report.averageGain, 20);
  assert.equal(report.averageRealizedPnlPerTrade, 20);
  assert.equal(report.averageDollarsPerTrade, 100);
  assert.equal(report.averageHoldTimeMs, 3600000);
  assert.equal(report.completedTrades[0].outcome, "win");
  assert.equal(report.completedTrades[0].totalFillCount, 2);
});

test("combines multiple entry fills and partial exits into one round trip", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range,
    fillRecords: [
      fill("2026-07-03T14:00:00.000Z", "mix", "buy", 5, 10),
      fill("2026-07-03T14:05:00.000Z", "MIX", "buy", 5, 12),
      fill("2026-07-03T14:10:00.000Z", "MIX", "sell", 4, 13),
      fill("2026-07-03T14:20:00.000Z", "MIX", "sell", 6, 9),
    ],
  });

  assert.equal(report.positionsOpened, 1);
  assert.equal(report.partialCloseCount, 1);
  assert.equal(report.closedTrades, 1);
  assert.equal(report.completedTrades[0].entryFillCount, 2);
  assert.equal(report.completedTrades[0].exitFillCount, 2);
  assert.equal(report.completedTrades[0].totalFillCount, 4);
  assert.equal(report.completedTrades[0].entryNotional, 110);
  assert.equal(report.completedTrades[0].exitNotional, 106);
  assert.equal(report.completedTrades[0].realizedPnl, -4);
  assert.equal(report.losingTrades, 1);
});

test("counts repeated round trips in the same symbol separately", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range,
    fillRecords: [
      fill("2026-07-04T14:00:00.000Z", "AAA", "buy", 2, 10),
      fill("2026-07-04T14:05:00.000Z", "AAA", "sell", 2, 11),
      fill("2026-07-04T15:00:00.000Z", "AAA", "buy", 3, 20),
      fill("2026-07-04T15:10:00.000Z", "AAA", "sell", 3, 20),
    ],
  });

  assert.equal(report.positionsOpened, 2);
  assert.equal(report.completedRoundTrips, 2);
  assert.equal(report.winningTrades, 1);
  assert.equal(report.breakevenTrades, 1);
  assert.equal(report.winRatePct, 100);
  assert.deepEqual(report.completedTrades.map((trade) => trade.tradeId), ["AAA:1", "AAA:2"]);
});

test("keeps open positions open and excludes them from closed trade metrics", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range,
    fillRecords: [
      fill("2026-07-05T14:00:00.000Z", "OPEN", "buy", 10, 5),
      fill("2026-07-05T14:30:00.000Z", "OPEN", "sell", 4, 6),
    ],
  });

  assert.equal(report.positionsOpened, 1);
  assert.equal(report.closedTrades, 0);
  assert.equal(report.partialCloseCount, 1);
  assert.equal(report.openPositions.length, 1);
  assert.equal(report.openPositions[0].qty, 6);
  assert.equal(report.openPositions[0].avgEntryPrice, 5);
});

test("uses close timestamp for report-period attribution while preserving prior entry", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range,
    fillRecords: [
      fill("2026-06-30T20:00:00.000Z", "CARRY", "buy", 10, 10),
      fill("2026-07-01T14:00:00.000Z", "CARRY", "sell", 10, 11),
      fill("2026-08-01T14:00:00.000Z", "LATE", "buy", 1, 1),
      fill("2026-08-01T14:05:00.000Z", "LATE", "sell", 1, 2),
    ],
  });

  assert.equal(report.fillEventsObserved, 1);
  assert.equal(report.positionsOpened, 0);
  assert.equal(report.completedRoundTrips, 1);
  assert.equal(report.completedTrades[0].symbol, "CARRY");
  assert.equal(report.completedTrades[0].realizedPnl, 10);
});

test("ignores malformed fills and excess sell quantity without creating shorts", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range,
    fillRecords: [
      fill("bad-date", "BAD", "buy", 1, 1, "invalid"),
      fill("2026-07-06T14:00:00.000Z", "AAA", "sell", 3, 10),
      fill("2026-07-06T14:05:00.000Z", "AAA", "buy", 2, 10),
      fill("2026-07-06T14:10:00.000Z", "AAA", "sell", 5, 12),
    ],
  });

  assert.equal(report.ignoredRecordCount, 1);
  assert.equal(report.oversellQuantityIgnored, 6);
  assert.equal(report.completedRoundTrips, 1);
  assert.equal(report.completedTrades[0].realizedPnl, 4);
  assert.equal(report.openPositions.length, 0);
});

test("is deterministic for fills sharing a timestamp by retaining source order", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range,
    fillRecords: [
      fill("2026-07-07T14:00:00.000Z", "SAME", "buy", 1, 10),
      fill("2026-07-07T14:00:00.000Z", "SAME", "sell", 1, 11),
    ],
  });

  assert.equal(report.completedRoundTrips, 1);
  assert.equal(report.completedTrades[0].realizedPnl, 1);
});

test("returns explicit readonly safety flags for an empty ledger", () => {
  const report = reconstructCustomerReportTradeLifecycle({ range, fillRecords: [] });

  assert.equal(report.completedRoundTrips, 0);
  assert.equal(report.readOnly, true);
  assert.equal(report.paperOnly, true);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});


test("scopes opening and partial-close event counts to the report period", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    range: {
      start: new Date("2026-07-02T00:00:00.000Z"),
      end: new Date("2026-07-02T23:59:59.999Z"),
    },
    fillRecords: [
      { fillId: "a1", createdAt: "2026-07-01T14:00:00.000Z", symbol: "AAA", side: "buy", qty: 10, fillPrice: 10 },
      { fillId: "a2", createdAt: "2026-07-01T15:00:00.000Z", symbol: "AAA", side: "sell", qty: 4, fillPrice: 11 },
      { fillId: "a3", createdAt: "2026-07-02T15:00:00.000Z", symbol: "AAA", side: "sell", qty: 2, fillPrice: 11 },
      { fillId: "b1", createdAt: "2026-07-02T16:00:00.000Z", symbol: "BBB", side: "buy", qty: 5, fillPrice: 20 },
    ],
  });

  assert.equal(report.positionsOpened, 1);
  assert.equal(report.partialCloseCount, 1);
  assert.equal(report.fillEventsObserved, 2);
});

test("preserves original entry quantity across partial exits", () => {
  const report = reconstructCustomerReportTradeLifecycle({
    fillRecords: [
      { fillId: "a1", createdAt: "2026-07-01T14:00:00.000Z", symbol: "AAA", side: "buy", qty: 10, fillPrice: 10 },
      { fillId: "a2", createdAt: "2026-07-01T15:00:00.000Z", symbol: "AAA", side: "sell", qty: 4, fillPrice: 11 },
      { fillId: "a3", createdAt: "2026-07-01T16:00:00.000Z", symbol: "AAA", side: "sell", qty: 6, fillPrice: 12 },
    ],
  });

  assert.equal(report.completedTrades.length, 1);
  assert.equal(report.completedTrades[0].entryQty, 10);
});
