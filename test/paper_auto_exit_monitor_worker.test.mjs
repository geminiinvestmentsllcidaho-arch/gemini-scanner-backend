import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createPaperAutoExitMonitorWorker } from '../src/scanner/paper_auto_exit_monitor_worker.mjs'

const life = { lifecycleId:'life-1', state:'MONITORING', selectedSymbol:'BTG', filledQuantity:1, brokerPositionIdentity:'BTG:1' }
const row = { status:'MONITORING', file:'/tmp/lifecycle.json', lifecycle:life }

test('disabled by default', async () => {
  let calls=0
  const w=createPaperAutoExitMonitorWorker({env:{},readConfiguredMonitoringLifecycle:async()=>{calls++;return null}})
  const r=await w.runOnce()
  assert.equal(r.enabled,false)
  assert.equal(r.lastStatus,'DISABLED_BY_ENV')
  assert.equal(calls,0)
  assert.equal(r.safety.paperOnly,true)
  assert.equal(r.safety.liveTradingAllowed,false)
})

test('fresh EXIT invokes exact runner once', async () => {
  const calls=[]
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    now:()=>1000000,
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1,unrealizedPlpc:-0.04}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:false}]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true}}),
    exitRunner:async o=>{calls.push(o);return{
      status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',
      submission:{status:'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED',result:{orderId:'paper-order-1'}},
      reconciliation:{status:'RECONCILED_STATE_UPDATED'},
      lifecycle:{state:'ROUND_TRIP_COMPLETED',exitBrokerOrderId:'paper-order-1'}
    }},
  })
  const r=await w.runOnce({eventSymbol:'BTG'})
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].args,{execute:'true',lifecycleFile:'/tmp/lifecycle.json',lifecycleId:'life-1',symbol:'BTG',quantity:'1'})
  assert.equal(r.exitTriggers,1)
  assert.equal(r.exitAttempts,1)
  assert.equal(r.lastStatus,'EXIT_TRIGGERED')
  assert.equal(r.lastTriggerDetectedAt,'1970-01-01T00:16:40.000Z')
  assert.equal(r.lastRunnerCompletedAt,'1970-01-01T00:16:40.000Z')
  assert.equal(r.lastSubmissionConfirmedObservedAt,'1970-01-01T00:16:40.000Z')
  assert.equal(r.lastReconciliationCompletedObservedAt,'1970-01-01T00:16:40.000Z')
  assert.equal(r.lastBrokerOrderId,'paper-order-1')
  assert.equal(r.lastSubmissionStatus,'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
  assert.equal(r.lastReconciliationStatus,'RECONCILED_STATE_UPDATED')
  assert.equal(r.lastExitDecision?.decision,'EXIT')
  assert.equal(r.lastExitDecision?.exitRequired,true)
  assert.equal(r.lastExitDecision?.symbol,'BTG')
  assert.equal(r.lastExitDecision?.brokerPositionIdentity,'BTG:1')
  assert.equal(r.lastExitDecision?.strategyExit,true)
  assert.equal('lastSubmissionAt' in r,false)
  assert.equal('lastReconciliationAt' in r,false)
})


test('unrelated market events are rejected before runOnce and do not alter monitor diagnostics', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paper-auto-exit-prefilter-'))
  const lifecycleFile=path.join(dir,'lifecycle.json')
  fs.writeFileSync(lifecycleFile,JSON.stringify(life))
  try {
    let accounts=0
    const w=createPaperAutoExitMonitorWorker({
      env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:lifecycleFile},
      fetchAccount:async()=>{accounts++;return {ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}},
    })
    const before=w.diagnostics()
    const returned=w.onMarketDataEvent({symbol:'AAPL'})
    await new Promise(resolve=>setImmediate(resolve))
    const after=w.diagnostics()
    assert.equal(returned.cycles,before.cycles)
    assert.equal(after.cycles,before.cycles)
    assert.equal(after.eventCycles,before.eventCycles)
    assert.equal(after.lastStatus,before.lastStatus)
    assert.equal(accounts,0)
  } finally {
    fs.rmSync(dir,{recursive:true,force:true})
  }
})

test('missing exact broker position fails closed', async () => {
  let exits=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[],openOrders:[]}),
    fetchOwnedMonitor:async()=>{throw new Error('must_not_evaluate')},
    exitRunner:async()=>{exits++},
  })
  const r=await w.runOnce()
  assert.equal(exits,0)
  assert.equal(r.lastResult[0].status,'BROKER_EXACT_POSITION_NOT_PRESENT')
})


