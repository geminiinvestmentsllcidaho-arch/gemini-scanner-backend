import {
  buildFinalOneShotPaperBrokerAttemptRunbook,
  writeFinalOneShotPaperBrokerAttemptRunbookReport
} from "../src/scanner/final_one_shot_paper_broker_attempt_runbook.mjs";

const report = buildFinalOneShotPaperBrokerAttemptRunbook({
  argv: process.argv.slice(2)
});

const file = writeFinalOneShotPaperBrokerAttemptRunbookReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
