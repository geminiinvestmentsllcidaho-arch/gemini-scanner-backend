import {
  buildPaperPositionPnlReadOnlyBaselinePanel,
  writePaperPositionPnlReadOnlyBaselinePanel
} from "../src/scanner/paper_position_pnl_readonly_baseline_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperPositionPnlReadOnlyBaselinePanel({ runsDir: "runs", markPrice });
const reportFile = writePaperPositionPnlReadOnlyBaselinePanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
