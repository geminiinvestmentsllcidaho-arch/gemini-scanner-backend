import {
  buildManualFirstTinyPaperOrderSubmitCommandBuilder,
  writeManualFirstTinyPaperOrderSubmitCommandBuilderReport
} from "../src/scanner/manual_first_tiny_paper_order_submit_command_builder.mjs";

const report = buildManualFirstTinyPaperOrderSubmitCommandBuilder({
  argv: process.argv.slice(2)
});

const file = writeManualFirstTinyPaperOrderSubmitCommandBuilderReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
