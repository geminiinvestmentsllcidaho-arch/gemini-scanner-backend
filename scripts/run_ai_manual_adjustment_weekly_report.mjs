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

process.umask(0o077);

const now = new Date();
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

console.log(JSON.stringify({
  ...report,
  sourceLedgerRecordCount: history.recordCount,
  sourceLedgerPath: ledgerPath,
  pdfPath,
  pdfFilename: pdf.filename,
  pdfContentType: pdf.contentType,
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
