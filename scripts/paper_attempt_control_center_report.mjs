import fs from "node:fs";
import path from "node:path";
import { buildPaperAttemptControlCenter } from "../src/scanner/paper_attempt_control_center.mjs";

const report = buildPaperAttemptControlCenter();
const out = path.join(process.cwd(), "runs", `paper_attempt_control_center_${Date.now()}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

console.log(JSON.stringify({
  ok: report.ok,
  version: report.version,
  monitorOnly: report.monitorOnly,
  controlCenterStatus: report.controlCenterStatus,
  blockerCount: report.blockers.length,
  blockers: report.blockers,
  reportPath: out
}, null, 2));
