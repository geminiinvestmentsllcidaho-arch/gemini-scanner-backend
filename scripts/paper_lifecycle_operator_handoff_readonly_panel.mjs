import {
  buildPaperLifecycleOperatorHandoffReadOnlyPanel,
  writePaperLifecycleOperatorHandoffReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleOperatorHandoffReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleOperatorHandoffReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
