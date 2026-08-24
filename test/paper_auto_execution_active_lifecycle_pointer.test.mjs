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
  discoverNonterminalPaperAutoExecutionLifecycles,
  discoverSingleNonterminalPaperAutoExecutionLifecycle,
  resolvePaperAutoExecutionActiveLifecycleFile,
} from '../src/scanner/paper_auto_execution_active_lifecycle_pointer.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'paper-active-pointer-'))

function createLifecycle(file, symbol = 'ABC', { continuityOwned = false } = {}) {
  return new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => `life-${symbol}` }).create({
    selectedSymbol: symbol,
    ...(continuityOwned ? { scannerEvidence: { source: 'paper_auto_continuity_scanner_candidate', symbol, state: 'ENTER', score: 99, paperOnly: true } } : {}),
  })
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
  createLifecycle(fresh, 'REC', { continuityOwned: true })
  assert.equal(discoverSingleNonterminalPaperAutoExecutionLifecycle({ runsDir, pointerFile }), path.resolve(fresh))
  assert.equal(resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: '/tmp/old.json' }), path.resolve(fresh))
})

test('restart discovery ignores terminal expired continuity lifecycle', () => {
  const runsDir = tmp()
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  const expired = path.join(runsDir, 'paper_auto_execution_expired.json')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: expired, idFactory: () => 'expired-life' })
  store.create({
    selectedSymbol: 'OLD',
    scannerEvidence: {
      source: 'paper_auto_continuity_scanner_candidate',
      observedAt: '2026-08-13T01:00:00Z',
      symbol: 'OLD',
      state: 'ENTER',
      score: 99,
      paperOnly: true,
    },
  })
  store.transition('CANDIDATE_EXPIRED')
  assert.equal(discoverSingleNonterminalPaperAutoExecutionLifecycle({ runsDir, pointerFile }), null)
  assert.equal(resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: '' }), '')
})

test('multi-lifecycle discovery returns all owned nonterminal lifecycles deterministically', () => {
  const runsDir = tmp()
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  createLifecycle(path.join(runsDir, 'paper_auto_execution_b.json'), 'BBB', { continuityOwned: true })
  createLifecycle(path.join(runsDir, 'paper_auto_execution_a.json'), 'AAA', { continuityOwned: true })
  const rows = discoverNonterminalPaperAutoExecutionLifecycles({ runsDir, pointerFile })
  assert.deepEqual(rows.map(row => row.lifecycle.selectedSymbol), ['AAA','BBB'])
  assert.equal(rows.every(row => path.isAbsolute(row.file)), true)
})

test('multiple nonterminal continuity lifecycle files fail closed instead of selecting one', () => {
  const runsDir = tmp()
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  createLifecycle(path.join(runsDir, 'paper_auto_execution_a.json'), 'AAA', { continuityOwned: true })
  createLifecycle(path.join(runsDir, 'paper_auto_execution_b.json'), 'BBB', { continuityOwned: true })
  assert.throws(
    () => resolvePaperAutoExecutionActiveLifecycleFile({ pointerFile, configuredLifecycleFile: '/tmp/old.json' }),
    /multiple_nonterminal_continuity_lifecycles/,
  )
})

test('restart discovery owns canonical adopted PAPER monitoring lifecycle',()=>{const runsDir=tmp(),pointerFile=path.join(runsDir,'paper_auto_execution_active_lifecycle_pointer.json'),f=path.join(runsDir,'paper_auto_execution_adopted.json'),s=new PaperAutoExecutionLifecycleStore({filePath:f,idFactory:()=> 'adopted'});s.create({selectedSymbol:'USAS',scannerEvidence:{source:'paper_auto_continuity_existing_position_adoption',paperOnly:true}});s.transition('ENTER_SUBMITTING',{enterClientOrderId:'cid'});s.transition('ENTER_OPEN',{enterBrokerOrderId:'bo'});s.transition('POSITION_CONFIRMED',{filledQuantity:1,brokerPositionIdentity:'USAS:1'});s.transition('MONITORING');assert.equal(discoverSingleNonterminalPaperAutoExecutionLifecycle({runsDir,pointerFile}),path.resolve(f))})

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


test('discovery ignores unrelated valid and invalid generic paper auto artifacts without claiming ownership', () => {
  const runsDir = tmp()
  const pointerFile = path.join(runsDir, 'paper_auto_execution_active_lifecycle_pointer.json')
  const owned = path.join(runsDir, 'paper_auto_execution_owned.json')
  createLifecycle(owned, 'OWN', { continuityOwned: true })
  createLifecycle(path.join(runsDir, 'paper_auto_execution_unowned.json'), 'OTHER')
  fs.writeFileSync(path.join(runsDir, 'paper_auto_execution_authorized_run_once_operator_packet_blocked.json'), '{not-a-lifecycle', { mode: 0o600 })
  assert.equal(discoverSingleNonterminalPaperAutoExecutionLifecycle({ runsDir, pointerFile }), path.resolve(owned))
})
