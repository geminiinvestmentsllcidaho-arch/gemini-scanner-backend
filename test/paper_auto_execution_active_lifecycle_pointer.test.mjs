import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import {
  VERSION,
  writePaperAutoExecutionActiveLifecyclePointer,
  readPaperAutoExecutionActiveLifecyclePointer,
  discoverSingleNonterminalPaperAutoExecutionLifecycle,
  resolvePaperAutoExecutionActiveLifecycleFile,
} from '../src/scanner/paper_auto_execution_active_lifecycle_pointer.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'paper-active-pointer-'))

function createLifecycle(file, symbol = 'ABC') {
  return new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => `life-${symbol}` }).create({ selectedSymbol: symbol })
}

test('writes and reloads a private atomic active lifecycle pointer', () => {
  const runsDir = tmp()
  const lifecycleFile = path.join(runsDir, 'paper_auto_execution_new-life.json')
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  createLifecycle(lifecycleFile)
  const out = writePaperAutoExecutionActiveLifecyclePointer({ lifecycleFile, pointerFile })
  assert.equal(out.version, VERSION)
  assert.equal(out.lifecycleFile, path.resolve(lifecycleFile))
  assert.equal(readPaperAutoExecutionActiveLifecyclePointer({ pointerFile }), path.resolve(lifecycleFile))
  assert.equal(fs.statSync(pointerFile).mode & 0o777, 0o600)
  assert.equal(fs.readdirSync(runsDir).some((name) => name.endsWith('.tmp')), false)
})

test('restart resolver prefers durable pointer over stale configured terminal lifecycle', () => {
  const runsDir = tmp()
  const fresh = path.join(runsDir, 'paper_auto_execution_fresh.json')
  const stale = path.join(runsDir, 'paper_auto_execution_stale.json')
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  createLifecycle(fresh, 'NEW')
  const oldStore = new PaperAutoExecutionLifecycleStore({ filePath: stale, idFactory: () => 'old' })
  oldStore.create({ selectedSymbol: 'BTG' })
  oldStore.transition('FAILED_NEEDS_REVIEW')
  writePaperAutoExecutionActiveLifecyclePointer({ lifecycleFile: fresh, pointerFile })
  assert.equal(resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: stale }), path.resolve(fresh))
})

test('restart resolver recovers exactly one nonterminal continuity lifecycle when pointer is absent', () => {
  const runsDir = tmp()
  const fresh = path.join(runsDir, 'paper_auto_execution_recovered.json')
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  createLifecycle(fresh, 'REC')
  assert.equal(discoverSingleNonterminalPaperAutoExecutionLifecycle({ runsDir, pointerFile }), path.resolve(fresh))
  assert.equal(resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: '/tmp/old.json' }), path.resolve(fresh))
})

test('multiple nonterminal continuity lifecycle files fail closed instead of selecting one', () => {
  const runsDir = tmp()
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  createLifecycle(path.join(runsDir, 'paper_auto_execution_a.json'), 'AAA')
  createLifecycle(path.join(runsDir, 'paper_auto_execution_b.json'), 'BBB')
  assert.throws(
    () => resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: '/tmp/old.json' }),
    /multiple_nonterminal_continuity_lifecycles/,
  )
})

test('corrupt pointer and missing target fail closed without configured fallback', () => {
  const runsDir = tmp()
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  fs.writeFileSync(pointerFile, '{bad', { mode: 0o600 })
  assert.throws(
    () => resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: '/tmp/old.json' }),
    /pointer_corrupt/,
  )
  fs.writeFileSync(pointerFile, JSON.stringify({
    version: VERSION,
    lifecycleFile: path.join(runsDir, 'paper_auto_execution_missing.json'),
  }), { mode: 0o600 })
  assert.throws(
    () => resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: '/tmp/old.json' }),
    /target_missing/,
  )
})

test('pointer target is constrained to continuity lifecycle files inside its runs directory', () => {
  const runsDir = tmp()
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  const outside = path.join(tmp(), 'paper_auto_execution_outside.json')
  createLifecycle(outside, 'OUT')
  assert.throws(
    () => writePaperAutoExecutionActiveLifecyclePointer({ lifecycleFile: outside, pointerFile }),
    /path_outside_runs/,
  )
})
