import {
  runPaperAutoExecutionAlpacaPaperAuthorizedCommand,
} from '../src/scanner/paper_auto_execution_alpaca_paper_authorized_command.mjs'
import { resolve } from 'node:path'
import {
  writePaperAutoExecutionAuthorizedRunOnceCommandReport,
} from '../src/scanner/paper_auto_execution_authorized_run_once_command_tool.mjs'

const report = await runPaperAutoExecutionAlpacaPaperAuthorizedCommand({
  argv: process.argv.slice(2),
})
const reportFile = resolve(writePaperAutoExecutionAuthorizedRunOnceCommandReport(report))
console.log(JSON.stringify({ ...report, reportFile }, null, 2))
process.exit(report.ok ? 0 : 1)
