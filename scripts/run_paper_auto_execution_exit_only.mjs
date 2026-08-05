import { runPaperAutoExecutionExitOnlyCli } from '../src/scanner/paper_auto_execution_exit_only_cli.mjs'

try {
  const result = await runPaperAutoExecutionExitOnlyCli({ argv: process.argv.slice(2) })
  console.log(JSON.stringify(result, null, 2))
  if (result?.ok !== true) process.exitCode = 1
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    status: 'EXACT_POSITION_PAPER_EXIT_FAILED_CLOSED',
    error: error?.message ?? String(error),
    safety: {
      paperOnly: true,
      exitOnly: true,
      enterAllowed: false,
      liveTradingAllowed: false,
      blindRetryAllowed: false,
    },
  }, null, 2))
  process.exitCode = 1
}
