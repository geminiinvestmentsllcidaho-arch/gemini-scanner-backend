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
      GS_AI_WEEKLY_REPORT_EMAIL_SEND_AUTHORIZED: "false",
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


test("scheduled mode skips outside Denver Friday evening without attempting email", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-weekly-ai-schedule-skip-"));
  const deliveryLedgerPath = path.join(dir, "delivery.jsonl");
  const run = spawnSync(process.execPath, ["scripts/run_ai_manual_adjustment_weekly_report.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_SCHEDULED_MODE: "true",
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_DELIVERY_LEDGER_PATH: deliveryLedgerPath,
      GS_AI_WEEKLY_REPORT_EMAIL_SEND_AUTHORIZED: "false",
    },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "weekly_ai_report_outside_delivery_window");
  assert.equal(result.emailDelivery.attempted, false);
  assert.equal(fs.existsSync(deliveryLedgerPath), false);
});



test("scheduled mode skips a previously delivered weekly bucket without attempting email", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-weekly-ai-schedule-duplicate-"));
  const deliveryLedgerPath = path.join(dir, "delivery.jsonl");
  const scheduledNow = "2026-09-05T00:05:00.000Z";
  const bucketRun = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { customerReportDeliveryBucket } from "./src/scanner/customer_report_delivery_schedule.mjs";
    console.log(customerReportDeliveryBucket("weekly", new Date("${scheduledNow}"), "America/Denver"));
  `], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(bucketRun.status, 0, bucketRun.stderr);
  const bucket = bucketRun.stdout.trim();

  fs.writeFileSync(deliveryLedgerPath, `${JSON.stringify({
    version: "customer_report_delivery_ledger_v1",
    key: `weekly-ai:email:weekly:${bucket}`,
    accountId: "weekly-ai",
    channel: "email",
    period: "weekly",
    bucket,
    status: "delivered",
    provider: "resend",
    deliveryId: null,
    reason: null,
    createdAt: scheduledNow,
    readOnly: true,
    brokerContact: false,
    orderPlacement: false,
    accountMutation: false,
  })}\n`, { mode: 0o600 });

  const run = spawnSync(process.execPath, ["scripts/run_ai_manual_adjustment_weekly_report.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_NOW: scheduledNow,
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_SCHEDULED_MODE: "true",
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_DELIVERY_LEDGER_PATH: deliveryLedgerPath,
      GS_AI_WEEKLY_REPORT_EMAIL_SEND_AUTHORIZED: "true",
    },
    encoding: "utf8",
  });

  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "weekly_ai_report_duplicate_delivery_bucket");
  assert.equal(result.emailDelivery.attempted, false);
  assert.equal(fs.readFileSync(deliveryLedgerPath, "utf8").trim().split("\n").length, 1);
});

test("scheduled mode opens only the Denver Friday 18:00-18:14 delivery window", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-weekly-ai-schedule-window-"));
  const cases = [
    ["2026-09-05T00:00:00.000Z", true],
    ["2026-09-05T00:14:59.000Z", true],
    ["2026-09-05T00:15:00.000Z", false],
    ["2026-12-05T01:00:00.000Z", true],
    ["2026-12-05T01:14:59.000Z", true],
    ["2026-12-05T01:15:00.000Z", false],
  ];

  for (const [scheduledNow, expectedOpen] of cases) {
    const deliveryLedgerPath = path.join(dir, `${scheduledNow.replace(/[^0-9]/g, "")}.jsonl`);
    const run = spawnSync(process.execPath, ["scripts/run_ai_manual_adjustment_weekly_report.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_NOW: scheduledNow,
        AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_SCHEDULED_MODE: "true",
        AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_DELIVERY_LEDGER_PATH: deliveryLedgerPath,
        GS_AI_WEEKLY_REPORT_EMAIL_SEND_AUTHORIZED: "false",
      },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout);
    if (expectedOpen) {
      assert.equal(result.skipped, undefined);
      assert.equal(result.scheduledMode, true);
      assert.equal(result.deliveryWindowOpen, true);
      assert.equal(result.emailDelivery.attempted, false);
      assert.equal(result.emailDelivery.reason, "weekly_ai_report_email_send_not_authorized");
    } else {
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "weekly_ai_report_outside_delivery_window");
      assert.equal(result.emailDelivery.attempted, false);
    }
    assert.equal(fs.existsSync(deliveryLedgerPath), false);
  }
});

test("invalid scheduled test clock fails closed", () => {
  const run = spawnSync(process.execPath, ["scripts/run_ai_manual_adjustment_weekly_report.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_NOW: "not-a-date",
      AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_SCHEDULED_MODE: "true",
      GS_AI_WEEKLY_REPORT_EMAIL_SEND_AUTHORIZED: "false",
    },
    encoding: "utf8",
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /must be a valid timestamp/);
});
