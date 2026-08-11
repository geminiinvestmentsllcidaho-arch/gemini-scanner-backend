import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaperAutoExitMonitorWorker } from '../src/scanner/paper_auto_exit_monitor_worker.mjs'

const life = { lifecycleId:'life-1', state:'MONITORING', selectedSymbol:'BTG', filledQuantity:1, brokerPositionIdentity:'BTG:1' }
const row = { file:'/tmp/lifecycle.json', lifecycle:life }

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