test('enabled worker fails closed until one active lifecycle path is explicitly configured', async () => {
  let reads=0
  let accounts=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1'},
    readConfiguredMonitoringLifecycle:async()=>{reads++;return row},
    fetchAccount:async()=>{accounts++;return {ok:true,status:'connected_readonly',positions:[]}},
  })
  const r=await w.runOnce()
  assert.equal(r.lastStatus,'ACTIVE_LIFECYCLE_PATH_REQUIRED')
  assert.equal(r.configuredLifecycleFile,null)
  assert.equal(reads,0)
  assert.equal(accounts,0)
})

test('configured lifecycle pin prevents unrelated historical lifecycle evaluation', async () => {
  let reads=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>{reads++;return row},
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1,unrealizedPlpc:0}]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'WAIT',decision:'WAIT',ownedExitReviewTriggered:false,sourceStale:false}]}),
  })
  const r=await w.runOnce({eventSymbol:'USAS'})
  assert.equal(reads,1)
  assert.equal(r.lastStatus,'EVENT_SYMBOL_NOT_MONITORED')
  assert.deepEqual(r.lastResult,[])
})

test('monitor does not invent broker acknowledgment or fill timestamps for unresolved runner evidence', async () => {
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    now:()=>2000000,
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1,unrealizedPlpc:-0.04}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:false}]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true}}),
    exitRunner:async()=>({
      status:'EXACT_POSITION_PAPER_EXIT_RECONCILIATION_REQUIRED',
      submission:{status:'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED',result:null},
      reconciliation:{status:'UNRESOLVED_NEEDS_RECONCILIATION'},
      lifecycle:{state:'EXIT_UNKNOWN'}
    }),
  })
  const r=await w.runOnce()
  assert.equal(r.lastTriggerDetectedAt,'1970-01-01T00:33:20.000Z')
  assert.equal(r.lastRunnerCompletedAt,'1970-01-01T00:33:20.000Z')
  assert.equal(r.lastSubmissionConfirmedObservedAt,null)
  assert.equal(r.lastReconciliationCompletedObservedAt,null)
  assert.equal(r.lastBrokerOrderId,null)
  assert.equal(r.lastSubmissionStatus,'SUBMISSION_AMBIGUOUS_RECONCILIATION_REQUIRED')
  assert.equal(r.lastReconciliationStatus,'UNRESOLVED_NEEDS_RECONCILIATION')
})




test('existing PAPER_AUTO_EXECUTION_LIFECYCLE_PATH is accepted as fallback and exposes only its pinned MONITORING symbol', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paper-auto-exit-symbol-'))
  const file=path.join(dir,'life.json')
  fs.writeFileSync(file,JSON.stringify(life))
  try {
    const w=createPaperAutoExitMonitorWorker({
      env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXECUTION_LIFECYCLE_PATH:file},
    })
    assert.equal(w.diagnostics().configuredLifecycleFile,file)
    assert.equal(w.configuredMonitoringSymbol(),'BTG')
  } finally {
    fs.rmSync(dir,{recursive:true,force:true})
  }
})


test('stale EXIT is suppressed before exact exit runner', async () => {
  let exits=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:true}]}),
    exitRunner:async()=>{exits++},
  })
  const r=await w.runOnce()
  assert.equal(exits,0)
  assert.equal(r.lastResult[0].status,'MONITORING_NO_EXIT')
  assert.equal(r.lastResult[0].exitDecision?.status,'STALE_EXIT_EVIDENCE_SUPPRESSED')
  assert.equal(r.lastResult[0].exitDecision?.decision,'HOLD')
  assert.equal(r.lastResult[0].exitDecision?.exitRequired,false)
})

test('non-EXIT decision is suppressed before exact exit runner', async () => {
  let exits=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'WAIT',decision:'WAIT',ownedExitReviewTriggered:false,sourceStale:false}]}),
    exitRunner:async()=>{exits++},
  })
  const r=await w.runOnce()
  assert.equal(exits,0)
  assert.equal(r.lastResult[0].status,'MONITORING_NO_EXIT')
  assert.equal(r.lastResult[0].exitDecision?.status,'MONITORING_HOLD')
  assert.equal(r.lastResult[0].exitDecision?.decision,'HOLD')
  assert.equal(r.lastResult[0].exitDecision?.exitRequired,false)
})

