import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';
import{PaperAutoExecutionLifecycleStore as L}from'../src/scanner/paper_auto_execution_lifecycle_store.mjs';
import{createPaperAutoExecutionScaleRunner as R,derivePaperScaleActionFile as D}from'../src/scanner/paper_auto_execution_scale_runner.mjs';
import{derivePaperPositionMutationLockFile as MD,acquirePaperPositionMutationLock as MA,releasePaperPositionMutationLock as MR}from'../src/scanner/paper_auto_execution_position_mutation_lock.mjs';
const N=Date.parse('2026-08-15T12:00:00Z');
function life(f){const s=new L({filePath:f,clock:()=>N,idFactory:()=> 'life-1'});s.create({selectedSymbol:'ABC'});s.transition('ENTER_SUBMITTING',{enterClientOrderId:'e'});s.transition('ENTER_OPEN',{enterBrokerOrderId:'b'});s.transition('POSITION_CONFIRMED',{filledQuantity:4,brokerPositionIdentity:'ABC:4'});s.transition('MONITORING')}
test('boundary disabled blocks PREPARED and submission',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-runner-'));try{const f=path.join(d,'paper_auto_execution_life-1.json');life(f);let calls=0;const r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'0'},getLifecycleFile:()=>f,now:()=>N,fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]}),fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),submitPaperOrder:async()=>{calls++;return{}},fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'})});const o=await r.runOnce({action:'scale_out',targetQuantity:2});assert.equal(o.lastStatus,'PAPER_SCALE_SUBMISSION_BOUNDARY_DISABLED_BY_ENV');assert.equal(calls,0);assert.equal(fs.existsSync(D(f)),false);const z=new L({filePath:f}).load();assert.equal(z.state,'MONITORING');assert.equal(z.filledQuantity,4)}finally{fs.rmSync(d,{recursive:true,force:true})}})

test('enabled SCALE-OUT submits once and exact fill reconciles MONITORING quantity',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-runner-fill-'))
 try{
  const f=path.join(d,'paper_auto_execution_life-1.json');life(f)
  let submitCalls=0,accountCalls=0,submitted=null,notifications=0
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),
   fetchAccount:async()=>{
    accountCalls++
    const qty=accountCalls<=2?4:2
    return {ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty,currentPrice:11,avg_entry_price:'10.5'}],openOrders:[]}
   },
   fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),
   executionNotifier:async event=>{notifications++;assert.equal(event.action,'SCALE-OUT');assert.equal(event.symbol,'ABC');assert.equal(event.quantity,2);assert.equal(event.brokerOrderId,'broker-scale-fill-1');assert.equal(event.lifecycleId,'life-1');throw new Error('notification_test_failure')},
   submitPaperOrder:async order=>{submitCalls++;submitted=order;return{orderSubmitAttempted:true,orderSubmitted:true,orderId:'broker-scale-fill-1',status:'accepted'}},
   fetchOrderByClientOrderId:async({clientOrderId})=>({ok:true,status:'order_found',order:{id:'broker-scale-fill-1',status:'filled',client_order_id:clientOrderId,filled_qty:'2',filled_at:'2026-08-15T12:00:00Z'}}),
  })
  const o=await r.runOnce({action:'scale_out',targetQuantity:2})
  assert.equal(o.lastStatus,'PAPER_SCALE_ACTION_RECONCILED_MONITORING')
  assert.equal(notifications,1)
  assert.equal(submitCalls,1)
  assert.equal(submitted.side,'sell')
  assert.equal(submitted.qty,2)
  assert.equal(submitted.paperOnly,true)
  const z=new L({filePath:f}).load()
  assert.equal(z.state,'MONITORING')
  assert.equal(z.filledQuantity,2)
  assert.equal(z.brokerPositionIdentity,'ABC:2')
  const sidecar=JSON.parse(fs.readFileSync(D(f),'utf8'))
  assert.equal(sidecar.current.state,'FILLED_RECONCILED')
  assert.equal(sidecar.current.targetQuantity,2)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('unresolved SCALE-OUT recovers exact fill without duplicate submission',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-runner-recover-'))
 try{
  const f=path.join(d,'paper_auto_execution_life-1.json');life(f)
  let submits=0,accounts=0,cid=null
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),
   fetchAccount:async()=>{
    accounts++
    const qty=accounts<=2?4:2
    return {ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty,currentPrice:11,avg_entry_price:'10.5'}],openOrders:[]}
   },
   fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),
   submitPaperOrder:async order=>{submits++;cid=order.clientOrderId;throw new Error('timeout_after_send')},
   fetchOrderByClientOrderId:async({clientOrderId})=>{
    if(!cid)return {ok:true,status:'order_not_found'}
    assert.equal(clientOrderId,cid)
    return {ok:true,status:'order_found',order:{id:'broker-recovered-1',status:'filled',client_order_id:cid,filled_qty:'2',filled_at:'2026-08-15T12:00:00Z'}}
   },
  })
  const first=await r.runOnce({action:'scale_out',targetQuantity:2})
  assert.equal(submits,1)
  assert.equal(first.lastStatus,'PAPER_SCALE_ACTION_RECONCILED_MONITORING')
  const second=await r.runOnce({action:'scale_out',targetQuantity:2})
  assert.equal(submits,1)
  assert.notEqual(second.lastStatus,'SCALE_SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED')
  const z=new L({filePath:f}).load()
  assert.equal(z.state,'MONITORING')
  assert.equal(z.filledQuantity,2)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})


