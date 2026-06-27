import {
  buildControlledFirstTinyPaperOrderPreflight,
  writeControlledFirstTinyPaperOrderPreflightReport
} from "../src/scanner/controlled_first_tiny_paper_order_preflight.mjs";

const report = buildControlledFirstTinyPaperOrderPreflight({
  argv: process.argv.slice(2)
});

const file = writeControlledFirstTinyPaperOrderPreflightReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));

if (report.status !== "blocked") {
  process.exitCode = 0;
}
