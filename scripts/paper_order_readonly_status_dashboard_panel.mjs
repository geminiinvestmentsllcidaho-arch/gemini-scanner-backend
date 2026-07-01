import { buildPaperOrderReadonlyStatusDashboardPanel, writePaperOrderReadonlyStatusDashboardPanel } from "../src/scanner/paper_order_readonly_status_dashboard_panel.mjs";
const report = buildPaperOrderReadonlyStatusDashboardPanel({ runsDir: "runs" });
const reportFile = writePaperOrderReadonlyStatusDashboardPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
