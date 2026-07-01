import { buildPaperPositionReadOnlyDashboardPanel, writePaperPositionReadOnlyDashboardPanel } from "../src/scanner/paper_position_readonly_dashboard_panel.mjs";
const report = buildPaperPositionReadOnlyDashboardPanel({ runsDir: "runs" });
const reportFile = writePaperPositionReadOnlyDashboardPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