test('busy cycle suppresses duplicate concurrent evaluation and exit attempt', async () => {
  let release
  let accountCalls=0
  const gate=new Promise(resolve=>{release=resolve})
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>{accountCalls++; await gate; return {ok:true,status:'connected_readonly',positions:[]}},
  })
  const first=w.runOnce()
  await new Promise(resolve=>setImmediate(resolve))
  const second=await w.runOnce()
  assert.equal(second.lastStatus,'CYCLE_ALREADY_RUNNING')
  assert.equal(accountCalls,1)
  release()
  await first
})

test('event symbol mismatch returns before PAPER account fetch', async () => {
  let accounts=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>{accounts++;return {ok:true,status:'connected_readonly',positions:[]}},
  })
  const r=await w.runOnce({eventSymbol:'USAS'})
  assert.equal(r.lastStatus,'EVENT_SYMBOL_NOT_MONITORED')
  assert.equal(accounts,0)
})

test('corrupt configured lifecycle fails closed and emits Admin incident', async () => {
  const incidents=[]
  let accounts=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/corrupt.json'},
    readConfiguredMonitoringLifecycle:async()=>({status:'LIFECYCLE_FILE_CORRUPT',file:'/tmp/corrupt.json',lifecycle:null}),
    fetchAccount:async()=>{accounts++;return {ok:true,status:'connected_readonly',positions:[]}},
    incidentEmitter:async i=>{incidents.push(i)},
  })
  const r=await w.runOnce()
  assert.equal(r.lastStatus,'WORKER_ERROR_FAIL_CLOSED')
  assert.equal(accounts,0)
  assert.equal(incidents.length,1)
  assert.equal(incidents[0].source,'paper_execution')
  assert.equal(incidents[0].phase,'exit')
  assert.match(incidents[0].failureCode,/paper_auto_exit_monitor_lifecycle_file_corrupt/)
})

test('monitor-specific lifecycle path takes precedence over execution fallback path', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paper-auto-exit-precedence-'))
  const primary=path.join(dir,'primary.json')
  const fallback=path.join(dir,'fallback.json')
  fs.writeFileSync(primary,JSON.stringify({...life,selectedSymbol:'BTG',brokerPositionIdentity:'BTG:1'}))
  fs.writeFileSync(fallback,JSON.stringify({...life,selectedSymbol:'USAS',brokerPositionIdentity:'USAS:1'}))
  try {
    const w=createPaperAutoExitMonitorWorker({
      env:{
        PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',
        PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:primary,
        PAPER_AUTO_EXECUTION_LIFECYCLE_PATH:fallback,
      },
    })
    assert.equal(w.diagnostics().configuredLifecycleFile,primary)
    assert.equal(w.configuredMonitoringSymbol(),'BTG')
  } finally {
    fs.rmSync(dir,{recursive:true,force:true})
  }
})


test('uses 15-second authoritative fallback while market events remain immediate', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paper-auto-exit-fallback-'))
  const lifecycleFile=path.join(dir,'lifecycle.json')
  fs.writeFileSync(lifecycleFile,JSON.stringify(life))
  try {
    let scheduledMs=null
    const w=createPaperAutoExitMonitorWorker({
      env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:lifecycleFile},
      fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[]}),
      setIntervalFn:(fn,ms)=>{scheduledMs=ms;return {unref(){}}},
      clearIntervalFn:()=>{},
    })
    w.start()
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(scheduledMs,15000)
    assert.ok(w.diagnostics().fallbackCycles>=1)
    w.onMarketDataEvent({symbol:'BTG'})
    await new Promise(resolve=>setImmediate(resolve))
    assert.ok(w.diagnostics().eventCycles>=1)
    w.stop()
  } finally {
    fs.rmSync(dir,{recursive:true,force:true})
  }
})

test('records broker timestamps returned by exact exit runner evidence', async () => {
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:false}]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true}}),
    exitRunner:async()=>({status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',submission:{status:'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED',result:{brokerOrderId:'bo-1',submittedAt:'2026-08-11T15:00:00.000Z'}},reconciliation:{status:'RECONCILED_STATE_UPDATED'},lifecycle:{state:'ROUND_TRIP_COMPLETED',exitBrokerOrderId:'bo-1',exitBrokerFilledAt:'2026-08-11T15:00:00.250Z'},brokerTiming:{submittedAt:'2026-08-11T15:00:00.000Z',filledAt:'2026-08-11T15:00:00.250Z'}}),
  })
  const r=await w.runOnce({source:'market_event',eventSymbol:'BTG'})
  assert.equal(r.lastBrokerSubmittedAt,'2026-08-11T15:00:00.000Z')
  assert.equal(r.lastBrokerFilledAt,'2026-08-11T15:00:00.250Z')
})

