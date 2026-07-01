import {
  buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel,
  writePaperLifecycleOperatorHandoffPacketReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_packet_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleOperatorHandoffPacketReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