test('held EXIT lock blocks SCALE before PREPARED or submission',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-exit-lock-'));try{const f=path.join(d,'life.json');life(f);let n=0;const h=MA({lockFile:MD(f),lifecycleId:'life-1',symbol:'ABC',action:'exit',now:()=>N,tokenFactory:()=> 'held'});try{const r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},getLifecycleFile:()=>f,now:()=>N,fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]}),fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),submitPaperOrder:async()=>{n++;return{}},fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'})});const o=await r.runOnce({action:'scale_out',targetQuantity:2});assert.equal(o.lastStatus,'POSITION_MUTATION_LOCK_HELD');assert.equal(n,0);assert.equal(fs.existsSync(D(f)),false);const z=new L({filePath:f}).load();assert.equal(z.state,'MONITORING');assert.equal(z.filledQuantity,4)}finally{MR(h)}}finally{fs.rmSync(d,{recursive:true,force:true})}})
test('SCALE-IN baseline account identity match passes and mismatch blocks before PREPARED',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-in-id-'));try{const f=path.join(d,'life.json');life(f);const id='alpaca-paper:0123456789abcdef01234567',bad='alpaca-paper:fedcba9876543210fedcba98';let n=0;const A=async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{accountIdentity:id,tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]});const M=async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleInReviewTriggered:true,ownedScaleInTargetQuantity:6,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]});const C=async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}});const mk=(x,b)=>R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:b},getLifecycleFile:()=>f,now:()=>N,fetchMarketClock:C,fetchAccount:A,fetchOwnedMonitor:M,getPremarketBaseline:async()=>({ok:true,paperOnly:true,readOnly:true,sessionDate:'2026-08-15',accountIdentity:x}),submitPaperOrder:async()=>{n++;return{}},fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'})});const a=await mk(id,'0').runOnce({action:'scale_in',targetQuantity:6});assert.equal(a.lastStatus,'PAPER_SCALE_SUBMISSION_BOUNDARY_DISABLED_BY_ENV');assert.equal(n,0);assert.equal(fs.existsSync(D(f)),false);const b=await mk(bad,'1').runOnce({action:'scale_in',targetQuantity:6});assert.equal(b.lastStatus,'PREMARKET_CAPITAL_BASELINE_ACCOUNT_IDENTITY_MISMATCH');assert.equal(n,0);assert.equal(fs.existsSync(D(f)),false);const z=new L({filePath:f}).load();assert.equal(z.state,'MONITORING');assert.equal(z.filledQuantity,4)}finally{fs.rmSync(d,{recursive:true,force:true})}})

test('post-lock fresh broker quantity change blocks stale SCALE preflight before PREPARED or submission',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-post-lock-race-'));try{const f=path.join(d,'life.json');life(f);let accounts=0,submits=0;const r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},getLifecycleFile:()=>f,now:()=>N,fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),fetchAccount:async()=>{accounts++;const qty=accounts===1?4:3;return{ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty,currentPrice:11}],openOrders:[]}},fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),submitPaperOrder:async()=>{submits++;return{}},fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'})});const o=await r.runOnce({action:'scale_out',targetQuantity:2});assert.equal(o.lastStatus,'EXACT_BROKER_POSITION_REQUIRED');assert.equal(accounts,2);assert.equal(submits,0);assert.equal(fs.existsSync(D(f)),false);const z=new L({filePath:f}).load();assert.equal(z.state,'MONITORING');assert.equal(z.filledQuantity,4)}finally{fs.rmSync(d,{recursive:true,force:true})}})


