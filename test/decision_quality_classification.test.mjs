import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildDecisionQualityClassificationReport,
} from "../src/scanner/decision_quality_classification.mjs";

function evaluation(classification, overrides = {}) {
  return {
    key: classification,
    originScanId: "scan-1",
    originEventAt: "2026-07-16T14:00:00.000Z",
    symbol: overrides.symbol ?? "ABC",
    decision: overrides.decision ?? "ENTER",
    classification,
    observations: overrides.observations ?? 4,
    entryPrice: 10,
    latestPrice: 10.5,
    latestReturnPct: overrides.latestReturnPct ?? 0.5,
    maxFavorablePct: overrides.maxFavorablePct ?? 1,
    maxAdversePct: overrides.maxAdversePct ?? -0.2,
    blockingFlags: overrides.blockingFlags ?? [],
  };
}

test("maps outcome evaluations into decision quality classes", () => {
  const report = buildDecisionQualityClassificationReport({
    version: "decision_outcome_evaluation_v1",
    evaluations: [
      evaluation("FALSE_POSITIVE_ENTER", { latestReturnPct: -1 }),
      evaluation("MISSED_OPPORTUNITY", { decision: "DO_NOT_ENTER", latestReturnPct: 1.2 }),
      evaluation("WAIT_TOO_LONG", { decision: "WAIT", latestReturnPct: 0.8 }),
      evaluation("LATE_OR_WEAK_ENTER", { latestReturnPct: 0.1 }),
      evaluation("ENTER_INCONCLUSIVE", { latestReturnPct: 0 }),
      evaluation("CORRECT_ENTER", { latestReturnPct: 1 }),
      evaluation("AVOIDED_LOSS", { decision: "DO_NOT_ENTER", latestReturnPct: -1 }),
    ],
  }, {
    now: "2026-07-16T15:00:00.000Z",
  });

  assert.equal(report.version, VERSION);
  assert.deepEqual(
    report.classifications.map((row) => row.qualityClass),
    [
      "FALSE_POSITIVE",
      "MISSED_OPPORTUNITY",
      "LATE_DECISION",
      "LATE_ENTRY",
      "NEAR_MISS",
      "STRONG_DECISION",
      "CAPITAL_PROTECTION_SUCCESS",
    ],
  );
  assert.equal(report.falsePositiveCount, 1);
  assert.equal(report.missedOpportunityCount, 1);
  assert.equal(report.lateEntryCount, 1);
  assert.equal(report.lateDecisionCount, 1);
  assert.equal(report.nearMissCount, 1);
  assert.equal(report.reviewRequiredCount, 5);
});

test("builds a priority review queue while preserving read-only safety", () => {
  const report = buildDecisionQualityClassificationReport({
    evaluations: [
      evaluation("WAIT_TOO_LONG", { symbol: "ZZZ", decision: "WAIT", latestReturnPct: 0.7 }),
      evaluation("FALSE_POSITIVE_ENTER", { symbol: "AAA", latestReturnPct: -1.5 }),
      evaluation("MISSED_OPPORTUNITY", { symbol: "BBB", decision: "DO_NOT_ENTER", latestReturnPct: 2 }),
      evaluation("CORRECT_WAIT", { symbol: "CCC", decision: "WAIT", latestReturnPct: -0.5 }),
    ],
  });

  assert.equal(report.reviewQueue[0].qualityClass, "MISSED_OPPORTUNITY");
  assert.equal(report.reviewQueue[1].qualityClass, "FALSE_POSITIVE");
  assert.equal(report.reviewQueue[2].qualityClass, "LATE_DECISION");
  assert.equal(report.proposalGenerationAllowed, true);
  assert.equal(report.automaticLearningAllowed, false);
  assert.equal(report.automaticPatchAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});


test("propagates fresh-source observability metadata into pending quality items", () => {
  const report = buildDecisionQualityClassificationReport({
    version: "decision_outcome_evaluation_v1",
    marketOpenObservationsOnly: true,
    freshSourceObservationsOnly: true,
    evaluations: [{
      key: "scan-stale:ABC",
      originScanId: "scan-stale",
      originEventAt: "2026-07-16T14:00:00.000Z",
      originMarketOpen: true,
      originSourceStale: true,
      originObservable: false,
      symbol: "ABC",
      decision: "DO_NOT_ENTER",
      classification: "PENDING",
      observations: 0,
      blockingFlags: ["stale_source"],
    }],
  });

  assert.equal(report.marketOpenObservationsOnly, true);
  assert.equal(report.freshSourceObservationsOnly, true);
  assert.equal(report.classifications[0].originMarketOpen, true);
  assert.equal(report.classifications[0].originSourceStale, true);
  assert.equal(report.classifications[0].originObservable, false);
  assert.equal(report.classifications[0].qualityClass, "PENDING");
  assert.equal(report.observedClassificationCount, 0);
  assert.equal(report.reviewRequiredCount, 0);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test("keeps pending evaluations out of observed review metrics", () => {
  const report = buildDecisionQualityClassificationReport({
    evaluations: [
      evaluation("PENDING", { observations: 0 }),
      evaluation("UNCLASSIFIED"),
    ],
  });

  assert.equal(report.classificationCount, 2);
  assert.equal(report.observedClassificationCount, 1);
  assert.equal(report.pendingClassificationCount, 1);
  assert.equal(report.reviewRequiredCount, 1);
  assert.equal(report.classifications[0].qualityClass, "PENDING");
  assert.equal(report.classifications[1].qualityClass, "UNCLASSIFIED");
});
