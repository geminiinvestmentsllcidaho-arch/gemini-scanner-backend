import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildAiManualAdjustmentWeeklyReportPdf,
} from "../src/scanner/ai_manual_adjustment_weekly_report_pdf.mjs";

test("builds a private read-only weekly recommendation PDF with safety locks closed", () => {
  const pdf = buildAiManualAdjustmentWeeklyReportPdf({
    report: {
      generatedAt: "2026-09-01T16:00:00.000Z",
      periodStart: "2026-08-25T16:00:00.000Z",
      periodEnd: "2026-09-01T16:00:00.000Z",
      sourceRecordCount: 2,
      truncatedHistoryRecordCount: 1,
      recommendations: [{
        title: "Review confidence floor",
        targetArea: "ranking_confidence",
        suggestedDirection: "Backtest a higher confidence floor.",
        evidenceSummary: "Repeated false positives were observed.",
        currentValue: 0.6,
        proposedValue: 0.65,
        confidence: 0.8,
        sampleCount: 7,
        riskLevel: "medium",
        historyPossiblyTruncated: true,
      }],
    },
  });

  assert.equal(pdf.version, VERSION);
  assert.equal(pdf.filename, "GeminiScanner-Weekly-AI-Adjustment-Recommendations.pdf");
  assert.equal(pdf.contentType, "application/pdf");
  assert.ok(Buffer.isBuffer(pdf.buffer));
  assert.ok(pdf.buffer.length > 500);
  assert.equal(pdf.buffer.subarray(0, 8).toString(), "%PDF-1.4");
  assert.equal(pdf.recommendationCount, 1);
  assert.equal(pdf.proposalOnly, true);
  assert.equal(pdf.requiresBacktest, true);
  assert.equal(pdf.requiresOperatorApproval, true);
  assert.equal(pdf.readOnly, true);
  assert.equal(pdf.paperOnly, true);
  assert.equal(pdf.scannerLogicMutationAllowed, false);
  assert.equal(pdf.thresholdMutationAllowed, false);
  assert.equal(pdf.brokerContactAllowed, false);
  assert.equal(pdf.orderPlacementAllowed, false);
  assert.equal(pdf.accountMutationAllowed, false);

  const text = pdf.buffer.toString("latin1");
  assert.match(text, /Weekly AI Adjustment Recommendations/);
  assert.match(text, /Review confidence floor/);
  assert.match(text, /Backtest required: YES/);
  assert.match(text, /Operator approval required: YES/);
  assert.match(text, /PROPOSAL ONLY - NO IMPLEMENTATION INCLUDED/);
  assert.match(text, /History possibly truncated: YES/);
});

test("builds a no-action weekly PDF without implying approval or implementation", () => {
  const pdf = buildAiManualAdjustmentWeeklyReportPdf({
    report: {
      generatedAt: "2026-09-01T16:00:00.000Z",
      periodStart: "2026-08-25T16:00:00.000Z",
      periodEnd: "2026-09-01T16:00:00.000Z",
      sourceRecordCount: 0,
      truncatedHistoryRecordCount: 0,
      recommendations: [],
    },
  });

  assert.equal(pdf.recommendationCount, 0);
  assert.equal(pdf.requiresBacktest, false);
  assert.equal(pdf.requiresOperatorApproval, false);
  assert.equal(pdf.scannerLogicMutationAllowed, false);
  assert.equal(pdf.orderPlacementAllowed, false);
  const text = pdf.buffer.toString("latin1");
  assert.match(text, /No actionable recommendations this week/);
  assert.match(text, /PROPOSAL ONLY - NO IMPLEMENTATION INCLUDED/);
});
