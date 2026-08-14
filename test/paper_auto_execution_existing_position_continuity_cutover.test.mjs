import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore as Store } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { readPaperAutoExecutionActiveLifecyclePointer } from '../src/scanner/paper_auto_execution_active_lifecycle_pointer.mjs'
import { cutoverExistingPaperPositionIntoContinuity as cutover } from '../src/scanner/paper_auto_execution_existing_position_continuity_cutover.mjs'

const NOW = Date.parse('2026-08-14T08:30:00Z')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gs-cutover-'))
function candidate(file, observedAt = new Date(NOW - 60000).toISOString()) {
  const s = new Store({ filePath: file, clock: () => NOW, idFactory: () => 'candidate' })
  return s.create({ selectedSymbol: 'SMCI', scannerEvidence: { source: 'paper_auto_continuity_scanner_candidate', paperOnly: true, observedAt } })
}
function legacy(file) {
  const s = new Store({ filePath: file, clock: () => NOW, idFactory: () => 'legacy' })
  s.create({ selectedSymbol: 'USAS', scannerEvidence: { observedAt: new Date(NOW - 1000).toISOString() } })
  s.transition('ENTER_SUBMITTING', { enterClientOrderId: 'cid' })
  s.transition('ENTER_OPEN', { enterBrokerOrderId: 'bo' })
  s.transition('POSITION_CONFIRMED', { filledQuantity: 1, averageFillPrice: 4.84, brokerPositionIdentity: 'USAS:1' })
  return s.transition('MONITORING')
}
const account = () => ({ ok: true, status: 'connected_readonly', observedAt: new Date(NOW).toISOString(), positions: [{ symbol: 'USAS', qty: 1, averageEntryPrice: 4.84 }], openOrders: [] })
const orders = [{ id: 'bo', client_order_id: 'cid', symbol: 'USAS', side: 'buy', status: 'filled', filled_qty: '1' }]

test('retires stale no-execution candidate, adopts exact PAPER position, and moves canonical pointer', () => {
  const d = tmp(), current = path.join(d, 'paper_auto_execution_candidate.json'), legacyFile = path.join(d, 'legacy.json'), target = path.join(d, 'paper_auto_execution_usas_adopted.json'), pointer = path.join(d, 'paper_auto_execution_active_lifecycle_pointer.json')
  candidate(current); legacy(legacyFile)
  const r = cutover({ currentLifecycleFile: current, legacyLifecycleFile: legacyFile, targetLifecycleFile: target, pointerFile: pointer, expectedSymbol: 'USAS', expectedQuantity: 1, accountSnapshot: account(), historicalOrders: orders, nowMs: NOW })
  assert.equal(r.previousLifecycle.state, 'CANDIDATE_EXPIRED')
  assert.equal(r.activeLifecycle.state, 'MONITORING')
  assert.equal(r.activeLifecycle.selectedSymbol, 'USAS')
  assert.equal(r.activeLifecycle.scannerEvidence.source, 'paper_auto_continuity_existing_position_adoption')
  assert.equal(readPaperAutoExecutionActiveLifecyclePointer({ pointerFile: pointer }), path.resolve(target))
  assert.equal(r.safety.orderPlacementAllowed, false)
})

test('fails before mutation for fresh candidate, execution evidence, symbol mismatch, or broker adoption mismatch', () => {
  let d = tmp(), current = path.join(d, 'paper_auto_execution_candidate.json'), legacyFile = path.join(d, 'legacy.json'), target = path.join(d, 'paper_auto_execution_usas_adopted.json'), pointer = path.join(d, 'paper_auto_execution_active_lifecycle_pointer.json')
  candidate(current, new Date(NOW - 1000).toISOString()); legacy(legacyFile)
  assert.throws(() => cutover({ currentLifecycleFile: current, legacyLifecycleFile: legacyFile, targetLifecycleFile: target, pointerFile: pointer, expectedSymbol: 'USAS', expectedQuantity: 1, accountSnapshot: account(), historicalOrders: orders, nowMs: NOW }), /stale_candidate/)
  assert.equal(new Store({ filePath: current }).load().state, 'CANDIDATE_SELECTED')
  d = tmp(); current = path.join(d, 'paper_auto_execution_candidate.json'); legacyFile = path.join(d, 'legacy.json'); target = path.join(d, 'paper_auto_execution_usas_adopted.json'); pointer = path.join(d, 'paper_auto_execution_active_lifecycle_pointer.json')
  candidate(current); new Store({ filePath: current }).transition('ENTER_SUBMITTING', { enterClientOrderId: 'x' }); legacy(legacyFile)
  assert.throws(() => cutover({ currentLifecycleFile: current, legacyLifecycleFile: legacyFile, targetLifecycleFile: target, pointerFile: pointer, expectedSymbol: 'USAS', expectedQuantity: 1, accountSnapshot: account(), historicalOrders: orders, nowMs: NOW }), /candidate_selected_required/)
  d = tmp(); current = path.join(d, 'paper_auto_execution_candidate.json'); legacyFile = path.join(d, 'legacy.json'); target = path.join(d, 'paper_auto_execution_usas_adopted.json'); pointer = path.join(d, 'paper_auto_execution_active_lifecycle_pointer.json')
  candidate(current); legacy(legacyFile)
  assert.throws(() => cutover({ currentLifecycleFile: current, legacyLifecycleFile: legacyFile, targetLifecycleFile: target, pointerFile: pointer, expectedSymbol: 'OTHER', expectedQuantity: 1, accountSnapshot: account(), historicalOrders: orders, nowMs: NOW }), /expected_symbol_mismatch/)
  assert.equal(fs.existsSync(target), false)
  d = tmp(); current = path.join(d, 'paper_auto_execution_candidate.json'); legacyFile = path.join(d, 'legacy.json'); target = path.join(d, 'paper_auto_execution_usas_adopted.json'); pointer = path.join(d, 'paper_auto_execution_active_lifecycle_pointer.json')
  candidate(current); legacy(legacyFile)
  assert.throws(() => cutover({ currentLifecycleFile: current, legacyLifecycleFile: legacyFile, targetLifecycleFile: target, pointerFile: pointer, expectedSymbol: 'USAS', expectedQuantity: 1, accountSnapshot: { ...account(), positions: [] }, historicalOrders: orders, nowMs: NOW }), /exact_broker_position/)
  assert.equal(new Store({ filePath: current }).load().state, 'CANDIDATE_SELECTED')
  assert.equal(fs.existsSync(target), false)
})
