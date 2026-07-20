import assert from "node:assert/strict";
import test from "node:test";

import {
  consolidatePremarketScansReadonly,
} from "../src/scanner/premarket_multiscan_consolidation_readonly.mjs";

function scan(generatedAt, candidates) {
  return {
    generatedAt,
    sharedCache: { generatedAt },
    candidates,
  };
}

test("confirms a repeatedly strong premarket watch candidate across a meaningful window", () => {
  const result = consolidatePremarketScansReadonly([
    scan("2026-07-20T12:30:00.000Z", [{
      symbol: "ABCD",
      decision: "WATCH",
      premarketPotentialScore: 71,
      spreadPct: 1.2,
      dollarVolume: 300000,
      changePct: 4,
    }]),
    scan("2026-07-20T12:35:00.000Z", [{
      symbol: "ABCD",
      decision: "WATCH",
      premarketPotentialScore: 74,
      spreadPct: 1,
      dollarVolume: 420000,
      changePct: 4.8,
    }]),
    scan("2026-07-20T12:40:00.000Z", [{
      symbol: "ABCD",
      decision: "WATCH",
      premarketPotentialScore: 77,
      spreadPct: 0.8,
      dollarVolume: 600000,
      changePct: 5.3,
    }]),
  ], { generatedAt: "2026-07-20T12:40:01.000Z" });

  assert.equal(result.candidateCount, 1);
  const candidate = result.candidates[0];
  assert.equal(candidate.symbol, "ABCD");
  assert.equal(candidate.consolidationStatus, "confirmed_watch_candidate");
  assert.equal(candidate.observationCount, 3);
  assert.equal(candidate.windowMinutes, 10);
  assert.equal(candidate.scoreTrend, "improving");
  assert.equal(candidate.spreadTrend, "tightening");
  assert.equal(candidate.dollarVolumeTrend, "improving");
  assert.equal(candidate.watchRatio, 1);
});

test("does not confirm repeated scans that cover too little elapsed time", () => {
  const result = consolidatePremarketScansReadonly([
    scan("2026-07-20T13:15:00.000Z", [{ symbol: "FAST", decision: "WATCH", premarketPotentialScore: 75 }]),
    scan("2026-07-20T13:15:30.000Z", [{ symbol: "FAST", decision: "WATCH", premarketPotentialScore: 76 }]),
    scan("2026-07-20T13:16:00.000Z", [{ symbol: "FAST", decision: "WATCH", premarketPotentialScore: 77 }]),
  ]);

  assert.equal(result.candidates[0].consolidationStatus, "insufficient_evidence");
});

test("rejects a candidate whose latest scan becomes stale or unsafe", () => {
  const result = consolidatePremarketScansReadonly([
    scan("2026-07-20T12:30:00.000Z", [{ symbol: "RISK", decision: "WATCH", premarketPotentialScore: 75, spreadPct: 1 }]),
    scan("2026-07-20T12:36:00.000Z", [{ symbol: "RISK", decision: "WAIT", premarketPotentialScore: 65, spreadPct: 1.5 }]),
    scan("2026-07-20T12:42:00.000Z", [{
      symbol: "RISK",
      decision: "DO_NOT_ENTER",
      premarketPotentialScore: 39,
      spreadPct: 3,
      sourceStale: true,
    }]),
  ]);

  assert.equal(result.candidates[0].consolidationStatus, "rejected");
});

test("preserves strict read-only and non-mutation safety flags", () => {
  const result = consolidatePremarketScansReadonly([]);

  assert.equal(result.readOnly, true);
  assert.equal(result.paperOnly, true);
  assert.equal(result.decisionAssistOnly, true);
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});
