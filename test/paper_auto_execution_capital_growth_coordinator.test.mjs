import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectPaperCapitalGrowthConflicts,
  createPaperCapitalGrowthCoordinator,
} from '../src/scanner/paper_auto_execution_capital_growth_coordinator.mjs'

const row=(id,symbol,state,extra={})=>({
  lifecycleId:id,symbol,state,
  lifecycle:{lifecycleId:id,selectedSymbol:symbol,state,...extra},
})

test('detects unresolved ENTER on another lifecycle and ignores current lifecycle',()=>{
  const portfolio={rows:[
    row('life-a','AAA','ENTER_OPEN',{enterClientOrderId:'enter-a'}),
    row('life-b','BBB','CANDIDATE_SELECTED'),
  ]}
  const blocked=detectPaperCapitalGrowthConflicts({portfolio,currentLifecycleId:'life-b'})
  assert.equal(blocked.allowed,false)
  assert.equal(blocked.status,'CAPITAL_GROWTH_CONFLICT_UNRESOLVED')
  assert.deepEqual(blocked.conflicts.map(x=>[x.kind,x.lifecycleId,x.state]),[['ENTER','life-a','ENTER_OPEN']])
  const own=detectPaperCapitalGrowthConflicts({portfolio:{rows:[portfolio.rows[0]]},currentLifecycleId:'life-a'})
  assert.equal(own.allowed,true)
})

test('ENTER-owned unresolved reconciliation blocks but EXIT-owned unresolved reconciliation does not',()=>{
  const enter=detectPaperCapitalGrowthConflicts({
    portfolio:{rows:[row('e','EEE','UNRESOLVED_NEEDS_RECONCILIATION',{enterClientOrderId:'enter-e'})]},
    currentLifecycleId:'other',
  })
  assert.equal(enter.allowed,false)
  const exit=detectPaperCapitalGrowthConflicts({
    portfolio:{rows:[row('x','XXX','UNRESOLVED_NEEDS_RECONCILIATION',{enterClientOrderId:'enter-x',exitClientOrderId:'exit-x'})]},
    currentLifecycleId:'other',
  })
  assert.equal(exit.allowed,true)
})

test('detects unresolved SCALE-IN sidecar but ignores SCALE-OUT and current lifecycle',()=>{
  const portfolio={rows:[row('a','AAA','MONITORING'),row('b','BBB','MONITORING'),row('c','CCC','MONITORING')]}
  const readScaleAction=r=>({
    a:{current:{action:'scale_in',lifecycleId:'a',symbol:'AAA',state:'OPEN'}},
    b:{current:{action:'scale_out',lifecycleId:'b',symbol:'BBB',state:'OPEN'}},
    c:{current:{action:'scale_in',lifecycleId:'c',symbol:'CCC',state:'PREPARED'}},
  }[r.lifecycleId])
  const out=detectPaperCapitalGrowthConflicts({portfolio,readScaleAction,currentLifecycleId:'c'})
  assert.equal(out.allowed,false)
  assert.deepEqual(out.conflicts.map(x=>[x.kind,x.lifecycleId,x.state]),[['SCALE_IN','a','OPEN']])
})

test('coordinator serializes critical sections and rechecks persisted conflicts after prior task',async()=>{
  let active=0,maxActive=0,blocked=false
  const coordinator=createPaperCapitalGrowthCoordinator({
    inspectConflicts:async()=>blocked
      ? {allowed:false,status:'CAPITAL_GROWTH_CONFLICT_UNRESOLVED',conflicts:[{kind:'ENTER'}]}
      : {allowed:true,status:'CAPITAL_GROWTH_CLEAR',conflicts:[]},
  })
  const first=coordinator.run({currentLifecycleId:'a'},async()=>{
    active++;maxActive=Math.max(maxActive,active)
    await new Promise(r=>setTimeout(r,20))
    blocked=true
    active--
    return {allowed:true,status:'FIRST_DONE'}
  })
  const second=coordinator.run({currentLifecycleId:'b'},async()=>{
    active++;maxActive=Math.max(maxActive,active);active--
    return {allowed:true,status:'SECOND_DONE'}
  })
  const [a,b]=await Promise.all([first,second])
  assert.equal(a.status,'FIRST_DONE')
  assert.equal(b.allowed,false)
  assert.equal(b.status,'CAPITAL_GROWTH_CONFLICT_UNRESOLVED')
  assert.equal(maxActive,1)
})
