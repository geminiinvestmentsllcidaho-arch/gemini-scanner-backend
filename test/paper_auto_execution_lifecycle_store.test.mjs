import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-'))
  const filePath = path.join(dir, 'state.json')
  let tick = Date.parse('2026-08-04T03:57:00.000Z')
  return {
    filePath,
    store: new PaperAutoExecutionLifecycleStore({
      filePath,
      clock: () => tick++,
      idFactory: () => 'lifecycle-1',
    }),
  }
}

test('enforces one active lifecycle and immutable symbol', () => {
  const { store } = fixture()
  store.create({ selectedSymbol: 'spy' })
  assert.throws(() => store.create({ selectedSymbol: 'AAPL' }), /active_lifecycle_exists/)
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-1' })
  assert.throws(() => store.transition(S.ENTER_UNKNOWN, { selectedSymbol: 'AAPL' }), /selected_symbol_immutable/)
})

test('unresolved enter blocks new lifecycle and restart reloads exact state', () => {
  const { filePath, store } = fixture()
  store.create({ selectedSymbol: 'SPY', scannerEvidence: { rank: 1 } })
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-1' })
  store.transition(S.ENTER_UNKNOWN)
  assert.throws(() => store.create({ selectedSymbol: 'AAPL' }), /active_lifecycle_exists/)
  const restarted = new PaperAutoExecutionLifecycleStore({ filePath })
  assert.deepEqual(restarted.load(), store.load())
})

test('confirmed position moves to monitoring and exit target must match exact position', () => {
  const { store } = fixture()
  store.create({ selectedSymbol: 'SPY' })
  store.transition(S.ENTER_SUBMITTING)
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 1, averageFillPrice: 630 })
  store.transition(S.MONITORING)
  assert.equal(store.assertExitTarget({ symbol: 'SPY', quantity: 1 }), true)
  assert.throws(() => store.assertExitTarget({ symbol: 'AAPL', quantity: 1 }), /exit_symbol_mismatch/)
  assert.throws(() => store.assertExitTarget({ symbol: 'SPY', quantity: 2 }), /exit_quantity_mismatch/)
})

test('completed lifecycle permits a later lifecycle', () => {
  const { store } = fixture()
  store.create({ selectedSymbol: 'SPY' })
  store.transition(S.ENTER_SUBMITTING)
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 1 })
  store.transition(S.EXIT_TRIGGERED)
  store.transition(S.EXIT_SUBMITTING)
  store.transition(S.ROUND_TRIP_COMPLETED)
  store.resetToIdle()
  assert.equal(store.create({ selectedSymbol: 'AAPL' }).selectedSymbol, 'AAPL')
})

test('corrupt or incomplete state fails closed', () => {
  const { filePath, store } = fixture()
  fs.writeFileSync(filePath, '{bad-json')
  assert.throws(() => store.load(), /state_corrupt/)
  fs.writeFileSync(filePath, JSON.stringify({ version: 'paper_auto_execution_lifecycle_v1' }))
  assert.throws(() => store.load(), /state_missing/)
})

test('focused store tests perform no network or broker contact', () => {
  const { store } = fixture()
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => {
    called = true
    throw new Error('network forbidden')
  }
  try {
    store.create({ selectedSymbol: 'SPY' })
    store.transition(S.ENTER_SUBMITTING)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('patchMonitoring atomically updates scale reconciliation fields while preserving canonical identities and MONITORING state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-monitor-patch-'))
  const file = path.join(dir, 'life.json')
  let now = Date.parse('2026-08-14T15:00:00Z')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: file, clock: () => now, idFactory: () => 'life-scale-patch' })
  store.create({ selectedSymbol: 'ABC' })
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-original' })
  store.transition(S.ENTER_OPEN, { enterBrokerOrderId: 'enter-broker-original' })
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 8, averageFillPrice: 10, brokerPositionIdentity: 'ABC:8' })
  store.transition(S.MONITORING)

  now += 1000
  const patched = store.patchMonitoring({
    expectedLifecycleId: 'life-scale-patch',
    expectedSymbol: 'ABC',
    expectedFromQuantity: 8,
    filledQuantity: 6,
    averageFillPrice: 9.75,
    brokerPositionIdentity: 'ABC:6',
    reconciliationEntry: { kind: 'paper_scale_action_filled', action: 'scale_out', orderQuantity: 2 },
  })

  assert.equal(patched.state, S.MONITORING)
  assert.equal(patched.lifecycleId, 'life-scale-patch')
  assert.equal(patched.selectedSymbol, 'ABC')
  assert.equal(patched.filledQuantity, 6)
  assert.equal(patched.averageFillPrice, 9.75)
  assert.equal(patched.brokerPositionIdentity, 'ABC:6')
  assert.equal(patched.enterClientOrderId, 'enter-original')
  assert.equal(patched.enterBrokerOrderId, 'enter-broker-original')
  assert.equal(patched.exitClientOrderId, null)
  assert.equal(patched.exitBrokerOrderId, null)
  assert.equal(patched.reconciliation.at(-1).kind, 'paper_scale_action_filled')
  assert.equal(store.load().filledQuantity, 6)
})

