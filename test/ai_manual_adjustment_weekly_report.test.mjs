import assert from "node:assert/strict";
import test from "node:test";
import {
  VERSION,
  buildAiManualAdjustmentWeeklyReport,
} from "../src/scanner/ai_manual_adjustment_weekly_report.mjs";

test("builds weekly manual-review report from in-window recommendation records", () => {
  const report = buildAiManualAdjustmentWeeklyReport({
    records: [{
      recordId: "recent-1",
      generatedAt: "2026-09-01T12:00:00.000Z",
      fillLedgerHistoryCompleteness: {
        historyComplete: true,
        historyPossiblyTruncated: false,
      },
      recommendations: [{
        recommendationId: "rec-1",
        title: "Review confidence floor",
        targetArea: "ranking_confidence",
        suggestedDirection: "Backtest a higher confidence floor.",
        evidenceSummary: "Observed repeated false positives.",
        currentValue: 0.6,
        proposedValue: 0.65,
        confidence: 0.8,
        sampleCount: 7,
        riskLevel: "medium",
      }],
    }, {
      recordId: "old",
      generatedAt: "2026-08-20T12:00:00.000Z",
      recommendations: [{ suggestedDirection: "Ignore old record." }],
    }],
  }, {
    now: new Date("2026-09-01T16:00:00.000Z"),
    lookbackDays: 7,
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.period, "weekly");
  assert.equal(report.sourceRecordCount, 1);
  assert.equal(report.recommendationCount, 1);
  assert.deepEqual(report.targetAreas, ["ranking_confidence"]);
  assert.equal(report.truncatedHistoryRecordCount, 0);
  assert.equal(report.brokerHistoryCompleteForAllIncludedRecords, true);
  assert.equal(report.backtestRequiredCount, 1);
  assert.equal(report.operatorApprovalRequiredCount, 1);
  assert.equal(report.lifecycleStatus, "AWAITING_MANUAL_REVIEW");
  assert.equal(report.recommendations[0].sourceRecordId, "recent-1");
  assert.equal(report.recommendations[0].requiresBacktest, true);
  assert.equal(report.recommendations[0].requiresOperatorApproval, true);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test("surfaces possible broker-history truncation and no-action state", () => {
  const report = buildAiManualAdjustmentWeeklyReport({
    records: [{
      recordId: "truncated",
      generatedAt: "2026-09-01T10:00:00.000Z",
      fillLedgerHistoryCompleteness: {
        historyComplete: false,
        historyPossiblyTruncated: true,
      },
      recommendations: [],
    }],
  }, { now: new Date("2026-09-01T16:00:00.000Z") });

  assert.equal(report.sourceRecordCount, 1);
  assert.equal(report.recommendationCount, 0);
  assert.equal(report.truncatedHistoryRecordCount, 1);
  assert.equal(report.brokerHistoryCompleteForAllIncludedRecords, false);
  assert.equal(report.lifecycleStatus, "NO_ACTIONABLE_RECOMMENDATIONS");
  assert.equal(report.requiresBacktest, false);
  assert.equal(report.requiresOperatorApproval, false);
  assert.equal(report.monitoringContinues, true);
  assert.equal(report.implementationIncluded, false);
  assert.equal(report.patchIncluded, false);
});

test("returns no-action week when no records are in range", () => {
  const report = buildAiManualAdjustmentWeeklyReport({ records: [] }, {
    now: new Date("2026-09-01T16:00:00.000Z"),
  });
  assert.equal(report.sourceRecordCount, 0);
  assert.equal(report.recommendationCount, 0);
  assert.equal(report.brokerHistoryCompleteForAllIncludedRecords, false);
  assert.equal(report.lifecycleStatus, "NO_ACTIONABLE_RECOMMENDATIONS");
});
