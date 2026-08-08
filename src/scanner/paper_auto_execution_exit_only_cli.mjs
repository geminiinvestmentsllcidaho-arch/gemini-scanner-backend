import path from 'node:path'
import { runPaperAutoExecutionExitOnly } from './paper_auto_execution_exit_only_runner.mjs'

export const VERSION = 'paper_auto_execution_exit_only_cli_v1'
const clean = (value) => String(value ?? '').trim()

export function parsePaperAutoExitOnlyArgs(argv = []) {
  return Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('=')
    return [key, rest.length ? rest.join('=') : 'true']
  }))
}

export async function runPaperAutoExecutionExitOnlyCli(options = {}) {
  const args = options.args ?? parsePaperAutoExitOnlyArgs(options.argv ?? [])
  const lifecycleId = clean(args['lifecycle-id'])
  const runsDir = options.runsDir ?? 'runs'
  const reportFile = options.reportFile ??
    (lifecycleId ? path.join(runsDir, `paper_auto_exit_only_${lifecycleId}.json`) : undefined)

  return runPaperAutoExecutionExitOnly({
    args: {
      execute: args.execute,
      lifecycleId,
      symbol: clean(args.symbol).toUpperCase(),
      quantity: args.quantity,
      lifecycleFile: args['lifecycle-file'],
    },
    env: options.env ?? process.env,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    nowMs: options.nowMs,
    reportFile,
  })
}

export default {
  VERSION,
  parsePaperAutoExitOnlyArgs,
  runPaperAutoExecutionExitOnlyCli,
}