test('patchMonitoring fails closed outside MONITORING and rejects forbidden or non-whole quantity changes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-monitor-patch-blocked-'))
  const file = path.join(dir, 'life.json')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: file, idFactory: () => 'life-scale-blocked' })
  store.create({ selectedSymbol: 'ABC' })
  assert.throws(() => store.patchMonitoring({ filledQuantity: 2 }), /monitoring_patch_invalid_state/)

  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'enter-original' })
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 8, brokerPositionIdentity: 'ABC:8' })
  store.transition(S.MONITORING)

  const expected = { expectedLifecycleId: 'life-scale-blocked', expectedSymbol: 'ABC', expectedFromQuantity: 8 }
  assert.throws(() => store.patchMonitoring({ ...expected, selectedSymbol: 'XYZ' }), /monitoring_patch_forbidden:selectedSymbol/)
  assert.throws(() => store.patchMonitoring({ ...expected, state: S.EXIT_TRIGGERED }), /monitoring_patch_forbidden:state/)
  assert.throws(() => store.patchMonitoring({ ...expected, enterClientOrderId: 'changed' }), /monitoring_patch_forbidden:enterClientOrderId/)
  assert.throws(() => store.patchMonitoring({ ...expected, reconciliation: [] }), /monitoring_patch_forbidden:reconciliation/)
  assert.throws(() => store.patchMonitoring({ ...expected, filledQuantity: 6.5 }), /monitoring_patch_whole_quantity_required/)
  assert.throws(() => store.patchMonitoring({ ...expected, expectedLifecycleId: 'other' }), /monitoring_patch_lifecycle_changed/)
  assert.throws(() => store.patchMonitoring({ ...expected, expectedSymbol: 'XYZ' }), /monitoring_patch_symbol_changed/)
  assert.throws(() => store.patchMonitoring({ ...expected, expectedFromQuantity: 7 }), /monitoring_patch_quantity_changed/)
  assert.equal(store.load().filledQuantity, 8)
  assert.equal(store.load().state, S.MONITORING)
})


