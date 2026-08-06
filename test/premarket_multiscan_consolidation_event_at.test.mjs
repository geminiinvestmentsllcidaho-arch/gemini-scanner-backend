import test from "node:test";
import assert from "node:assert/strict";
import { consolidatePremarketScansReadonly } from "../src/scanner/premarket_multiscan_consolidation_readonly.mjs";

const scan = (eventAt, score) => ({
  eventAt,
  scanType: "premarket",
  candidates: [{
    symbol: "EQNR",
    decision: "WATCH",
    premarketPotentialScore: score,
    spreadPct: 0.4,
    dollarVolume: 2_000_000,
    sourceStale: false,
  }],
});

test("uses persisted scan eventAt as the candidate timestamp fallback", () => {
  const report = consolidatePremarketScansReadonly([
    scan("2026-08-06T12:00:00.000Z", 72),
    scan("2026-08-06T12:10:00.000Z", 74),
    scan("2026-08-06T12:20:00.000Z", 76),
  ], { generatedAt: "2026-08-06T21:00:00.000Z" });

  assert.equal(report.sourceScanCount, 3);
  assert.equal(report.candidateCount, 1);
  assert.equal(report.candidates[0].symbol, "EQNR");
  assert.equal(report.candidates[0].observationCount, 3);
  assert.equal(report.candidates[0].consolidationStatus, "confirmed_watch_candidate");
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});
