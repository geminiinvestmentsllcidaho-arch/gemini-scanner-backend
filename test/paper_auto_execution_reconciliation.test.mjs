import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcilePaperAutoExecution } from '../src/scanner/paper_auto_execution_reconciliation.mjs'
import { STATES as S } from '../src/scanner/paper_auto_execution_state_machine.mjs'

const base = Object.freeze({
  lifecycleId: 'life-1',
  state: S.ENTER_UNKNOWN,
  selectedSymbol: 'SPY',
  enterClientOrderId: 'enter-1',
  exitClientOrderId: null,
  reconciliation: [],
})

test('reconciles ambiguous enter from broker-authoritative position', () => {
  const result = reconcilePaperAutoExecution({
    lifecycle: base,
    orders: [{ id: 'broker-order-1', client_order_id: 'enter-1', symbol: 'SPY', side: 'buy', status: 'filled', filled_qty: '1', filled_avg_price: '630.25' }],
    positions: [{ asset_id: 'asset-spy', symbol: 'SPY', qty: '1', avg_entry_price: '630.25' }],
  })
  assert.equal(result.nextState, S.POSITION_CONFIRMED)
  assert.equal(result.patch.filledQuantity, 1)
  assert.equal(result.patch.enterBrokerOrderId, 'broker-order-1')
  assert.equal(result.patch.brokerPositionIdentity, 'asset-spy')
})

test('fails closed when ambiguous enter identity cannot be found', () => {
  const result = reconcilePaperAutoExecution({ lifecycle: base, orders: [], positions: [] })
  assert.equal(result.nextState, S.UNRESOLVED_NEEDS_RECONCILIATION)
  assert.deepEqual(result.blockers, ['enter_identity_not_found'])
})

test('reconciles exact exit completion only when position is absent and exit order filled', () => {
  const lifecycle = { ...base, state: S.EXIT_UNKNOWN, filledQuantity: 1, exitClientOrderId: 'exit-1' }
  const complete = reconcilePaperAutoExecution({
    lifecycle,
    orders: [{ id: 'broker-exit-1', client_order_id: 'exit-1', symbol: 'SPY', side: 'sell', status: 'filled', filled_qty: '1' }],
    positions: [],
  })
  assert.equal(complete.nextState, S.ROUND_TRIP_COMPLETED)
  assert.equal(complete.patch.exitBrokerOrderId, 'broker-exit-1')

  const stillOpen = reconcilePaperAutoExecution({
    lifecycle,
    orders: [{ id: 'broker-exit-1', client_order_id: 'exit-1', symbol: 'SPY', side: 'sell', status: 'open', filled_qty: '0' }],
    positions: [{ asset_id: 'asset-spy', symbol: 'SPY', qty: '1', avg_entry_price: '630.25' }],
  })
  assert.equal(stillOpen.nextState, S.EXIT_SUBMITTING)
})

