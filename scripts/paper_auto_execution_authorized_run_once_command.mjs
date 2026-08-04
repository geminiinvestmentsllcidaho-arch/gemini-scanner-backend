import {
  runPaperAutoExecutionAuthorizedRunOnceCommand,
  writePaperAutoExecutionAuthorizedRunOnceCommandReport,
} from '../src/scanner/paper_auto_execution_authorized_run_once_command_tool.mjs'

const report = await runPaperAutoExecutionAuthorizedRunOnceCommand({
  argv: process.argv.slice(2),
})
const reportFile = writePaperAutoExecutionAuthorizedRunOnceCommandReport(report)
console.log(JSON.stringify({ ...report, reportFile }, null, 2))
process.exit(report.ok ? 0 : 1)
