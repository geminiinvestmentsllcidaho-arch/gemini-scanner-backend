import {
  buildPaperLifecycleCompletionSealReadOnlyPanel,
  writePaperLifecycleCompletionSealReadOnlyPanel
} from "../src/scanner/paper_lifecycle_completion_seal_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleCompletionSealReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleCompletionSealReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
