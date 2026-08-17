import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createPaperAutoExecutionExitReplacementRunner,
  derivePaperExitReplacementActionFile,
} from '../src/scanner/paper_auto_execution_exit_replacement_runner.mjs'

test('runner is disabled by default before lifecycle access or broker mutation', async () => {
  let lifecycleReads=0, accountReads=0, submits=0
  const runner=createPaperAutoExecutionExitReplacementRunner({
    env:{},
    getLifecycleFile:()=>{lifecycleReads++;return '/should/not/be/read.json'},
    fetchAccount:async()=>{accountReads++;return {}},
    submitPaperOrder:async()=>{submits++;return {}},
  })
  const d=await runner.runOnce()
  assert.equal(d.lastStatus,'EXIT_REPLACEMENT_RUNNER_DISABLED')
  assert.equal(lifecycleReads,0)
  assert.equal(accountReads,0)
  assert.equal(submits,0)
})

test('enabled runner with no active lifecycle fails closed before broker access', async () => {
  let accountReads=0, submits=0
  const runner=createPaperAutoExecutionExitReplacementRunner({
    env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
    getLifecycleFile:()=> '',
    fetchAccount:async()=>{accountReads++;return {}},
    submitPaperOrder:async()=>{submits++;return {}},
  })
  const d=await runner.runOnce()
  assert.equal(d.lastStatus,'ACTIVE_LIFECYCLE_PATH_REQUIRED')
  assert.equal(accountReads,0)
  assert.equal(submits,0)
})

test('replacement sidecar derives deterministically beside lifecycle', () => {
  const p=derivePaperExitReplacementActionFile('/tmp/paper_auto_execution_demo.json')
  assert.equal(p,'/tmp/paper_auto_execution_demo.exit_replacement_action.json')
})

test('replacement sidecar derivation rejects non-json lifecycle path', () => {
  assert.throws(
    ()=>derivePaperExitReplacementActionFile('/tmp/paper_auto_execution_demo.txt'),
    /paper_exit_replacement_lifecycle_json_required/,
  )
})

const makeEligibleLifecycleFile = () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gs-exitrepl-runner-'))
  const file=path.join(dir,'lifecycle.json')
  const now='2026-08-16T20:50:00.000Z'
  fs.writeFileSync(file,JSON.stringify({
    version:'paper_auto_execution_lifecycle_v1',
    lifecycleId:'life-runner-1',
    state:'UNRESOLVED_NEEDS_RECONCILIATION',
    selectedSymbol:'ABC',
    scannerEvidence:{paperOnly:true},
    enterClientOrderId:'enter-1',
    enterBrokerOrderId:'enter-b1',
    exitClientOrderId:'exit-c1',
    exitBrokerOrderId:'exit-b1',
    filledQuantity:3,
    averageFillPrice:10,
    brokerPositionIdentity:'ABC:3',
    reconciliation:[{
      at:now,
      blockers:['exit_order_terminal_with_residual_position'],
      exitClientOrderId:'exit-c1',
      exitBrokerOrderId:'exit-b1',
      exitOrderStatus:'canceled',
      exitOrderQuantity:3,
      exitFilledQuantity:1,
      residualPositionQuantity:2,
    }],
    createdAt:now,
    updatedAt:now,
  },null,2))
  return {dir,file}
}

