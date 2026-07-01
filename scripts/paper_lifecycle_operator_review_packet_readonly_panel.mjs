import {
  buildPaperLifecycleOperatorReviewPacketReadOnlyPanel,
  writePaperLifecycleOperatorReviewPacketReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_review_packet_readonly_panel.mjs";

const markArg = process.argv.find((arg) => arg.startsWith("--mark="));
const markPrice = markArg ? Number(markArg.slice("--mark=".length)) : null;
const report = buildPaperLifecycleOperatorReviewPacketReadOnlyPanel({ runsDir: "runs", markPrice });
const reportFile = writePaperLifecycleOperatorReviewPacketReadOnlyPanel(report);
console.log(JSON.stringify({ ...report, reportFile }, null, 2));