test('enabled monitor emits one deduplicated critical incident when lifecycle path is missing', async () => {
  const incidents=[]
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1'},
    incidentEmitter:async incident=>incidents.push(incident),
  })
  await w.runOnce()
  await w.runOnce()
  assert.equal(w.diagnostics().lastStatus,'ACTIVE_LIFECYCLE_PATH_REQUIRED')
  assert.equal(incidents.length,1)
  assert.equal(incidents[0].failureCode,'paper_auto_exit_monitor_lifecycle_path_required')
  assert.equal(incidents[0].severity,'critical')
})

test('enabled monitor emits one deduplicated critical incident when configured lifecycle file is missing', async () => {
  const incidents=[]
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1'},
    lifecycleFile:'/tmp/definitely-missing-paper-auto-exit-lifecycle.json',
    readConfiguredMonitoringLifecycle:async()=>({status:'LIFECYCLE_FILE_MISSING',file:'/tmp/definitely-missing-paper-auto-exit-lifecycle.json',lifecycle:null}),
    incidentEmitter:async incident=>incidents.push(incident),
  })
  await w.runOnce()
  await w.runOnce()
  assert.equal(w.diagnostics().lastStatus,'ACTIVE_LIFECYCLE_FILE_MISSING')
  assert.equal(incidents.length,1)
  assert.equal(incidents[0].failureCode,'paper_auto_exit_monitor_lifecycle_file_missing')
})

test('incident dedupe latch resets after a healthy monitoring cycle so a later recurrence alerts again', async () => {
  const incidents=[]
  let mode='missing'
  const row={status:'MONITORING',file:'/tmp/lifecycle.json',lifecycle:{lifecycleId:'life-reset',state:'MONITORING',selectedSymbol:'BTG',filledQuantity:1,brokerPositionIdentity:'BTG:1'}}
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1'},
    lifecycleFile:'/tmp/lifecycle.json',
    readConfiguredMonitoringLifecycle:async()=>mode==='missing'?{status:'LIFECYCLE_FILE_MISSING',file:'/tmp/lifecycle.json',lifecycle:null}:row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',ownedExitReviewTriggered:false,resultState:'WATCH',sourceStale:false}]}),
    incidentEmitter:async incident=>incidents.push(incident),
  })
  await w.runOnce()
  mode='healthy'
  await w.runOnce()
  mode='missing'
  await w.runOnce()
  assert.equal(incidents.length,2)
  assert.equal(incidents[0].failureCode,'paper_auto_exit_monitor_lifecycle_file_missing')
  assert.equal(incidents[1].failureCode,'paper_auto_exit_monitor_lifecycle_file_missing')
})


test('strategy-driven PAPER EXIT waits benignly for market open before invoking exact runner', async () => {
  let open=false,clocks=0,exits=0
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1,unrealizedPlpc:-0.04}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:false}]}),
    fetchMarketClock:async()=>{clocks++;return {ok:true,status:'connected_readonly',marketClock:{isOpen:open}}},
    exitRunner:async()=>{exits++;return {status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',lifecycle:{state:'ROUND_TRIP_COMPLETED'}}},
  })
  let r=await w.runOnce({eventSymbol:'BTG'})
  assert.equal(r.lastResult[0].status,'WAITING_FOR_MARKET_OPEN_STRATEGY_EXIT')
  assert.equal(r.lastStatus,'MONITORING')
  assert.equal(r.exitTriggers,0)
  assert.equal(r.exitAttempts,0)
  assert.equal(r.lastError,null)
  assert.equal(exits,0)
  open=true
  r=await w.runOnce({eventSymbol:'BTG'})
  assert.equal(clocks,2)
  assert.equal(exits,1)
  assert.equal(r.exitTriggers,1)
  assert.equal(r.exitAttempts,1)
  assert.equal(r.lastStatus,'EXIT_TRIGGERED')
})