test('armMechanicalAutoExitProof arms only exact MONITORING lifecycle identity and is idempotent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-exit-proof-arm-'))
  const file = path.join(dir, 'life.json')
  let now = Date.parse('2026-08-15T21:00:00Z')
  const store = new PaperAutoExecutionLifecycleStore({ filePath: file, clock: () => now, idFactory: () => 'life-exit-proof' })
  store.create({ selectedSymbol: 'USAS', scannerEvidence: { source: 'paper_auto_continuity_existing_position_adoption', mechanicalAutoExitProof: false } })
  store.transition(S.ENTER_SUBMITTING, { enterClientOrderId: 'existing-paper-position-adopted' })
  store.transition(S.POSITION_CONFIRMED, { filledQuantity: 1, averageFillPrice: 4.84, brokerPositionIdentity: 'USAS:1' })
  store.transition(S.MONITORING)

  assert.throws(() => store.armMechanicalAutoExitProof({ expectedLifecycleId: 'other', expectedSymbol: 'USAS', expectedQuantity: 1 }), /exit_proof_arm_lifecycle_changed/)
  assert.throws(() => store.armMechanicalAutoExitProof({ expectedLifecycleId: 'life-exit-proof', expectedSymbol: 'BTG', expectedQuantity: 1 }), /exit_proof_arm_symbol_changed/)
  assert.throws(() => store.armMechanicalAutoExitProof({ expectedLifecycleId: 'life-exit-proof', expectedSymbol: 'USAS', expectedQuantity: 2 }), /exit_proof_arm_quantity_changed/)

  now += 1000
  const armed = store.armMechanicalAutoExitProof({ expectedLifecycleId: 'life-exit-proof', expectedSymbol: 'USAS', expectedQuantity: 1 })
  assert.equal(armed.state, S.MONITORING)
  assert.equal(armed.lifecycleId, 'life-exit-proof')
  assert.equal(armed.selectedSymbol, 'USAS')
  assert.equal(armed.filledQuantity, 1)
  assert.equal(armed.brokerPositionIdentity, 'USAS:1')
  assert.equal(armed.scannerEvidence.source, 'paper_auto_continuity_existing_position_adoption')
  assert.equal(armed.scannerEvidence.mechanicalAutoExitProof, true)
  const armedUpdatedAt = armed.updatedAt

  now += 1000
  const repeated = store.armMechanicalAutoExitProof({ expectedLifecycleId: 'life-exit-proof', expectedSymbol: 'USAS', expectedQuantity: 1 })
  assert.equal(repeated.scannerEvidence.mechanicalAutoExitProof, true)
  assert.equal(repeated.updatedAt, armedUpdatedAt)
  assert.equal(store.load().updatedAt, armedUpdatedAt)
})

test('armMechanicalAutoExitProof fails closed outside MONITORING', () => {
  const { store } = fixture()
  const created = store.create({ selectedSymbol: 'USAS', scannerEvidence: { mechanicalAutoExitProof: false } })
  assert.throws(
    () => store.armMechanicalAutoExitProof({ expectedLifecycleId: created.lifecycleId, expectedSymbol: 'USAS', expectedQuantity: 1 }),
    /exit_proof_arm_invalid_state:CANDIDATE_SELECTED/,
  )
  assert.equal(store.load().scannerEvidence.mechanicalAutoExitProof, false)
})

test('patchExitRecovery persists same-state reconciliation and immutable broker order identity', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paper-auto-exit-recovery-'))
  try {
    const store=new PaperAutoExecutionLifecycleStore({filePath:path.join(dir,'state.json'),clock:()=>Date.parse('2026-08-16T20:35:00Z'),idFactory:()=>'life-exit-recovery'})
    store.create({selectedSymbol:'ABC'})
    store.transition(S.ENTER_SUBMITTING,{enterClientOrderId:'enter-1'})
    store.transition(S.POSITION_CONFIRMED,{filledQuantity:2,brokerPositionIdentity:'ABC:2'})
    store.transition(S.EXIT_TRIGGERED,{exitClientOrderId:'exit-1'})
    store.transition(S.EXIT_SUBMITTING)
    const patched=store.patchExitRecovery({expectedLifecycleId:'life-exit-recovery',expectedSymbol:'ABC',expectedState:S.EXIT_SUBMITTING,exitBrokerOrderId:'broker-exit-1',reconciliation:[{kind:"exit_recovery"}]})
    assert.equal(patched.state,S.EXIT_SUBMITTING)
    assert.equal(patched.exitBrokerOrderId,'broker-exit-1')
    assert.equal(patched.reconciliation.length,1)
    assert.throws(()=>store.patchExitRecovery({expectedLifecycleId:'life-exit-recovery',expectedSymbol:'ABC',expectedState:S.EXIT_SUBMITTING,exitBrokerOrderId:'broker-exit-2'}),/broker_order_id_changed/)
    assert.throws(()=>store.patchExitRecovery({expectedLifecycleId:'life-exit-recovery',expectedSymbol:'ABC',expectedState:S.EXIT_SUBMITTING,filledQuantity:1}),/forbidden:filledQuantity/)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})
