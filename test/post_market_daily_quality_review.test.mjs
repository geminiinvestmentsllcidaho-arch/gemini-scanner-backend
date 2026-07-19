import test from "node:test";
import assert from "node:assert/strict";

import {
  VERSION,
  buildPostMarketDailyQualityReview,
} from "../src/scanner/post_market_daily_quality_review.mjs";

test("builds post-market daily quality proposals through the existing read-only pipeline", () => {
  const report = buildPostMarketDailyQualityReview([
    {
      symbol: "AAA",
      riskState: "POSITION_HEALTHY",
      overnightState: "SUITABLE_FOR_OVERNIGHT_REVIEW",
      nextDayState: "CONTINUATION_WATCH",
      rankingConfidence: 0.82,
      sourceObservable: true,
      sourceTimestamp: "2026-07-18T20:10:00.000Z",
    },
    {
      symbol: "BBB",
      riskState: "REDUCE_RISK_REVIEW",
      overnightState: "ELEVATED_OVERNIGHT_RISK",
      nextDayState: "GAP_RISK_WATCH",
      rankingConfidence: 0.71,
      sourceObservable: true,
      flags: ["GAP_RISK"],
      sourceTimestamp: "2026-07-18T20:11:00.000Z",
    },
  ], {
    generatedAt: "2026-07-18T20:15:00.000Z",
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.sourceRecordCount, 2);
  assert.deepEqual(
    report.classificationReport.classifications.map((row) => row.qualityClass),
    ["MISSED_OPPORTUNITY", "NEAR_MISS"],
  );
  assert.equal(report.proposalReport.proposalCount, 2);
  assert.deepEqual(
    report.proposalReport.proposals.map((row) => row.proposalType),
    ["REDUCE_MISSED_OPPORTUNITIES", "REVIEW_INCONCLUSIVE_BOUNDARIES"],
  );
  assert.equal(report.calibrationReview.analyzedProposalCount, 2);
  assert.equal(report.calibrationHistoryRecord.proposalCount, 2);
});

test("fails closed for stale post-market evidence and excludes it from proposal generation", () => {
  const report = buildPostMarketDailyQualityReview([{
    symbol: "STALE",
    riskState: "DATA_STALE",
    overnightState: "INSUFFICIENT_DATA",
    nextDayState: "AVOID_WATCH_ONLY",
    sourceObservable: false,
    sourceStale: true,
    flags: ["SOURCE_STALE"],
  }], {
    generatedAt: "2026-07-18T20:15:00.000Z",
  });

  assert.equal(report.classificationReport.classifications[0].qualityClass, "PENDING");
  assert.equal(report.classificationReport.observedClassificationCount, 0);
  assert.equal(report.classificationReport.reviewRequiredCount, 0);
  assert.equal(report.proposalReport.proposalCount, 0);
  assert.equal(report.calibrationReview.analyzedProposalCount, 0);
});

test("keeps every post-market daily quality and AI proposal mutation lock closed", () => {
  const report = buildPostMarketDailyQualityReview([]);

  for (const key of [
    "automaticLearningAllowed",
    "automaticPatchAllowed",
    "scannerLogicMutationAllowed",
    "thresholdMutationAllowed",
    "brokerContactAllowed",
    "orderPlacementAllowed",
    "accountMutationAllowed",
  ]) {
    assert.equal(report[key], false);
  }

  assert.equal(report.readOnly, true);
  assert.equal(report.paperOnly, true);
  assert.equal(report.proposalOnly, true);
  assert.equal(report.humanReviewRequired, true);
  assert.equal(report.separateApprovalRequired, true);
  assert.equal(report.implementationIncluded, false);
  assert.equal(report.patchIncluded, false);
  assert.equal(Object.isFrozen(report), true);
});
