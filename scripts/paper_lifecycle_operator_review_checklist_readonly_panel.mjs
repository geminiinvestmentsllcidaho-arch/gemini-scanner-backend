import {
  buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel,
  writePaperLifecycleOperatorReviewChecklistReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_review_checklist_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleOperatorReviewChecklistReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
