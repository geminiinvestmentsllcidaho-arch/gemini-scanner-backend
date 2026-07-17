import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildDecisionOutcomeEvaluationReport,
} from "../src/scanner/decision_outcome_evaluation.mjs";

function outcome(decision, latestReturnPct, maxFavorablePct, maxAdversePct, observations = 4) {
  return {
    key: `${decision}:${latestReturnPct}`,
    originScanId: "scan-1",
    originEventAt: "2026-07-16T14:00:00.000Z",
    symbol: "ABC",
    decision,
    observations,
    entryPrice: 10,
    latestPrice: latestReturnPct === null ? null : 10 * (1 + latestReturnPct / 100),
    latestReturnPct,
    maxFavorablePct,
    maxAdversePct,
  };
}

test("classifies enter wait and do-not-enter decisions against outcomes", () => {
  const report = buildDecisionOutcomeEvaluationReport({
    version: "opportunity_outcome_tracking_v1",
    outcomes: [
      outcome("ENTER", 1, 1.2, -0.1),
      outcome("ENTER", -1, 0.1, -1.2),
      outcome("WAIT", 0.8, 1.1, -0.1),
      outcome("WAIT", -0.8, 0.1, -1),
      outcome("DO_NOT_ENTER", 1.2, 1.5, -0.1),
      outcome("DO_NOT_ENTER", -1, 0.1, -1.2),
      outcome("DO_NOT_ENTER", 0, 0.1, -0.1),
    ],
  }, {
    now: "2026-07-16T15:00:00.000Z",
  });

  assert.equal(report.version, VERSION);
  assert.deepEqual(
    report.evaluations.map((row) => row.classification),
    [
      "CORRECT_ENTER",
      "FALSE_POSITIVE_ENTER",
      "WAIT_TOO_LONG",
      "CORRECT_WAIT",
      "MISSED_OPPORTUNITY",
      "AVOIDED_LOSS",
      "CORRECT_REJECTION",
    ],
  );
  assert.equal(report.favorableDecisionCount, 4);
  assert.equal(report.unfavorableDecisionCount, 3);
  assert.equal(report.favorableDecisionRatePct, 57.14);
});

test("keeps unobserved outcomes pending and safety locks closed", () => {
  const report = buildDecisionOutcomeEvaluationReport({
    outcomes: [
      outcome("ENTER", null, 0, 0, 0),
    ],
  });

  assert.equal(report.evaluationCount, 1);
  assert.equal(report.observedEvaluationCount, 0);
  assert.equal(report.pendingEvaluationCount, 1);
  assert.equal(report.evaluations[0].classification, "PENDING");
  assert.equal(report.automaticLearningAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test("supports explicit evaluation thresholds without mutating source outcomes", () => {
  const source = outcome("ENTER", 0.3, 0.4, -0.1);
  const report = buildDecisionOutcomeEvaluationReport({
    outcomes: [source],
  }, {
    positivePct: 0.5,
    meaningfulFavorablePct: 1,
  });

  assert.equal(report.evaluations[0].classification, "ENTER_INCONCLUSIVE");
  assert.equal(source.classification, undefined);
  assert.equal(report.thresholds.positivePct, 0.5);
  assert.equal(report.thresholds.meaningfulFavorablePct, 1);
});


test("propagates fresh-source observability metadata without changing pending classification", () => {
  const report = buildDecisionOutcomeEvaluationReport({
    version: "opportunity_outcome_tracking_v1",
    freshSourceObservationsOnly: true,
    outcomes: [{
      key: "scan-stale:ABC",
      originScanId: "scan-stale",
      originEventAt: "2026-07-16T14:00:00.000Z",
      originMarketOpen: true,
      originSourceStale: true,
      originObservable: false,
      symbol: "ABC",
      decision: "DO_NOT_ENTER",
      observations: 0,
      entryPrice: 10,
      latestPrice: null,
      latestReturnPct: null,
      maxFavorablePct: 0,
      maxAdversePct: 0,
      blockingFlags: ["stale_source"],
    }],
  });

  assert.equal(report.freshSourceObservationsOnly, true);
  assert.equal(report.evaluations[0].originMarketOpen, true);
  assert.equal(report.evaluations[0].originSourceStale, true);
  assert.equal(report.evaluations[0].originObservable, false);
  assert.equal(report.evaluations[0].classification, "PENDING");
  assert.equal(report.observedEvaluationCount, 0);
  assert.equal(report.favorableDecisionCount, 0);
  assert.equal(report.unfavorableDecisionCount, 0);
});


test("keeps market-closed pending outcomes out of favorable decision metrics", () => {
  const report = buildDecisionOutcomeEvaluationReport({
    version: "opportunity_outcome_tracking_v1",
    outcomes: [{
      key: "closed-1:ABC",
      originScanId: "closed-1",
      originEventAt: "2026-07-17T00:30:00.000Z",
      originMarketOpen: false,
      symbol: "ABC",
      decision: "DO_NOT_ENTER",
      observations: 0,
      entryPrice: 10,
      latestPrice: null,
      latestReturnPct: null,
      maxFavorablePct: 0,
      maxAdversePct: 0,
    }],
  });

  assert.equal(report.classificationCounts.PENDING, 1);
  assert.equal(report.favorableDecisionCount, 0);
  assert.equal(report.unfavorableDecisionCount, 0);
  assert.equal(report.evaluations[0].originMarketOpen, false);
  assert.equal(report.marketOpenObservationsOnly, true);
});
