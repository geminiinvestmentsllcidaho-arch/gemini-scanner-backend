import {
  buildPaperLifecycleOperatorSummaryReadOnlyPanel,
  writePaperLifecycleOperatorSummaryReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_summary_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleOperatorSummaryReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleOperatorSummaryReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
