import {
  buildBoracFinalManualPaperAttemptDecision,
  writeBoracFinalManualPaperAttemptDecisionReport
} from "../src/scanner/borac_final_manual_paper_attempt_decision.mjs";

const report = buildBoracFinalManualPaperAttemptDecision({
  argv: process.argv.slice(2)
});

const file = writeBoracFinalManualPaperAttemptDecisionReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
