import {
  buildPaperAutoExecutionAuthorizedRunOnceRunbook,
  writePaperAutoExecutionAuthorizedRunOnceRunbook,
} from '../src/scanner/paper_auto_execution_authorized_run_once_runbook.mjs'

const args = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith('--')).map((x) => {
  const [key, ...rest] = x.slice(2).split('=')
  return [key, rest.length ? rest.join('=') : 'true']
}))

const report = buildPaperAutoExecutionAuthorizedRunOnceRunbook({
  authorizationId: args['authorization-id'],
  expiresAtMs: args['expires-at-ms'],
  latchFile: args.latch,
})
const reportFile = writePaperAutoExecutionAuthorizedRunOnceRunbook(report)
console.log(JSON.stringify({ ...report, reportFile }, null, 2))
process.exit(report.previewReady ? 0 : 1)
