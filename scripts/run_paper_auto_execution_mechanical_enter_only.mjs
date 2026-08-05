import { runPaperAutoExecutionMechanicalEnterOnlyCli } from '../src/scanner/paper_auto_execution_mechanical_enter_only_cli.mjs'
const result = await runPaperAutoExecutionMechanicalEnterOnlyCli({ argv: process.argv.slice(2) })
console.log(JSON.stringify(result, null, 2))
if (result?.ok !== true) process.exitCode = 1
