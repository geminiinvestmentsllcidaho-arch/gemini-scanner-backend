import {
  buildPaperLifecycleRouteRegistryReadOnlyPanel,
  writePaperLifecycleRouteRegistryReadOnlyPanel
} from "../src/scanner/paper_lifecycle_route_registry_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleRouteRegistryReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleRouteRegistryReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