test('post-lock market close blocks stale SCALE before PREPARED or submission',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-post-lock-clock-'))
 try{
  const f=path.join(d,'life.json');life(f)
  let clockReads=0,submits=0
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   fetchMarketClock:async()=>{clockReads++;return{ok:true,status:'connected_readonly',marketClock:{isOpen:clockReads===1,timestamp:new Date(N-5000).toISOString()}}},
   fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]}),
   fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),
   submitPaperOrder:async()=>{submits++;return{}},
   fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'}),
  })
  const o=await r.runOnce({action:'scale_out',targetQuantity:2})
  assert.equal(o.lastStatus,'POST_LOCK_PAPER_MARKET_OPEN_REQUIRED')
  assert.equal(clockReads,2)
  assert.equal(submits,0)
  assert.equal(fs.existsSync(D(f)),false)
  const z=new L({filePath:f}).load()
  assert.equal(z.state,'MONITORING')
  assert.equal(z.filledQuantity,4)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('post-lock owned strategy target drift blocks stale SCALE before PREPARED or submission',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-post-lock-strategy-'))
 try{
  const f=path.join(d,'life.json');life(f);let monitors=0,submits=0
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),
   fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]}),
   fetchOwnedMonitor:async()=>{monitors++;return{ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:monitors===1?2:3,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}},
   submitPaperOrder:async()=>{submits++;return{}},
   fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'}),
  })
  const o = await r.runOnce({action:'scale_out',targetQuantity:2})
  assert.equal(o.lastStatus,'POST_LOCK_FRESH_SCALE_OUT_TARGET_MISMATCH')
  assert.equal(monitors,2)
  assert.equal(submits,0)
  assert.equal(fs.existsSync(D(f)),false)
  const z=new L({filePath:f}).load()
  assert.equal(z.state,'MONITORING')
  assert.equal(z.filledQuantity,4)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('post-lock SCALE-IN baseline identity drift blocks stale growth before PREPARED or submission',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-post-lock-baseline-id-'))
 try{
  const f=path.join(d,'life.json');life(f)
  const good='alpaca-paper:0123456789abcdef01234567'
  const bad='alpaca-paper:fedcba9876543210fedcba98'
  let baselines=0,submits=0
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),
   fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{accountIdentity:good,tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]}),
   fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleInReviewTriggered:true,ownedScaleInTargetQuantity:6,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),
   getPremarketBaseline:async()=>{baselines++;return{ok:true,paperOnly:true,readOnly:true,sessionDate:'2026-08-15',accountIdentity:baselines===1?good:bad}},
   submitPaperOrder:async()=>{submits++;return{}},
   fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'}),
  })
  const o=await r.runOnce({action:'scale_in',targetQuantity:6})
  assert.equal(o.lastStatus,'POST_LOCK_PREMARKET_CAPITAL_BASELINE_ACCOUNT_IDENTITY_MISMATCH')
  assert.equal(baselines,2)
  assert.equal(submits,0)
  assert.equal(fs.existsSync(D(f)),false)
  const z=new L({filePath:f}).load()
  assert.equal(z.state,'MONITORING')
  assert.equal(z.filledQuantity,4)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})


test('post-lock per-asset policy blocks SCALE-IN growth above hard 10 percent before PREPARED',async()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-m7-cap-'))
  try{
    const f=path.join(d,'life.json')
    life(f)
    let submits=0
    const id='alpaca-paper:0123456789abcdef01234567'
    const A=async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{accountIdentity:id,tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:50000},positions:[{ symbol:'ABC', qty:4, currentPrice:180, marketValue:720 }],openOrders:[]})
    const M=async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleInReviewTriggered:true,ownedScaleInTargetQuantity:6,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]})
    const r=R({
      env:{
        PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',
        PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',
        PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1',
      },
      getLifecycleFile:()=>f,
      now:()=>N,
      fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),
      fetchAccount:A,
      fetchOwnedMonitor:M,
      getPremarketBaseline:async()=>({ok:true,paperOnly:true,readOnly:true,sessionDate:'2026-08-15',accountIdentity:id}),
      submitPaperOrder:async()=>{submits++;return {}},
      fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'}),
    })
    const out=await r.runOnce({action:'scale_in',targetQuantity:6})
    assert.equal(out.lastStatus,'POST_LOCK_SINGLE_POSITION_ALLOCATION_CEILING_EXCEEDED')
    assert.equal(out.lastPortfolioCapitalGovernor.allowed,false)
    assert.equal(submits,0)
    assert.equal(fs.existsSync(D(f)),false)
    assert.equal(new L({filePath:f}).load().filledQuantity,4)
  } finally { fs.rmSync(d,{recursive:true,force:true}) }
})

