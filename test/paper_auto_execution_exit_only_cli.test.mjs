import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePaperAutoExitOnlyArgs, runPaperAutoExecutionExitOnlyCli } from '../src/scanner/paper_auto_execution_exit_only_cli.mjs'

test('parses exact EXIT-only CLI arguments without widening scope', () => {
  const args = parsePaperAutoExitOnlyArgs([
    '--execute=true',
    '--operator=Borac',
    '--authorization-id=exit-1',
    '--lifecycle-id=life-1',
    '--symbol=BTG',
    '--quantity=1',
    '--phrase=a=b',
  ])
  assert.deepEqual(args, {
    execute: 'true',
    operator: 'Borac',
    'authorization-id': 'exit-1',
    'lifecycle-id': 'life-1',
    symbol: 'BTG',
    quantity: '1',
    phrase: 'a=b',
  })
  assert.equal('enter' in args, false)
})

test('fails closed without explicit execution and performs no network work', async () => {
  let calls = 0
  const result = await runPaperAutoExecutionExitOnlyCli({
    args: {
      execute: 'false',
      operator: 'Borac',
      'authorization-id': 'exit-1',
      'lifecycle-id': 'life-1',
      symbol: 'BTG',
      quantity: '1',
    },
    env: {},
    fetchImpl: async () => {
      calls += 1
      throw new Error('network forbidden')
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 'EXIT_ONLY_BLOCKED')
  assert.ok(result.blockers.includes('explicit_execute_true_required'))
  assert.equal(calls, 0)
})

test('derives a dedicated report path from the authorization id', async () => {
  let calls = 0
  const result = await runPaperAutoExecutionExitOnlyCli({
    argv: [
      '--execute=false',
      '--authorization-id=exit-btg-1',
    ],
    runsDir: '/tmp/gs-exit-only-cli-test',
    env: {},
    fetchImpl: async () => {
      calls += 1
      throw new Error('network forbidden')
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 'EXIT_ONLY_BLOCKED')
  assert.equal(calls, 0)
})
