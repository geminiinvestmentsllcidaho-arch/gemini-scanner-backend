import {
  buildPaperLifecycleEvidenceBundleReadOnlyPanel,
  writePaperLifecycleEvidenceBundleReadOnlyPanel
} from "../src/scanner/paper_lifecycle_evidence_bundle_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleEvidenceBundleReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleEvidenceBundleReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