test('market clock reader is mandatory before account or submission', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let accountReads=0,submits=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchAccount:async()=>{accountReads++;return {}},
      submitPaperOrder:async()=>{submits++;return {}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(d.lastStatus,'PAPER_MARKET_CLOCK_READER_REQUIRED')
    assert.equal(accountReads,0)
    assert.equal(submits,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('closed authoritative market blocks replacement before account or submission', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let accountReads=0,submits=0,clockReads=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>{clockReads++;return {ok:true,status:'connected_readonly',marketClock:{isOpen:false,timestamp:'2026-08-16T20:50:00.000Z'}}},
      fetchAccount:async()=>{accountReads++;return {}},
      submitPaperOrder:async()=>{submits++;return {}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(d.lastStatus,'PAPER_MARKET_OPEN_REQUIRED')
    assert.equal(clockReads,1)
    assert.equal(accountReads,0)
    assert.equal(submits,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('stale authoritative market clock blocks replacement before account or submission', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let accountReads=0,submits=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:49:00.000Z'}}),
      fetchAccount:async()=>{accountReads++;return {}},
      submitPaperOrder:async()=>{submits++;return {}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(d.lastStatus,'PAPER_MARKET_CLOCK_STALE')
    assert.equal(accountReads,0)
    assert.equal(submits,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})


test('post-lock market close blocks replacement before account or submission', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let accountReads=0,submits=0,clockReads=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>{
        clockReads++
        return {ok:true,status:'connected_readonly',marketClock:{isOpen:clockReads===1,timestamp:'2026-08-16T20:50:00.000Z'}}
      },
      fetchAccount:async()=>{accountReads++;return {}},
      submitPaperOrder:async()=>{submits++;return {}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(d.lastStatus,'POST_LOCK_PAPER_MARKET_OPEN_REQUIRED')
    assert.equal(clockReads,2)
    assert.equal(accountReads,0)
    assert.equal(submits,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('post-lock stale market clock blocks replacement before account or submission', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let accountReads=0,submits=0,clockReads=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>{
        clockReads++
        return {ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:clockReads===1?'2026-08-16T20:50:00.000Z':'2026-08-16T20:49:00.000Z'}}
      },
      fetchAccount:async()=>{accountReads++;return {}},
      submitPaperOrder:async()=>{submits++;return {}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(d.lastStatus,'POST_LOCK_PAPER_MARKET_CLOCK_STALE')
    assert.equal(clockReads,2)
    assert.equal(accountReads,0)
    assert.equal(submits,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('submission gates disabled persist deterministic PREPARED action without adapter call', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let submits=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:50:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),
      submitPaperOrder:async()=>{submits++;return {}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(submits,0)
    assert.equal(d.lastAction.state,'PREPARED')
    assert.equal(d.lastAction.replacementSequence,1)
    assert.equal(d.lastAction.residualQuantity,2)
    assert.equal(d.lastAction.priorExitClientOrderId,'exit-c1')
    assert.equal(d.lastAction.priorExitBrokerOrderId,'exit-b1')
    assert.equal(d.lastSubmission.status,'EXIT_REPLACEMENT_SUBMISSION_DISABLED_BY_ENV')
    assert.equal(d.lastStatus,'EXIT_REPLACEMENT_SUBMISSION_DISABLED_BY_ENV')
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('fully enabled first generation submits exact residual and canonical predecessor identity', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let submits=0,received=null
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{
        PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1',
        PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED:'1',
        PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED:'1',
      },
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:50:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),
      submitPaperOrder:async(order,context)=>{submits++;received={order,context};return {orderSubmitted:true,brokerOrderId:'repl-b1',status:'accepted'}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(submits,1)
    assert.equal(received.order.symbol,'ABC')
    assert.equal(received.order.qty,2)
    assert.equal(received.order.side,'sell')
    assert.equal(received.order.type,'market')
    assert.equal(received.order.timeInForce,'day')
    assert.equal(received.order.paperOnly,true)
    assert.equal(received.context.lifecycleId,'life-runner-1')
    assert.equal(received.context.replacementSequence,1)
    assert.equal(received.context.predecessorClientOrderId,'exit-c1')
    assert.equal(received.context.predecessorBrokerOrderId,'exit-b1')
    assert.equal(received.context.liveTradingAllowed,false)
    assert.equal(d.lastAction.state,'OPEN')
    assert.equal(d.lastAction.brokerOrderId,'repl-b1')
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('PREPARED restart resumes exact deterministic action without duplicate prepare or client identity', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  const common={
    getLifecycleFile:()=>file,
    fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),
    fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:50:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),
    now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
  }
  try{
    const first=createPaperAutoExecutionExitReplacementRunner({
      ...common,
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      submitPaperOrder:async()=>{throw new Error('adapter_must_not_run')},
    })
    const d1=await first.runOnce()
    assert.equal(d1.lastAction.state,'PREPARED')
    assert.equal(d1.lastAction.replacementSequence,1)
    const client=d1.lastAction.clientOrderId
    let submits=0
    const restarted=createPaperAutoExecutionExitReplacementRunner({
      ...common,
      env:{
        PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1',
        PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED:'1',
        PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED:'1',
      },
      submitPaperOrder:async()=>{submits++;return {orderSubmitted:true,brokerOrderId:'repl-restart-b1',status:'accepted'}},
    })
    const d2=await restarted.runOnce()
    assert.equal(submits,1)
    assert.equal(d2.lastAction.replacementSequence,1)
    assert.equal(d2.lastAction.clientOrderId,client)
    assert.equal(d2.lastAction.state,'OPEN')
    assert.equal(d2.lastAction.brokerOrderId,'repl-restart-b1')
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('UNKNOWN restart reconciles exact broker identity before any new mutation or blind retry', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let submits=0,lookups=0,accountReads=0
  try{
    const env={
      PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1',
      PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED:'1',
      PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED:'1',
    }
    const common={
      env,
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),
      fetchAccount:async()=>{accountReads++;return {ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:50:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    }
    const first=createPaperAutoExecutionExitReplacementRunner({
      ...common,
      submitPaperOrder:async()=>{submits++;throw new Error('simulated_transport_uncertainty')},
    })
    const d1=await first.runOnce()
    assert.equal(submits,1)
    assert.equal(d1.lastAction.state,'UNKNOWN')
    const client=d1.lastAction.clientOrderId

    const restarted=createPaperAutoExecutionExitReplacementRunner({
      ...common,
      fetchOrderByClientOrderId:async({clientOrderId})=>{
        lookups++
        assert.equal(clientOrderId,client)
        return {ok:true,status:'order_not_found',brokerContactType:'readonly_get'}
      },
      submitPaperOrder:async()=>{submits++;throw new Error('blind_retry_forbidden')},
    })
    const d2=await restarted.runOnce()
    assert.equal(lookups,1)
    assert.equal(submits,1)
    assert.equal(d2.lastStatus,'EXIT_REPLACEMENT_RECONCILIATION_PENDING')
    assert.equal(d2.lastAction.state,'UNKNOWN')
    assert.equal(d2.lastAction.clientOrderId,client)
    assert.equal(d2.lastReconciliation.status,'EXACT_EXIT_REPLACEMENT_ORDER_NOT_YET_PROVEN')
    assert.equal(accountReads,1)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('terminal reconciled replacement prepares second generation from immediate predecessor identity', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  try{
    const prep=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:50:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),
      submitPaperOrder:async()=>{throw new Error('adapter_must_not_run')},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d1=await prep.runOnce()
    const seq1=d1.lastAction.clientOrderId
    const {PaperAutoExecutionExitReplacementActionStore,STATES}=await import('../src/scanner/paper_auto_execution_exit_replacement_action_store.mjs')
    const store=new PaperAutoExecutionExitReplacementActionStore({filePath:derivePaperExitReplacementActionFile(file),clock:()=>Date.parse('2026-08-16T20:50:00.000Z')})
    let a=store.transition({expectedReplacementSequence:1,expectedClientOrderId:seq1,expectedState:STATES.PREPARED,nextState:STATES.SUBMITTING})
    a=store.transition({expectedReplacementSequence:1,expectedClientOrderId:seq1,expectedState:STATES.SUBMITTING,nextState:STATES.TERMINAL_RECONCILED,patch:{brokerOrderId:'repl-b1',brokerOrderStatus:'canceled',observedFilledQuantity:0,observedResidualQuantity:2,reconciledAt:'2026-08-16T20:50:00.000Z'}})
    assert.equal(store.mutationLocked(),false)
    const next=createPaperAutoExecutionExitReplacementRunner({env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},getLifecycleFile:()=>file,fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:50:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),submitPaperOrder:async()=>{throw new Error('adapter_must_not_run')},now:()=>Date.parse('2026-08-16T20:50:00.000Z')})
    const d2=await next.runOnce()
    assert.equal(d2.lastAction.state,'PREPARED')
    assert.equal(d2.lastAction.replacementSequence,2)
    assert.equal(d2.lastAction.priorExitClientOrderId,seq1)
    assert.equal(d2.lastAction.priorExitBrokerOrderId,'repl-b1')
    assert.equal(d2.lastAction.terminalReason,'canceled')
    assert.equal(d2.lastAction.residualQuantity,2)
    assert.notEqual(d2.lastAction.clientOrderId,seq1)
    const lifecycle=JSON.parse(fs.readFileSync(file,'utf8'))
    assert.equal(lifecycle.exitClientOrderId,'exit-c1')
    assert.equal(lifecycle.exitBrokerOrderId,'exit-b1')
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('broker-authoritative terminal reconciliation flows directly into second replacement generation', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  const now='2026-08-16T20:50:00.000Z'
  try{
    const first=createPaperAutoExecutionExitReplacementRunner({
      env:{
        PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1',
        PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED:'1',
        PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED:'1',
      },
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:now}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:now,account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),
      submitPaperOrder:async()=>({orderSubmitted:true,brokerOrderId:'repl-auth-b1',status:'accepted'}),
      now:()=>Date.parse(now),
    })
    const d1=await first.runOnce()
    assert.equal(d1.lastAction.state,'OPEN')
    assert.equal(d1.lastAction.replacementSequence,1)
    const seq1=d1.lastAction.clientOrderId

    let lookups=0,submits=0
    const next=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:now}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:now,account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),
      fetchOrderByClientOrderId:async({clientOrderId})=>{
        lookups++
        assert.equal(clientOrderId,seq1)
        return {ok:true,status:'order_found',brokerContactType:'readonly_get',order:{id:'repl-auth-b1',client_order_id:seq1,symbol:'ABC',side:'sell',qty:'2',filled_qty:'0',status:'canceled'}}
      },
      submitPaperOrder:async()=>{submits++;throw new Error('second_generation_submission_must_remain_disabled')},
      now:()=>Date.parse(now),
    })
    const d2=await next.runOnce()
    assert.equal(lookups,1)
    assert.equal(submits,0)
    assert.equal(d2.lastReconciliation.status,'PAPER_EXIT_REPLACEMENT_TERMINAL_RESIDUAL_RECONCILED')
    assert.equal(d2.lastAction.state,'PREPARED')
    assert.equal(d2.lastAction.replacementSequence,2)
    assert.equal(d2.lastAction.priorExitClientOrderId,seq1)
    assert.equal(d2.lastAction.priorExitBrokerOrderId,'repl-auth-b1')
    assert.equal(d2.lastAction.terminalReason,'canceled')
    assert.equal(d2.lastAction.residualQuantity,2)
    assert.notEqual(d2.lastAction.clientOrderId,seq1)
    const lifecycle=JSON.parse(fs.readFileSync(file,'utf8'))
    assert.equal(lifecycle.exitClientOrderId,'exit-c1')
    assert.equal(lifecycle.exitBrokerOrderId,'exit-b1')
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('stale PAPER account blocks replacement before prepare or submission', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let submits=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({
      env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1',PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED:'1',PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED:'1'},
      getLifecycleFile:()=>file,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),
      fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:49:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[]}),
      submitPaperOrder:async()=>{submits++;return {orderSubmitted:true,brokerOrderId:'must-not-submit'}},
      now:()=>Date.parse('2026-08-16T20:50:00.000Z'),
    })
    const d=await runner.runOnce()
    assert.equal(d.lastStatus,'FRESH_PAPER_ACCOUNT_REQUIRED')
    assert.equal(d.lastAction,null)
    assert.equal(submits,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})

test('conflicting open symbol order blocks replacement before prepare or submission', async () => {
  const {dir,file}=makeEligibleLifecycleFile()
  let submits=0
  try{
    const runner=createPaperAutoExecutionExitReplacementRunner({env:{PAPER_AUTO_EXIT_REPLACEMENT_RUNNER_ENABLED:'1',PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_BOUNDARY_ENABLED:'1',PAPER_AUTO_EXIT_REPLACEMENT_SUBMISSION_ENABLED:'1'},getLifecycleFile:()=>file,fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:'2026-08-16T20:50:00.000Z'}}),fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:'2026-08-16T20:50:00.000Z',account:{tradingBlocked:false,accountBlocked:false},positions:[{symbol:'ABC',qty:'2'}],openOrders:[{symbol:'ABC',side:'sell',status:'new'}]}),submitPaperOrder:async()=>{submits++;return {orderSubmitted:true,brokerOrderId:'must-not-submit'}},now:()=>Date.parse('2026-08-16T20:50:00.000Z')})
    const d=await runner.runOnce()
    assert.equal(d.lastStatus,'CONFLICTING_OPEN_ORDER_BLOCKS_REPLACEMENT')
    assert.equal(d.lastAction,null)
    assert.equal(submits,0)
  } finally { fs.rmSync(dir,{recursive:true,force:true}) }
})
