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
  const authorizationId = clean(args['authorization-id'])
  const runsDir = options.runsDir ?? 'runs'
  const reportFile = options.reportFile ??
    (authorizationId ? path.join(runsDir, `paper_auto_exit_only_${authorizationId}.json`) : undefined)

  return runPaperAutoExecutionExitOnly({
    args: {
      execute: args.execute,
      operator: args.operator,
      authorizationId,
      phrase: args.phrase,
      scope: args.scope,
      lifecycleId: clean(args['lifecycle-id']),
      symbol: clean(args.symbol).toUpperCase(),
      quantity: args.quantity,
      expiresAtMs: args['expires-at-ms'],
      latch: args.latch,
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
