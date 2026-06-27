import {
  buildFirstTinyPaperOrderSubmitPreflightGate,
  writeFirstTinyPaperOrderSubmitPreflightGateReport
} from "../src/scanner/first_tiny_paper_order_submit_preflight_gate.mjs";

const report = buildFirstTinyPaperOrderSubmitPreflightGate({
  argv: process.argv.slice(2)
});

const file = writeFirstTinyPaperOrderSubmitPreflightGateReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
