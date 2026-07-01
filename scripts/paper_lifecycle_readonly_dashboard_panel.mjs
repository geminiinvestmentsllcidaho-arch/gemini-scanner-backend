import {
  buildPaperLifecycleReadOnlyDashboardPanel,
  writePaperLifecycleReadOnlyDashboardPanel
} from "../src/scanner/paper_lifecycle_readonly_dashboard_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleReadOnlyDashboardPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleReadOnlyDashboardPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
