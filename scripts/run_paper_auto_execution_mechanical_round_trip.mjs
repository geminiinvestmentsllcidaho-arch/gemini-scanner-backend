import { runPaperAutoExecutionMechanicalRoundTripCli } from '../src/scanner/paper_auto_execution_mechanical_round_trip_cli.mjs'
const report = await runPaperAutoExecutionMechanicalRoundTripCli({ argv: process.argv.slice(2) })
console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
