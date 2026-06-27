import {
  buildManualFirstTinyPaperOrderOneShotSubmitExecutor,
  writeManualFirstTinyPaperOrderOneShotSubmitExecutorReport
} from "../src/scanner/manual_first_tiny_paper_order_one_shot_submit_executor.mjs";

const report = buildManualFirstTinyPaperOrderOneShotSubmitExecutor({
  argv: process.argv.slice(2)
});

const file = writeManualFirstTinyPaperOrderOneShotSubmitExecutorReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
