import { readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet_history.mjs'

const args = Object.fromEntries(process.argv.slice(2).filter((v) => v.startsWith('--')).map((v) => {
  const [key, ...rest] = v.slice(2).split('=')
  return [key, rest.length ? rest.join('=') : 'true']
}))
const report = readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory({
  runsDir: args['runs-dir'] ?? 'runs',
  limit: args.limit,
})
console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