test('reconciliation performs no broker contact or mutation', () => {
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; throw new Error('network forbidden') }
  try {
    const result = reconcilePaperAutoExecution({ lifecycle: base, orders: [], positions: [] })
    assert.equal(called, false)
    assert.equal(result.safety.orderPlacementAllowed, false)
    assert.equal(result.safety.brokerMutationAllowed, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})


test('preserves broker submitted and filled timestamps in reconciliation patch', () => {
  const lifecycle={state:'EXIT_UNKNOWN',selectedSymbol:'SPY',enterClientOrderId:'enter-1',exitClientOrderId:'exit-1',reconciliation:[]}
  const r=reconcilePaperAutoExecution({lifecycle,orders:[{id:'broker-exit-1',client_order_id:'exit-1',symbol:'SPY',side:'sell',status:'filled',filled_qty:'1',filled_avg_price:'631.10',submitted_at:'2026-08-11T15:00:00Z',filled_at:'2026-08-11T15:00:00.300Z'}],positions:[]})
  assert.equal(r.patch.exitBrokerSubmittedAt,'2026-08-11T15:00:00.000Z')
  assert.equal(r.patch.exitBrokerFilledAt,'2026-08-11T15:00:00.300Z')
  assert.equal(r.patch.reconciliation.at(-1).exitFilledAt,'2026-08-11T15:00:00.300Z')
})

test('EXIT-owned unresolved never falls back through ENTER reconciliation', () => {
  const lifecycle={...base,state:S.UNRESOLVED_NEEDS_RECONCILIATION,filledQuantity:1,exitClientOrderId:'exit-1'}
  const r=reconcilePaperAutoExecution({lifecycle,orders:[{id:'bo-1',client_order_id:'exit-1',symbol:'SPY',side:'sell',status:'open',qty:'1'}],positions:[{asset_id:'asset-spy',symbol:'SPY',qty:'1',avg_entry_price:'630.25'}]})
  assert.equal(r.nextState,S.EXIT_SUBMITTING)
  assert.notEqual(r.nextState,S.POSITION_CONFIRMED)
})

test('duplicate exact exit client identity fails closed', () => {
  const lifecycle={...base,state:S.EXIT_UNKNOWN,filledQuantity:1,exitClientOrderId:'exit-1'}
  const r=reconcilePaperAutoExecution({lifecycle,orders:[
    {id:'bo-1',client_order_id:'exit-1',symbol:'SPY',side:'sell',status:'open',qty:'1'},
    {id:'bo-2',client_order_id:'exit-1',symbol:'SPY',side:'sell',status:'open',qty:'1'},
  ],positions:[{ asset_id:'asset-spy',symbol:'SPY',qty:'1'}]})
  assert.equal(r.nextState,S.UNRESOLVED_NEEDS_RECONCILIATION)
  assert.equal(r.resolved,false)
  assert.ok(r.blockers.includes('duplicate_exit_client_order_identity'))
})

test('terminal exit with residual position fails closed for replacement policy', () => {
  const lifecycle={...base,state:S.EXIT_UNKNOWN,filledQuantity:1,exitClientOrderId:'exit-1'}
  const r=reconcilePaperAutoExecution({lifecycle,orders:[{id:'bo-1',client_order_id:'exit-1',symbol:'SPY',side:'sell',status:'canceled',qty:'1'}],positions:[{asset_id:'asset-spy',symbol:'SPY',qty:'1'}]})
  assert.equal(r.nextState,S.UNRESOLVED_NEEDS_RECONCILIATION)
  assert.equal(r.resolved,false)
  assert.ok(r.blockers.includes('exit_order_terminal_with_residual_position'))
})

test('partial exit without residual position is contradictory and unresolved', () => {
  const lifecycle={...base,state:S.EXIT_PARTIALLY_FILLED,filledQuantity:1,exitClientOrderId:'exit-1'}
  const r=reconcilePaperAutoExecution({lifecycle,orders:[{id:'bo-1',client_order_id:'exit-1',symbol:'SPY',side:'sell',status:'partially_filled',qty:'1',filled_qty:'0.5'}],positions:[]})
  assert.equal(r.nextState,S.UNRESOLVED_NEEDS_RECONCILIATION)
  assert.equal(r.resolved,false)
  assert.ok(r.blockers.includes('partial_exit_without_residual_position'))
})

test('EXIT state without client order identity fails closed', () => {
  const lifecycle={...base,state:S.EXIT_SUBMITTING,filledQuantity:1,exitClientOrderId:null}
  const r=reconcilePaperAutoExecution({lifecycle,orders:[],positions:[{asset_id:'asset-spy',symbol:'SPY',qty:'1'}]})
  assert.equal(r.nextState,S.UNRESOLVED_NEEDS_RECONCILIATION)
  assert.equal(r.resolved,false)
  assert.ok(r.blockers.includes('exit_client_order_id_required'))
})
