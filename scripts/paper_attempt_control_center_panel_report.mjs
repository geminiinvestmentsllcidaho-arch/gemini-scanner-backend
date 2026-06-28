import { writePanelReport } from "../src/scanner/paper_attempt_control_center_panel.mjs";

const { panel, out } = writePanelReport();

console.log(JSON.stringify({
  ok: panel.ok,
  version: panel.version,
  monitorOnly: panel.monitorOnly,
  diagnosticsOnly: panel.diagnosticsOnly,
  panelType: panel.panelType,
  operatorStatus: panel.operatorStatus,
  paperAttemptAllowed: panel.paperAttemptAllowed,
  blockerCount: panel.blockers.length,
  failedChecklistCount: panel.failedChecklist.length,
  reportPath: out
}, null, 2));