test('Module 8 SCALE records broker clock failure and blocks degraded SCALE-IN before reads',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'m8-scale-'));try{const f=path.join(d,'l.json');life(f);let reads=0,fail=[];let mode={evaluateAction:()=>({allowed:false,status:'DEGRADED_BROKER_RISK_INCREASING_ACTION_BLOCKED'}),recordFailure:x=>fail.push(x),diagnostics:()=>({})};let r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1'},getLifecycleFile:()=>f,now:()=>N,degradedBrokerMode:mode,fetchMarketClock:async()=>{reads++;return{}},fetchAccount:async()=>{reads++;return{}},fetchOwnedMonitor:async()=>{reads++;return{}}});let o=await r.runOnce({action:'scale_in',targetQuantity:6});assert.equal(o.lastStatus,'DEGRADED_BROKER_RISK_INCREASING_ACTION_BLOCKED');assert.equal(reads,0);mode={evaluateAction:()=>({allowed:true}),recordFailure:x=>fail.push(x),diagnostics:()=>({})};r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1'},getLifecycleFile:()=>f,now:()=>N,degradedBrokerMode:mode,fetchMarketClock:async()=>({ok:false,status:'clock_fetch_failed'}),fetchAccount:async()=>({}),fetchOwnedMonitor:async()=>({})});o=await r.runOnce({action:'scale_out',targetQuantity:2});assert.equal(o.lastStatus,'PAPER_MARKET_CLOCK_REQUIRED');assert.equal(fail.at(-1)?.kind,'MARKET_CLOCK_READ_FAILED')}finally{fs.rmSync(d,{recursive:true,force:true})}})
test('Module 8 SCALE records submission ambiguity and still reconciles',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'m8-scale-amb-'));try{const f=path.join(d,'l.json');life(f);let n=0,fail=[];const r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},getLifecycleFile:()=>f,now:()=>N,degradedBrokerMode:{evaluateAction:()=>({allowed:true}),recordFailure:x=>fail.push(x),diagnostics:()=>({})},fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),fetchAccount:async()=>{n++;const q=n<=2?4:2;return{ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:1e4,buyingPower:5e3},positions:[{symbol:'ABC',qty:q,currentPrice:11,avg_entry_price:'10.5'}],openOrders:[]}},fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),submitPaperOrder:async()=>{throw Error('timeout')},fetchOrderByClientOrderId:async({clientOrderId})=>({ok:true,status:'order_found',order:{id:'b',status:'filled',client_order_id:clientOrderId,filled_qty:'2',filled_at:'2026-08-15T12:00:00Z'}})});const o=await r.runOnce({action:'scale_out',targetQuantity:2});assert.equal(fail.some(x=>x.kind==='SUBMISSION_EXCEPTION'),true);assert.equal(o.lastStatus,'PAPER_SCALE_ACTION_RECONCILED_MONITORING')}finally{fs.rmSync(d,{recursive:true,force:true})}})
// Module 8 SCALE failure recording smoke

