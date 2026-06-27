import {
  buildManualMarketHoursPaperAttemptChecklist,
  writeManualMarketHoursPaperAttemptChecklistReport
} from "../src/scanner/manual_market_hours_paper_attempt_checklist.mjs";

const report = buildManualMarketHoursPaperAttemptChecklist({
  argv: process.argv.slice(2)
});

const file = writeManualMarketHoursPaperAttemptChecklistReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
