import { writePaperAttemptSafetyFinalizationReport } from "../src/scanner/paper_attempt_safety_finalization.mjs";

const report = writePaperAttemptSafetyFinalizationReport();

console.log(JSON.stringify({
  ok: report.ok,
  version: report.version,
  status: report.status,
  safety: report.safety,
  requiredScripts: report.requiredScripts,
  artifacts: report.artifacts,
  warnings: report.warnings,
  output: report.output,
  nextActions: report.nextActions
}, null, 2));

console.log("");
console.log(report.compactHandoff);
