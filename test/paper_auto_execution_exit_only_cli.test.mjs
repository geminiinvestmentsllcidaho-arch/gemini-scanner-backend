import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePaperAutoExitOnlyArgs, runPaperAutoExecutionExitOnlyCli } from '../src/scanner/paper_auto_execution_exit_only_cli.mjs'

test('parses exact EXIT-only CLI arguments without approval artifacts', () => {
  const args = parsePaperAutoExitOnlyArgs([
    '--execute=true',
    '--lifecycle-id=life-1',
    '--lifecycle-file=/tmp/life.json',
    '--symbol=BTG',
    '--quantity=1',
  ])
  assert.deepEqual(args, {
    execute: 'true',
    'lifecycle-id': 'life-1',
    'lifecycle-file': '/tmp/life.json',
    symbol: 'BTG',
    quantity: '1',
  })
  assert.equal('enter' in args, false)
})

test('fails closed without explicit execution and performs no network work', async () => {
  let calls = 0
  const result = await runPaperAutoExecutionExitOnlyCli({
    args: {
      execute: 'false',
      'lifecycle-id': 'life-1',
      'lifecycle-file': '/tmp/life.json',
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

test('uses lifecycle identity for dedicated report path without approval artifacts', async () => {
  let calls = 0
  const result = await runPaperAutoExecutionExitOnlyCli({
    argv: [
      '--execute=false',
      '--lifecycle-id=life-exit-btg-1',
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
