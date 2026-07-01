import {
  buildPaperLifecycleFinalStatusReadOnlyPanel,
  writePaperLifecycleFinalStatusReadOnlyPanel
} from "../src/scanner/paper_lifecycle_final_status_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleFinalStatusReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleFinalStatusReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