test('shared capital-growth coordinator blocks SCALE-IN before broker reads or PREPARED state',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-cap-growth-block-'))
 try{
  const f=path.join(d,'life.json');life(f);let reads=0,submits=0,runs=0
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   capitalGrowthCoordinator:{run:async({currentLifecycleId},task)=>{runs++;assert.ok(currentLifecycleId);assert.equal(typeof task,'function');return{allowed:false,status:'CAPITAL_GROWTH_CONFLICT_UNRESOLVED'}}},
   fetchMarketClock:async()=>{reads++;return{}},
   fetchAccount:async()=>{reads++;return{}},
   fetchOwnedMonitor:async()=>{reads++;return{}},
   submitPaperOrder:async()=>{submits++;return{}},
  })
  const o=await r.runOnce({action:'scale_in',targetQuantity:6})
  assert.equal(o.lastStatus,'CAPITAL_GROWTH_CONFLICT_UNRESOLVED')
  assert.equal(runs,1)
  assert.equal(reads,0)
  assert.equal(submits,0)
  assert.equal(fs.existsSync(D(f)),false)
  assert.equal(new L({filePath:f}).load().state,'MONITORING')
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('shared capital-growth coordinator is bypassed for SCALE-OUT reducing action',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-cap-growth-bypass-'))
 try{
  const f=path.join(d,'life.json');life(f);let runs=0
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   capitalGrowthCoordinator:{run:async()=>{runs++;return{allowed:false,status:'SHOULD_NOT_RUN'}}},
   fetchMarketClock:async()=>({ok:false,status:'clock_fetch_failed'}),
   fetchAccount:async()=>({}),
   fetchOwnedMonitor:async()=>({}),
  })
  const o=await r.runOnce({action:'scale_out',targetQuantity:2})
  assert.equal(runs,0)
  assert.equal(o.lastStatus,'PAPER_MARKET_CLOCK_REQUIRED')
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('wind-down blocks SCALE-IN before broker reads',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-wind-in-'))
 try{
  const f=path.join(d,'life.json');life(f);let reads=0,submits=0
  const r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},getLifecycleFile:()=>f,getPortfolioWindDownState:async()=>({resolved:true,active:true}),fetchMarketClock:async()=>{reads++;return{}},fetchAccount:async()=>{reads++;return{}},fetchOwnedMonitor:async()=>{reads++;return{}},submitPaperOrder:async()=>{submits++}})
  const o=await r.runOnce({action:'scale_in',targetQuantity:6})
  assert.equal(o.lastStatus,'PORTFOLIO_WIND_DOWN_SCALE_IN_BLOCKED')
  assert.equal(reads,0)
  assert.equal(submits,0)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('wind-down does not block SCALE-OUT reducing path',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-wind-out-'))
 try{
  const f=path.join(d,'life.json');life(f);let windChecks=0
  const r=R({env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'0'},getLifecycleFile:()=>f,getPortfolioWindDownState:async()=>{windChecks++;return{resolved:true,active:true}},now:()=>N,fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]}),fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleOutReviewTriggered:true,ownedScaleOutResultingQuantity:2,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),submitPaperOrder:async()=>({}),fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'})})
  const o=await r.runOnce({action:'scale_out',targetQuantity:2})
  assert.equal(o.lastStatus,'PAPER_SCALE_SUBMISSION_BOUNDARY_DISABLED_BY_ENV')
  assert.equal(windChecks,0)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('wind-down transition after SCALE-IN lock blocks the race before PREPARED or submission',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scale-wind-race-'))
 try{
  const f=path.join(d,'life.json');life(f)
  const id='alpaca-paper:0123456789abcdef01234567'
  let windChecks=0,submits=0
  const r=R({
   env:{PAPER_AUTO_SCALE_RUNNER_ENABLED:'1',PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED:'1',PAPER_AUTO_SCALE_SUBMISSION_BOUNDARY_ENABLED:'1'},
   getLifecycleFile:()=>f,now:()=>N,
   getPortfolioWindDownState:async()=>({resolved:true,active:++windChecks>=2}),
   fetchMarketClock:async()=>({ok:true,status:'connected_readonly',marketClock:{isOpen:true,timestamp:new Date(N-5000).toISOString()}}),
   fetchAccount:async()=>({ok:true,status:'connected_readonly',observedAt:new Date(N-5000).toISOString(),account:{accountIdentity:id,tradingBlocked:false,accountBlocked:false,equity:10000,buyingPower:5000},positions:[{symbol:'ABC',qty:4,currentPrice:11}],openOrders:[]}),
   fetchOwnedMonitor:async()=>({ok:true,candidates:[{symbol:'ABC',resultState:'WATCH',ownedExitReviewTriggered:false,ownedScaleInReviewTriggered:true,ownedScaleInTargetQuantity:6,sourceCoverage:'owned_position_symbol_fetch',sourceStale:false,sourceAgeSec:5,maxSourceAgeSec:180}]}),
   getPremarketBaseline:async()=>({ok:true,paperOnly:true,readOnly:true,sessionDate:'2026-08-15',accountIdentity:id}),
   submitPaperOrder:async()=>{submits++;return{}},
   fetchOrderByClientOrderId:async()=>({ok:true,status:'order_not_found'}),
  })
  const o=await r.runOnce({action:'scale_in',targetQuantity:6})
  assert.equal(windChecks,2)
  assert.equal(o.lastStatus,'POST_LOCK_PORTFOLIO_WIND_DOWN_SCALE_IN_BLOCKED')
  assert.equal(submits,0)
  assert.equal(fs.existsSync(D(f)),false)
  const z=new L({filePath:f}).load()
  assert.equal(z.state,'MONITORING')
  assert.equal(z.filledQuantity,4)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})
