import {
  buildPaperLifecycleEvidenceIndexReadOnlyPanel,
  writePaperLifecycleEvidenceIndexReadOnlyPanel
} from "../src/scanner/paper_lifecycle_evidence_index_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleEvidenceIndexReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleEvidenceIndexReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
