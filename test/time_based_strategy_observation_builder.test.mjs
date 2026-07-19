import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildTimeBasedStrategyObservationReport,
} from "../src/scanner/time_based_strategy_observation_builder.mjs";

function record(scanId, eventAt, candidates, options = {}) {
  return {
    scanId,
    eventAt,
    marketOpen: options.marketOpen !== false,
    scanner: options.scanner ?? "alpaca_under_five_shared",
    scanType: options.scanType ?? "under_five",
    candidates,
  };
}

test("uses elapsed time for intraday and session offsets for later horizons", () => {
  const report = buildTimeBasedStrategyObservationReport([
    record("origin", "2026-07-13T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER" },
    ]),
    record("too-soon", "2026-07-13T14:15:00.000Z", [
      { symbol: "ABC", price: 11 },
    ]),
    record("intraday", "2026-07-13T14:30:00.000Z", [
      { symbol: "ABC", price: 12 },
    ]),
    record("next-day", "2026-07-14T14:00:00.000Z", [
      { symbol: "ABC", price: 13 },
    ]),
    record("day-two", "2026-07-15T14:00:00.000Z", [
      { symbol: "ABC", price: 14 },
    ]),
    record("day-three", "2026-07-16T14:00:00.000Z", [
      { symbol: "ABC", price: 15 },
    ]),
    record("day-five", "2026-07-20T14:00:00.000Z", [
      { symbol: "ABC", price: 16 },
    ]),
  ], {
    now: "2026-07-20T21:00:00.000Z",
    intradayMinutes: 30,
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.sessionCount, 5);
  const origin = report.outcomes.find((row) => row.originScanId === "origin");
  assert.deepEqual(origin.horizonObservations, {
    intraday: 1,
    next_day: 1,
    swing_3_5_day: 2,
  });
  assert.equal(origin.horizonReturnsPct.intraday, 20);
  assert.equal(origin.horizonReturnsPct.next_day, 30);
  assert.equal(origin.horizonReturnsPct.swing_3_5_day, 60);
  assert.equal(origin.horizonMaxFavorablePct.swing_3_5_day, 60);
  assert.equal(origin.horizonMaxAdversePct.swing_3_5_day, 50);
});

test("does not let stale or closed records satisfy a horizon", () => {
  const report = buildTimeBasedStrategyObservationReport([
    record("origin", "2026-07-13T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER" },
    ]),
    record("closed", "2026-07-13T15:00:00.000Z", [
      { symbol: "ABC", price: 99 },
    ], { marketOpen: false }),
    record("stale", "2026-07-13T15:30:00.000Z", [
      { symbol: "ABC", price: 98, sourceStale: true },
    ]),
    record("fresh", "2026-07-13T16:00:00.000Z", [
      { symbol: "ABC", price: 11 },
    ]),
  ], { intradayMinutes: 30 });

  const origin = report.outcomes.find((row) => row.originScanId === "origin");
  assert.equal(origin.horizonObservations.intraday, 1);
  assert.equal(origin.horizonReturnsPct.intraday, 10);
  assert.equal(origin.latestPrice, 11);
});

test("keeps stale origins unobservable and preserves safety locks", () => {
  const report = buildTimeBasedStrategyObservationReport([
    record("origin", "2026-07-13T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER", sourceStale: true },
    ]),
    record("later", "2026-07-13T15:00:00.000Z", [
      { symbol: "ABC", price: 11 },
    ]),
  ]);

  const origin = report.outcomes.find((row) => row.originScanId === "origin");
  assert.equal(origin.originObservable, false);
  assert.deepEqual(origin.horizonObservations, {
    intraday: 0,
    next_day: 0,
    swing_3_5_day: 0,
  });
  assert.equal(report.automaticLearningAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test("uses stable scan and symbol identity and classifies strategy", () => {
  const report = buildTimeBasedStrategyObservationReport([
    record("scan-1", "2026-07-13T14:00:00.000Z", [
      { symbol: "abc", price: 10, decision: "WAIT" },
    ], { scanner: "swing_scanner", scanType: "swing" }),
  ]);

  assert.equal(report.outcomes[0].key, "scan-1:ABC");
  assert.equal(report.outcomes[0].strategyType, "swing");
  assert.equal(report.outcomes[0].symbol, "ABC");
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.outcomes[0]), true);
});