test('controlled PAPERmarket closed then open exits exact BTG without strategy', async () => {
  let open=false,owned=0,exits=0
  const cr={...row,lifecycle:{...life,scannerEvidence:{mechanicalAutoExitProof:true}}}
  const w=createPaperAutoExitMonitorWorker({env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/l.json'},readConfiguredMonitoringLifecycle:async()=>cr,fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1},{symbol:'USAS',qty:1}]}),fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:open}}),fetchOwnedMonitor:async()=>{owned++;return {candidates:[]}},exitRunner:async()=>{exits++;return {status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',lifecycle:{state:'ROUND_TRIP_COMPLETED'}}}})
  let r=await w.runOnce({eventSymbol:'BTG'})
  assert.equal(r.lastResult[0].status,'WAITING_FOR_MARKET_OPEN_AUTO_EXIT_PROOF')
  open=true; r=await w.runOnce({eventSymbol:'BTG'})
  assert.equal(owned,0); assert.equal(exits,1); assert.equal(r.lastStatus,'EXIT_TRIGGERED')
})



test('one-time exact USAS lifecycle uses controlled market-open path without strategy', async () => {
  let open=false, owned=0, exits=0
  const usasLife={
    ...life,
    lifecycleId:'9bf4939d-4936-48e6-9529-f5c02ae5d1ec',
    state:'MONITORING',
    selectedSymbol:'USAS',
    filledQuantity:1,
    brokerPositionIdentity:'USAS:1',
    scannerEvidence:{
      source:'paper_auto_continuity_existing_position_adoption',
      paperOnly:true,
      mechanicalAutoExitProof:false
    }
  }
  const usasRow={...row,file:'/tmp/usas-one-time.json',lifecycle:usasLife}
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/usas-one-time.json'},
    readConfiguredMonitoringLifecycle:async()=>usasRow,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'USAS',qty:1}],openOrders:[]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:open}}),
    fetchOwnedMonitor:async()=>{owned++;return {candidates:[]}},
    exitRunner:async({args})=>{exits++;assert.equal(args.lifecycleId,'9bf4939d-4936-48e6-9529-f5c02ae5d1ec');assert.equal(args.symbol,'USAS');assert.equal(args.quantity,'1');return {status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',lifecycle:{...usasLife,state:'ROUND_TRIP_COMPLETED'}}}
  })
  let r=await w.runOnce({eventSymbol:'USAS'})
  assert.equal(r.lastResult[0].status,'WAITING_FOR_MARKET_OPEN_AUTO_EXIT_PROOF')
  assert.equal(exits,0)
  assert.equal(owned,0)
  open=true
  r=await w.runOnce({eventSymbol:'USAS'})
  assert.equal(exits,1)
  assert.equal(owned,0)
  assert.equal(r.lastStatus,'EXIT_TRIGGERED')
})

test('one-time USAS override remains exact lifecycle identity scoped', async () => {
  let exits=0, owned=0
  const wrong={...life,lifecycleId:'different',state:'MONITORING',selectedSymbol:'USAS',filledQuantity:1,brokerPositionIdentity:'USAS:1',scannerEvidence:{source:'paper_auto_continuity_existing_position_adoption',paperOnly:true,mechanicalAutoExitProof:false}}
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/usas-wrong.json'},
    readConfiguredMonitoringLifecycle:async()=>({status:'MONITORING',file:'/tmp/usas-wrong.json',lifecycle:wrong}),
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'USAS',qty:1}],openOrders:[]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true}}),
    fetchOwnedMonitor:async()=>{owned++;return {candidates:[]}},
    exitRunner:async()=>{exits++;return {status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',lifecycle:{...wrong,state:'ROUND_TRIP_COMPLETED'}}}
  })
  const r=await w.runOnce({eventSymbol:'USAS'})
  assert.equal(exits,0)
  assert.equal(owned,1)
  assert.equal(r.lastResult[0].status,'MONITORING_NO_EXIT')
})

test('dynamic configured lifecycle resolver follows newly active monitoring lifecycle', async () => {
  let file = '/tmp/old.json'
  const seen = []
  const w = createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1'},
    getConfiguredLifecycleFile:() => file,
    readConfiguredMonitoringLifecycle:({ lifecycleFile } = {}) => {
      seen.push(lifecycleFile)
      const symbol = lifecycleFile.includes('new') ? 'NEW' : 'OLD'
      return { status:'MONITORING', file:lifecycleFile, lifecycle:{state:'MONITORING',selectedSymbol:symbol,filledQuantity:1,brokerPositionIdentity:`${symbol}:1`} }
    },
  })
  assert.equal(w.configuredMonitoringSymbol(), 'OLD')
  file = '/tmp/new.json'
  assert.equal(w.configuredMonitoringSymbol(), 'NEW')
  assert.deepEqual(seen, ['/tmp/old.json','/tmp/new.json'])
})

