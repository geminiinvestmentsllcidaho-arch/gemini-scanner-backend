import {
  buildManualFirstTinyPaperOrderSubmitScriptDryRunShell,
  writeManualFirstTinyPaperOrderSubmitScriptDryRunShellReport
} from "../src/scanner/manual_first_tiny_paper_order_submit_script_dry_run_shell.mjs";

const report = buildManualFirstTinyPaperOrderSubmitScriptDryRunShell({
  argv: process.argv.slice(2)
});

const file = writeManualFirstTinyPaperOrderSubmitScriptDryRunShellReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
