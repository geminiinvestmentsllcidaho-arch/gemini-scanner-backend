import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("weekly runner reads local ledger and writes private PDF with mutation locks closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-weekly-ai-runner-"));
  const ledgerPath = path.join(dir, "recommendations.jsonl");
  const pdfPath = path.join(dir, "weekly.pdf");
  const generatedAt = new Date(Date.now() - 60000).toISOString();
  const record = {
    version: "ai_manual_adjustment_recommendation_store_v1",
    recordId: "runner-test",
    generatedAt,
    fillLedgerHistoryCompleteness: { historyComplete: true, historyPossiblyTruncated: false },
    recommendations: [{
      recommendationId: "rec-1",
      title: "Review confidence floor",
      targetArea: "ranking_confidence",
      suggestedDirection: "Backtest a higher confidence floor.",
      evidenceSummary: "Repeated false positives observed.",
      currentValue: 0.6,
      proposedValue: 0.65,
      confidence: 0.8,
      sampleCount: 7,
      riskLevel: "medium"
    }]
  };
  fs.writeFileSync(ledgerPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });

  const run = spawnSync(process.execPath, ["scripts/run_ai_manual_adjustment_weekly_report.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH: ledgerPath,
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_PDF_PATH: pdfPath
    },
    encoding: "utf8"
  });

  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.period, "weekly");
  assert.equal(result.sourceRecordCount, 1);
  assert.equal(result.recommendationCount, 1);
  assert.equal(result.lifecycleStatus, "AWAITING_MANUAL_REVIEW");
  assert.equal(result.requiresBacktest, true);
  assert.equal(result.requiresOperatorApproval, true);
  assert.equal(result.pdfPath, path.resolve(pdfPath));
  assert.equal(result.pdfContentType, "application/pdf");
  assert.equal(result.emailDelivery.delivered, false);
  assert.equal(result.emailDelivery.attempted, false);
  assert.equal(result.emailDelivery.reason, "weekly_ai_report_email_send_not_authorized");
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
  assert.equal(fs.statSync(pdfPath).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(pdfPath).subarray(0, 8).toString(), "%PDF-1.4");
});