test('completed controlled lifecycle is benign and does not alert or refetch account', async () => {
  let accounts=0,incidents=0
  const done={status:'LIFECYCLE_NOT_MONITORING',file:'/tmp/l.json',lifecycle:{...life,state:'ROUND_TRIP_COMPLETED',scannerEvidence:{mechanicalAutoExitProof:true}}}
  const w=createPaperAutoExitMonitorWorker({env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'t/tmp/l.json'},readConfiguredMonitoringLifecycle:async()=>done,fetchAccount:async()=>{accounts++;return {}},incidentEmitter:async()=>{incidents++}})
  const r=await w.runOnce()
  assert.equal(r.lastStatus,'CONTROLLED_EXIT_LIFECYCLE_COMPLETED')
  assert.equal(accounts,0)
  assert.equal(incidents,0)
})

test('completed controlled lifecycle is benign and does not alert or refetch account', async () => {
  let accounts=0,incidents=0
  const done={status:'LIFECYCLE_NOT_MONITORING',file:'/tmp/l.json',lifecycle:{...life,state:'ROUND_TRIP_COMPLETED',scannerEvidence:{mechanicalAutoExitProof:true}}}
  const w=createPaperAutoExitMonitorWorker({env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'t/tmp/l.json'},readConfiguredMonitoringLifecycle:async()=>done,fetchAccount:async()=>{accounts++;return {}},incidentEmitter:async()=>{incidents++}})
  const r=await w.runOnce()
  assert.equal(r.lastStatus,'CONTROLLED_EXIT_LIFECYCLE_COMPLETED')
  assert.equal(accounts,0)
  assert.equal(incidents,0)
})


test('terminal lifecycle callback fires once only after exact completed strategy exit', async () => {
  const terminal = []
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:false}]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true}}),
    exitRunner:async()=>({status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',lifecycle:{state:'ROUND_TRIP_COMPLETED',exitBrokerOrderId:'bo-terminal'}}),
    onTerminalLifecycle:async payload=>terminal.push(payload),
  })
  const r=await w.runOnce({source:'market_event',eventSymbol:'BTG'})
  assert.equal(r.lastStatus,'EXIT_TRIGGERED')
  assert.equal(terminal.length,1)
  assert.equal(terminal[0].lifecycleId,'life-1')
  assert.equal(terminal[0].symbol,'BTG')
  assert.equal(terminal[0].result.status,'EXACT_POSITION_PAPER_EXIT_COMPLETED')
})

test('terminal lifecycle callback does not fire for monitoring or incomplete exit results', async () => {
  let terminal=0
  const monitoring=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'WATCH',decision:'WATCH',ownedExitReviewTriggered:false,sourceStale:false}]}),
    onTerminalLifecycle:async()=>{terminal++},
  })
  await monitoring.runOnce({source:'market_event',eventSymbol:'BTG'})
  assert.equal(terminal,0)

  const incomplete=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:false}]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true}}),
    exitRunner:async()=>({status:'EXACT_POSITION_PAPER_EXIT_PENDING',lifecycle:{state:'EXIT_UNKNOWN'}}),
    onTerminalLifecycle:async()=>{terminal++},
  })
  await incomplete.runOnce({source:'market_event',eventSymbol:'BTG'})
  assert.equal(terminal,0)
})

test('terminal lifecycle callback failure is contained after completed exit', async () => {
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,ownedExitReviewReason:'OWNED_POSITION_HARD_LOSS_REVIEW',sourceStale:false}]}),
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true}}),
    exitRunner:async()=>({status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',lifecycle:{state:'ROUND_TRIP_COMPLETED'}}),
    onTerminalLifecycle:async()=>{throw new Error('terminal_wake_test_failure')},
    now:()=>1000000,
  })
  const r=await w.runOnce({source:'market_event',eventSymbol:'BTG'})
  assert.equal(r.lastStatus,'EXIT_TRIGGERED')
  assert.equal(r.lastError,null)
  assert.equal(r.lastReconciliationCompletedObservedAt,'1970-01-01T00:16:40.000Z')
})
