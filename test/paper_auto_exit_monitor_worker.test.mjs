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
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,sourceStale:false}]}),
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
  assert.equal('lastSubmissionAt' in r,false)
  assert.equal('lastReconciliationAt' in r,false)
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
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,sourceStale:false}]}),
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
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,sourceStale:true}]}),
    exitRunner:async()=>{exits++},
  })
  const r=await w.runOnce()
  assert.equal(exits,0)
  assert.equal(r.lastResult[0].status,'MONITORING_NO_EXIT')
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
  let scheduledMs=null
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
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
})

test('records broker timestamps returned by exact exit runner evidence', async () => {
  const w=createPaperAutoExitMonitorWorker({
    env:{PAPER_AUTO_EXIT_MONITOR_ENABLED:'1',PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH:'/tmp/lifecycle.json'},
    readConfiguredMonitoringLifecycle:async()=>row,
    fetchAccount:async()=>({ok:true,status:'connected_readonly',positions:[{symbol:'BTG',qty:1}],openOrders:[]}),
    fetchOwnedMonitor:async()=>({candidates:[{symbol:'BTG',resultState:'EXIT',decision:'EXIT',ownedExitReviewTriggered:true,sourceStale:false}]}),
    exitRunner:async()=>({status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',submission:{status:'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED',result:{brokerOrderId:'bo-1',submittedAt:'2026-08-11T15:00:00.000Z'}},reconciliation:{status:'RECONCILED_STATE_UPDATED'},lifecycle:{state:'ROUND_TRIP_COMPLETED',exitBrokerOrderId:'bo-1',exitBrokerFilledAt:'2026-08-11T15:00:00.250Z'},brokerTiming:{submittedAt:'2026-08-11T15:00:00.000Z',filledAt:'2026-08-11T15:00:00.250Z'}}),
  })
  const r=await w.runOnce({source:'market_event',eventSymbol:'BTG'})
  assert.equal(r.lastBrokerSubmittedAt,'2026-08-11T15:00:00.000Z')
  assert.equal(r.lastBrokerFilledAt,'2026-08-11T15:00:00.250Z')
})
