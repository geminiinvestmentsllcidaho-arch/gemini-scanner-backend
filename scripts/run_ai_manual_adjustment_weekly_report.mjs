import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import {

  DEFAULT_AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH,
  listAiManualAdjustmentRecommendationRecordsInRange,
} from "../src/scanner/ai_manual_adjustment_recommendation_store.mjs";
import {
  buildAiManualAdjustmentWeeklyReport,
} from "../src/scanner/ai_manual_adjustment_weekly_report.mjs";
import { buildAiManualAdjustmentWeeklyReportPdf } from "../src/scanner/ai_manual_adjustment_weekly_report_pdf.mjs";
import { deliverAiManualAdjustmentWeeklyReportEmail } from "../src/scanner/ai_manual_adjustment_weekly_report_email_delivery.mjs";
import { customerReportDeliveryBucket } from "../src/scanner/customer_report_delivery_schedule.mjs";
import { findCustomerReportDeliveryRecord, appendCustomerReportDeliveryRecord } from "../src/scanner/customer_report_delivery_ledger.mjs";

process.umask(0o077);

const configuredNow = String(process.env.AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_NOW ?? "").trim();
const now = configuredNow ? new Date(configuredNow) : new Date();
if (!Number.isFinite(now.getTime())) {
  throw new TypeError("AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_NOW must be a valid timestamp");
}
const deliveryTimeZone = "America/Denver";
const deliveryParts = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: deliveryTimeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]),
);
const deliveryWindowOpen =
  deliveryParts.weekday === "Fri"
  && Number(deliveryParts.hour) === 18
  && Number(deliveryParts.minute) <= 14;
const deliveryBucket = customerReportDeliveryBucket("weekly", now, deliveryTimeZone);
const deliveryLedgerPath =
  process.env.AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_DELIVERY_LEDGER_PATH
  || "runs/ai_manual_adjustment_weekly_report_delivery_ledger.jsonl";
const deliveryKeyInput = {
  accountId: "weekly-ai",
  channel: "email",
  period: "weekly",
  bucket: deliveryBucket,
};
const previousDelivery = findCustomerReportDeliveryRecord(deliveryKeyInput, {
  ledgerPath: deliveryLedgerPath,
});
const scheduledMode =
  String(process.env.AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_SCHEDULED_MODE ?? "").trim().toLowerCase() === "true";

if (scheduledMode && !deliveryWindowOpen) {
  console.log(JSON.stringify({
    period: "weekly",
    skipped: true,
    reason: "weekly_ai_report_outside_delivery_window",
    deliveryTimeZone,
    deliveryBucket,
    emailDelivery: {
      delivered: false,
      attempted: false,
      reason: "weekly_ai_report_outside_delivery_window",
    },
    readOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  }, null, 2));
  process.exit(0);
}

if (scheduledMode && previousDelivery) {
  console.log(JSON.stringify({
    period: "weekly",
    skipped: true,
    reason: "weekly_ai_report_duplicate_delivery_bucket",
    deliveryTimeZone,
    deliveryBucket,
    emailDelivery: {
      delivered: false,
      attempted: false,
      reason: "weekly_ai_report_duplicate_delivery_bucket",
    },
    readOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  }, null, 2));
  process.exit(0);
}

const ledgerPath =
  process.env.AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH
  || DEFAULT_AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH;
const lookbackDays = 7;
const periodEnd = now;
const periodStart = new Date(periodEnd.getTime() - (lookbackDays * 86400000));
const history = listAiManualAdjustmentRecommendationRecordsInRange({
  ledgerPath,
  since: periodStart,
  until: periodEnd,
});
const report = buildAiManualAdjustmentWeeklyReport({
  records: history.records,
}, {
  now: periodEnd,
  lookbackDays,
});

const pdf = buildAiManualAdjustmentWeeklyReportPdf({ report });
const pdfPath = path.resolve(
  process.env.AI_MANUAL_ADJUSTMENT_WEEKLY_REPORT_PDF_PATH
  || "runs/ai_manual_adjustment_weekly_report.pdf",
);
fs.mkdirSync(path.dirname(pdfPath), { recursive: true, mode: 0o700 });
fs.writeFileSync(pdfPath, pdf.buffer, { mode: 0o600 });
try { fs.chmodSync(pdfPath, 0o600); } catch {}

const emailDelivery = await deliverAiManualAdjustmentWeeklyReportEmail({ report, pdf });

if (scheduledMode && emailDelivery?.delivered === true) {
  appendCustomerReportDeliveryRecord({
    ...deliveryKeyInput,
    status: "delivered",
    provider: emailDelivery?.provider,
    reason: emailDelivery?.reason,
  }, {
    ledgerPath: deliveryLedgerPath,
    now,
  });
}

console.log(JSON.stringify({
  ...report,
  sourceLedgerRecordCount: history.recordCount,
  sourceLedgerPath: ledgerPath,
  pdfPath,
  pdfFilename: pdf.filename,
  pdfContentType: pdf.contentType,
  emailDelivery,
  scheduledMode,
  deliveryTimeZone,
  deliveryBucket,
  deliveryWindowOpen,
  readOnly: true,
  paperOnly: true,
  localJsonlOnly: true,
  automaticLearningAllowed: false,
  automaticPatchAllowed: false,
  scannerLogicMutationAllowed: false,
  thresholdMutationAllowed: false,
  brokerContactAllowed: false,
  orderPlacementAllowed: false,
  accountMutationAllowed: false,
}, null, 2));
