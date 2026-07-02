import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTodaysIntradaySetups,
  classifyIntradaySetup,
  INTRADAY_SETUP_LABELS
} from "../src/scanner/todays_intraday_setups.mjs";

test("today intraday setup universe includes all requested labels", () => {
  assert.deepEqual(INTRADAY_SETUP_LABELS, [
    "GAP_AND_GO",
    "OPENING_RANGE_BREAKOUT",
    "INTRADAY_MOMENTUM",
    "HIGH_RELATIVE_VOLUME",
    "VWAP_RECLAIM",
    "PULLBACK_CONTINUATION",
    "SCALP_CANDIDATE",
    "NO_TRADE"
  ]);
});

test("classifies a strong intraday candidate across requested setup labels", () => {
  const candidate = classifyIntradaySetup({
    symbol: "TESTA",
    lastPrice: 12.8,
    previousClose: 12,
    dayOpen: 12.4,
    vwap: 12.45,
    wasBelowVwap: true,
    openingRangeHigh: 12.7,
    relativeVolume: 3.2,
    volume: 900000,
    spreadPct: 0.08,
    confidence: 0.82,
    pullbackPct: 0.7
  });

  for (const label of [
    "GAP_AND_GO",
    "OPENING_RANGE_BREAKOUT",
    "INTRADAY_MOMENTUM",
    "HIGH_RELATIVE_VOLUME",
    "VWAP_RECLAIM",
    "PULLBACK_CONTINUATION",
    "SCALP_CANDIDATE"
  ]) {
    assert.equal(candidate.setupLabels.includes(label), true, `${label} missing`);
  }

  assert.equal(candidate.primarySetup, "GAP_AND_GO");
  assert.equal(candidate.orderPlacementAllowed, false);
  assert.equal(candidate.brokerContactAllowed, false);
  assert.equal(candidate.accountMutationAllowed, false);
});

test("classifies blocked or weak candidates as NO_TRADE", () => {
  const blocked = classifyIntradaySetup({
    symbol: "TESTB",
    lastPrice: 7.1,
    previousClose: 7.4,
    confidence: 0.32,
    stale: true
  });

  assert.equal(blocked.primarySetup, "NO_TRADE");
  assert.deepEqual(blocked.setupLabels, ["NO_TRADE"]);
  assert.equal(blocked.reasons.includes("blocked_or_stale"), true);
  assert.equal(blocked.reasons.includes("confidence_below_threshold"), true);
});

test("builds read-only today intraday setup report with counts and safety flags", () => {
  const report = buildTodaysIntradaySetups({
    session: "regular",
    now: new Date("2026-07-02T00:00:00Z"),
    rankings: [
      {
        symbol: "TESTA",
        lastPrice: 12.8,
        previousClose: 12,
        dayOpen: 12.4,
        vwap: 12.45,
        wasBelowVwap: true,
        openingRangeHigh: 12.7,
        relativeVolume: 3.2,
        volume: 900000,
        spreadPct: 0.08,
        confidence: 0.82,
        pullbackPct: 0.7
      },
      {
        symbol: "TESTB",
        lastPrice: 7.1,
        previousClose: 7.4,
        confidence: 0.32,
        stale: true
      }
    ]
  });

  assert.equal(report.ok, true);
  assert.equal(report.displayState, "TODAYS_INTRADAY_SETUPS_READY_READONLY");
  assert.equal(report.tradeCandidateCount, 1);
  assert.equal(report.noTradeCount, 1);
  assert.equal(report.setupCounts.GAP_AND_GO, 1);
  assert.equal(report.setupCounts.OPENING_RANGE_BREAKOUT, 1);
  assert.equal(report.setupCounts.INTRADAY_MOMENTUM, 1);
  assert.equal(report.setupCounts.HIGH_RELATIVE_VOLUME, 1);
  assert.equal(report.setupCounts.VWAP_RECLAIM, 1);
  assert.equal(report.setupCounts.PULLBACK_CONTINUATION, 1);
  assert.equal(report.setupCounts.SCALP_CANDIDATE, 1);
  assert.equal(report.setupCounts.NO_TRADE, 1);
  assert.equal(report.readOnly, true);
  assert.equal(report.monitorOnly, true);
  assert.equal(report.diagnosticsOnly, true);
  assert.equal(report.noExecutionControls, true);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.accountMutationAttempted, false);
  assert.equal(report.safety.orderSubmitAllowed, false);
  assert.equal(report.safety.autoTradingAllowed, false);
  assert.equal(report.safety.accountMutationAllowed, false);
});
