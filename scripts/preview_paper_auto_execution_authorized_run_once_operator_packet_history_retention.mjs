import { inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet_history_retention.mjs'

const args = Object.fromEntries(process.argv.slice(2).filter((value) => value.startsWith('--')).map((value) => {
  const [key, ...rest] = value.slice(2).split('=')
  return [key, rest.length ? rest.join('=') : 'true']
}))
const report = inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention({
  runsDir: args['runs-dir'] ?? 'runs',
  retentionDays: args['retention-days'],
  maxRecords: args['max-records'],
  maxBytes: args['max-bytes'],
  nowMs: args['now-ms'],
})
console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
