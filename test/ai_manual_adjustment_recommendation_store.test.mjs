import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  VERSION,
  appendAiManualAdjustmentRecommendationRecord,
  buildAiManualAdjustmentRecommendationRecord,
  listAiManualAdjustmentRecommendationRecords,
} from "../src/scanner/ai_manual_adjustment_recommendation_store.mjs";

test("builds bounded manual-review recommendations with all mutation locks closed", () => {
  const record = buildAiManualAdjustmentRecommendationRecord({
    sourceReview: {
      reviewId: "review-1",
      generatedAt: "2026-07-20T20:00:00.000Z",
      responseId: "resp-1",
      providerStatus: "completed_readonly",
    },
    sourceCalibration: {
      generatedAt: "2026-07-20T19:59:00.000Z",
      calibrationReviewQueueCount: 2,
    },
    recommendations: [{
      title: "Review confidence floor",
      targetArea: "ranking_confidence",
      suggestedDirection: "Test raising the confidence floor in paper-only replay.",
      evidenceSummary: "Seven high-confidence false positives across three open sessions.",
      currentValue: 0.6,
      proposedValue: 0.65,
      unit: "ratio",
      confidence: 0.74,
      sampleCount: 7,
      observableSourceCount: 7,
      staleSourceCount: 0,
      riskLevel: "medium",
    }],
  }, {
    now: "2026-07-20T20:01:00.000Z",
    minimumOpenSessionsBeforeAdjustment: 3,
  });

  assert.equal(record.version, VERSION);
  assert.equal(record.recommendationCount, 1);
  assert.equal(record.lifecycleStatus, "AWAITING_MANUAL_REVIEW");
  assert.equal(record.monitoringContinues, true);
  assert.equal(record.compareBeforeAfterRequired, true);
  assert.equal(record.minimumOpenSessionsBeforeAdjustment, 3);
  assert.equal(record.recommendations[0].proposedValue, 0.65);
  assert.equal(record.recommendations[0].requiresBacktest, true);
  assert.equal(record.recommendations[0].requiresOperatorApproval, true);
  assert.equal(record.automaticLearningAllowed, false);
  assert.equal(record.automaticPatchAllowed, false);
  assert.equal(record.scannerLogicMutationAllowed, false);
  assert.equal(record.thresholdMutationAllowed, false);
  assert.equal(record.orderPlacementAllowed, false);
  assert.equal(record.accountMutationAllowed, false);
});

test("persists private local history and skips consecutive duplicates", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-manual-adjustment-"));
  const ledgerPath = path.join(dir, "recommendations.jsonl");
  const record = buildAiManualAdjustmentRecommendationRecord({
    sourceReview: { reviewId: "same-review" },
    recommendations: [{
      targetArea: "wait_timing",
      suggestedDirection: "Test a shorter WAIT confirmation window.",
    }],
  }, { now: "2026-07-20T20:01:00.000Z" });

  const first = appendAiManualAdjustmentRecommendationRecord(record, { ledgerPath });
  const second = appendAiManualAdjustmentRecommendationRecord(record, { ledgerPath });
  const history = listAiManualAdjustmentRecommendationRecords({ ledgerPath });

  assert.equal(first.appended, true);
  assert.equal(second.appended, false);
  assert.equal(second.duplicateSkipped, true);
  assert.equal(history.recordCount, 1);
  assert.equal(history.records[0].recordId, record.recordId);
  assert.equal(fs.statSync(ledgerPath).mode & 0o777, 0o600);
  assert.equal(history.scannerLogicMutationAllowed, false);
  assert.equal(history.thresholdMutationAllowed, false);
});

test("returns no-action lifecycle while monitoring remains active", () => {
  const record = buildAiManualAdjustmentRecommendationRecord({
    recommendations: [{}],
  });

  assert.equal(record.recommendationCount, 0);
  assert.equal(record.lifecycleStatus, "NO_ACTIONABLE_RECOMMENDATIONS");
  assert.equal(record.monitoringContinues, true);
  assert.equal(record.implementationIncluded, false);
  assert.equal(record.patchIncluded, false);
});
