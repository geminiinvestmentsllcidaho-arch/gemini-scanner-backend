import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionContinuityRuntime } from '../src/scanner/paper_auto_execution_continuity_runtime.mjs'
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'paper-cont-'))
function terminal(file){const s=new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=> 'old-life'});s.create({selectedSymbol:'BTG'});s.transition('ENTER_SUBMITTING',{enterClientOrderId:'e'});s.transition('ENTER_UNKNOWN',{enterBrokerOrderId:'eb'});s.transition('POSITION_CONFIRMED',{filledQuantity:1,averageFillPrice:4.12,brokerPositionIdentity:'BTG:1'});s.transition('MONITORING');s.transition('EXIT_TRIGGERED',{exitClientOrderId:'x'});s.transition('EXIT_SUBMITTING',{exitBrokerOrderId:'xb'});return s.transition('ROUND_TRIP_COMPLETED')}
test('terminal preserved and no candidate creates nothing',async()=>{const d=tmp(),old=path.join(d,'old.json'),before=terminal(old);let active=old;const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({candidates:[]}),idFactory:()=> 'new-life'});const out=await r.runOnce();assert.equal(out.lastStatus,'NO_ELIGIBLE_CANDIDATE');assert.equal(active,old);assert.deepEqual(new PaperAutoExecutionLifecycleStore({filePath:old}).load(),before)})
test('eligible ENTER creates one fresh lifecycle and preserves terminal evidence',async()=>{const d=tmp(),old=path.join(d,'old.json'),before=terminal(old);let active=old,nowMs=Date.parse('2026-08-13T01:00:10Z');const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'NEW',state:'ENTER',buyRecommendation:true,score:9}]}),idFactory:()=> 'new-life',now:()=>nowMs});const out=await r.runOnce();assert.equal(out.lastStatus,'FRESH_CANDIDATE_LIFECYCLE_CREATED');assert.notEqual(active,old);assert.equal(out.lastLifecycle.state,'CANDIDATE_SELECTED');assert.equal(out.lastLifecycle.selectedSymbol,'NEW');assert.equal(out.lastLifecycle.enterIdentity,null);assert.equal(out.lastLifecycle.enterIdentityDeferredForAccountSizing,true);assert.deepEqual(new PaperAutoExecutionLifecycleStore({filePath:old}).load(),before)})
test('strongest eligible ENTER uses production score ordering with deterministic symbol tie-break',async()=>{const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,nowMs=Date.parse('2026-08-13T01:00:10Z');const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'ZZZ',state:'ENTER',buyRecommendation:true,score:95},{symbol:'AAA',state:'ENTER',buyRecommendation:true,score:95},{symbol:'MID',state:'ENTER',buyRecommendation:true,score:90},{symbol:'BLOCK',state:'WAIT',buyRecommendation:false,score:100}]}),idFactory:()=> 'ranked-life',now:()=>nowMs});const out=await r.runOnce();assert.equal(out.lastStatus,'FRESH_CANDIDATE_LIFECYCLE_CREATED');assert.equal(out.lastLifecycle.selectedSymbol,'AAA')})
test('concurrent cycles deduplicate and active nonterminal blocks replacement',async()=>{const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,scans=0,nowMs=Date.parse('2026-08-13T01:00:10Z');const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>{scans++;await new Promise(x=>setTimeout(x,10));return{observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'ABC',state:'ENTER',buyRecommendation:true}]}},idFactory:()=> 'only-one',now:()=>nowMs});const[a,b]=await Promise.all([r.runOnce(),r.runOnce()]);assert.equal(scans,1);assert.equal(a.lastLifecycleFile,b.lastLifecycleFile);const c=await r.runOnce();assert.equal(c.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT')})
test('disabled by default and safety is nonmutating',async()=>{const r=createPaperAutoExecutionContinuityRuntime({env:{},getScanSnapshot:async()=>({candidates:[{symbol:'XYZ',state:'ENTER',buyRecommendation:true}]})});const out=await r.runOnce();assert.equal(out.lastStatus,'CONTINUITY_DISABLED_BY_ENV');assert.equal(out.safety.paperOnly,true);assert.equal(out.safety.brokerContactAllowed,false);assert.equal(out.safety.orderPlacementAllowed,false);assert.equal(out.safety.accountMutationAllowed,false);assert.equal(out.safety.liveTradingAllowed,false)})


test('new lifecycle creation requires a fresh non-future scan snapshot and preserves prior terminal pointer',async()=>{
 for(const [name,observedAt] of [['missing',null],['invalid','bad'],['stale','2026-08-13T00:59:39Z'],['future','2026-08-13T01:00:11Z']]){
  const d=tmp(),old=path.join(d,'old.json'),before=terminal(old);let active=old,setCalls=0
  const nowMs=Date.parse('2026-08-13T01:00:10Z')
  const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{setCalls++;active=f},getScanSnapshot:async()=>({...(observedAt===null?{}:{observedAt}),candidates:[{symbol:'NEW',state:'ENTER',buyRecommendation:true,score:99}]}),idFactory:()=> `blocked-${name}`,now:()=>nowMs})
  const out=await r.runOnce()
  assert.equal(out.lastStatus,'FRESH_SCAN_REQUIRED_FOR_LIFECYCLE_CREATION',name)
  assert.equal(active,old,name)
  assert.equal(setCalls,0,name)
  assert.equal(fs.existsSync(path.join(d,`paper_auto_execution_blocked-${name}.json`)),false,name)
  assert.deepEqual(new PaperAutoExecutionLifecycleStore({filePath:old}).load(),before,name)
 }
})

test('new lifecycle creation accepts snapshot exactly at 30-second freshness boundary',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old
 const nowMs=Date.parse('2026-08-13T01:00:30Z')
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'EDGE',state:'ENTER',buyRecommendation:true,score:99}]}),idFactory:()=> 'boundary-life',now:()=>nowMs})
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'FRESH_CANDIDATE_LIFECYCLE_CREATED')
 assert.equal(out.lastLifecycle.selectedSymbol,'EDGE')
 assert.equal(active,path.join(d,'paper_auto_execution_boundary-life.json'))
})


test('pending lifecycle suppresses expiration after pointer publish failure and retry cannot create a duplicate',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,setCalls=0,scans=0,nowMs=Date.parse('2026-08-13T01:00:00Z')
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:()=>{setCalls++;throw new Error('forced_pointer_write_failure')},getScanSnapshot:async()=>{scans++;return{observedAt:new Date(nowMs).toISOString(),candidates:[{symbol:'SAFE',state:'ENTER',buyRecommendation:true,score:99}]}},idFactory:()=> 'pointer-failure-life',now:()=>nowMs})
 await assert.rejects(r.runOnce(),/forced_pointer_write_failure/)
 const created=path.join(d,'paper_auto_execution_pointer-failure-life.json')
 assert.equal(fs.existsSync(created),true)
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:created}).load().selectedSymbol,'SAFE')
 nowMs=Date.parse('2026-08-13T01:01:00Z')
 const retry=await r.runOnce()
 assert.equal(retry.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT')
 assert.equal(retry.lastLifecycleFile,created)
 assert.equal(retry.lastLifecycle.state,'CANDIDATE_SELECTED')
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:created}).load().state,'CANDIDATE_SELECTED')
 assert.equal(setCalls,1)
 assert.equal(scans,1)
 assert.equal(fs.readdirSync(d).filter(name=>name.startsWith('paper_auto_execution_')&&name.endsWith('.json')).length,1)
})


function ownedCandidate(file,{observedAt='2026-08-13T01:00:00Z',symbol='OLD',patch={}}={}){
 const s=new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=>`life-${symbol}`,clock:()=>Date.parse('2026-08-13T01:00:00Z')})
 s.create({selectedSymbol:symbol,scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',observedAt,symbol,state:'ENTER',score:99,paperOnly:true}})
 if(Object.keys(patch).length){
  const current=JSON.parse(fs.readFileSync(file,'utf8'))
  fs.writeFileSync(file,JSON.stringify({...current,...patch},null,2))
 }
 return s
}

test('stale owned candidate expiration is separately default-off',async()=>{
 const d=tmp(),file=path.join(d,'paper_auto_execution_old.json');ownedCandidate(file);let active=file,scans=0
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,getScanSnapshot:async()=>{scans++;return{observedAt:'2026-08-13T01:01:00Z',candidates:[]}},now:()=>Date.parse('2026-08-13T01:01:00Z')})
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT')
 assert.equal(scans,0)
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED')
})

test('stale owned candidate is preserved when fresh scan still revalidates same symbol ENTER',async()=>{
 const d=tmp(),file=path.join(d,'paper_auto_execution_old.json');ownedCandidate(file);let active=file
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,getScanSnapshot:async()=>({observedAt:'2026-08-13T01:01:00Z',candidates:[{symbol:'OLD',state:'ENTER',buyRecommendation:true,score:100}]}),now:()=>Date.parse('2026-08-13T01:01:00Z')})
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'ACTIVE_CANDIDATE_REVALIDATED')
 assert.equal(active,file)
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED')
})

test('stale owned candidate expires only after fresh scan shows same symbol no longer eligible',async()=>{
 const d=tmp(),file=path.join(d,'paper_auto_execution_old.json');ownedCandidate(file);let active=file
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({observedAt:'2026-08-13T01:01:00Z',candidates:[]}),now:()=>Date.parse('2026-08-13T01:01:00Z')})
 const out=await r.runOnce()
 const expired=new PaperAutoExecutionLifecycleStore({filePath:file}).load()
 assert.equal(out.lastStatus,'STALE_CANDIDATE_EXPIRED')
 assert.equal(active,file)
 assert.equal(expired.state,'CANDIDATE_EXPIRED')
 assert.equal(expired.reconciliation.at(-1).kind,'candidate_expired')
 assert.equal(expired.reconciliation.at(-1).revalidatedAt,'2026-08-13T01:01:00Z')
 assert.equal(expired.reconciliation.at(-1).expiredAt,'2026-08-13T01:01:00.000Z')
 assert.equal(expired.reconciliation.at(-1).reason,'FRESH_SCAN_NO_LONGER_ELIGIBLE')
 assert.equal(expired.reconciliation.at(-1).candidateFreshnessMs,30000)
})

test('invalid stale-candidate revalidation snapshot fails closed without expiration',async()=>{
 const d=tmp(),file=path.join(d,'paper_auto_execution_old.json');ownedCandidate(file);let active=file
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,getScanSnapshot:async()=>({observedAt:'bad',candidates:[]}),now:()=>Date.parse('2026-08-13T01:01:00Z')})
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'FRESH_SCAN_REQUIRED_FOR_EXPIRATION')
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED')
})

test('future stale-candidate revalidation snapshot fails closed without expiration',async()=>{
 const d=tmp(),file=path.join(d,'paper_auto_execution_old.json');ownedCandidate(file);let active=file
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,getScanSnapshot:async()=>({observedAt:'2026-08-13T01:02:00Z',candidates:[]}),now:()=>Date.parse('2026-08-13T01:01:00Z')})
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'FRESH_SCAN_REQUIRED_FOR_EXPIRATION')
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED')
})


test('stored candidate TTL boundary and invalid times fail closed',async()=>{
 for(const [name,observedAt] of [['boundary','2026-08-13T01:00:30Z'],['invalid','bad'],['future','2026-08-13T01:02:00Z']]){
  const d=tmp(),file=path.join(d,`paper_auto_execution_${name}.json`);ownedCandidate(file,{observedAt});let active=file,scans=0
  const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,getScanSnapshot:async()=>{scans++;return{observedAt:'2026-08-13T01:01:00Z',candidates:[]}},now:()=>Date.parse('2026-08-13T01:01:00Z')})
  const out=await r.runOnce()
  assert.equal(out.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT',name)
  assert.equal(scans,0,name)
  assert.equal(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED',name)
 }
})

test('unowned or non-candidate-selected lifecycle never expires through continuity expiration',async()=>{
 for(const mode of ['unowned','noncandidate']){
  const d=tmp(),file=path.join(d,`paper_auto_execution_${mode}.json`);let active=file,scans=0
  if(mode==='unowned'){
   const s=new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=> 'life-unowned',clock:()=>Date.parse('2026-08-13T01:00:00Z')})
   s.create({selectedSymbol:'OLD',scannerEvidence:{source:'other_source',observedAt:'2026-08-13T01:00:00Z',symbol:'OLD',state:'ENTER',score:99,paperOnly:true}})
  }else{
   const s=ownedCandidate(file)
   s.transition('ENTER_SUBMITTING',{enterClientOrderId:'e'})
  }
  const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,getScanSnapshot:async()=>{scans++;return{observedAt:'2026-08-13T01:01:00Z',candidates:[]}},now:()=>Date.parse('2026-08-13T01:01:00Z')})
  const out=await r.runOnce()
  assert.equal(out.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT',mode)
  assert.equal(scans,0,mode)
  assert.notEqual(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_EXPIRED',mode)
 }
})

test('pre-ENTER execution or position evidence blocks stale candidate expiration',async()=>{
 for(const [field,value] of [['enterClientOrderId','e'],['enterBrokerOrderId','eb'],['exitClientOrderId','x'],['exitBrokerOrderId','xb'],['filledQuantity',1],['averageFillPrice',4.2],['brokerPositionIdentity','OLD:1']]){
  const d=tmp(),file=path.join(d,`paper_auto_execution_${field}.json`);ownedCandidate(file,{patch:{[field]:value}});let active=file,scans=0
  const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1',PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,getScanSnapshot:async()=>{scans++;return{observedAt:'2026-08-13T01:01:00Z',candidates:[]}},now:()=>Date.parse('2026-08-13T01:01:00Z')})
  const out=await r.runOnce()
  assert.equal(out.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT',field)
  assert.equal(scans,0,field)
  assert.equal(new PaperAutoExecutionLifecycleStore({filePath:file}).load().state,'CANDIDATE_SELECTED',field)
 }
})

test('expired lifecycle is terminal and resetToIdle accepts it',()=>{
 const d=tmp(),file=path.join(d,'paper_auto_execution_expired.json')
 const s=ownedCandidate(file)
 s.transition('CANDIDATE_EXPIRED')
 assert.deepEqual(s.resetToIdle(),{state:'IDLE'})
 assert.equal(fs.existsSync(file),false)
})

test('Module 10 candidate selection persists audit-only strategy evidence without tightening legacy eligibility', async () => {
  const d = tmp()
  const old = path.join(d, 'old.json')
  terminal(old)
  let active = old
  const nowMs = Date.parse('2026-08-18T20:00:10Z')
  const runtime = createPaperAutoExecutionContinuityRuntime({
    env: { PAPER_AUTO_CONTINUITY_ENABLED: '1' },
    runsDir: d,
    getActiveLifecycleFile: () => active,
    setActiveLifecycleFile: file => { active = file },
    getScanSnapshot: async () => ({
      observedAt: '2026-08-18T20:00:00Z',
      candidates: [{
        symbol: 'AUDIT',
        state: 'ENTER',
        buyRecommendation: true,
        blocked: false,
        blockers: [],
        score: 99,
        price: 5,
      }],
    }),
    idFactory: () => 'audit-life',
    now: () => nowMs,
  })
  const out = await runtime.runOnce()
  assert.equal(out.lastStatus, 'FRESH_CANDIDATE_LIFECYCLE_CREATED')
  const lifecycle = new PaperAutoExecutionLifecycleStore({ filePath: active }).load()
  const evidence = lifecycle.scannerEvidence.strategyEvidence.candidateSelection
  assert.equal(evidence.phase, 'candidate_selection')
  assert.equal(evidence.symbol, 'AUDIT')
  assert.equal(evidence.score, 99)
  assert.equal(evidence.strategyAuthorization.authorized, false)
  assert.equal(evidence.safety.auditOnly, true)
  assert.equal(evidence.safety.executionEligibilityMutationAllowed, false)
})


test('fresh lifecycle persists bounded scanner origin attribution identifiers', async()=>{
 const dir=tmp(), now=Date.parse('2026-08-18T20:00:00Z')
 let published=null
 const r=createPaperAutoExecutionContinuityRuntime({
  env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},
  runsDir:dir, now:()=>now, idFactory:()=> 'attrib',
  getActiveLifecycleFile:async()=>null,
  setActiveLifecycleFile:async(file,life)=>{ published={file,life} },
  getScanSnapshot:async()=>({scanId:'scan-123',observedAt:new Date(now-1000).toISOString(),candidates:[{symbol:'ABC',state:'ENTER',buyRecommendation:true,blocked:false,blockers:[],score:91,eventAt:new Date(now-1100).toISOString()}]}),
 })
 await r.runOnce()
 const life=published?.life ?? r.diagnostics().lastLifecycle
 assert.ok(life)
 assert.equal(life.scannerEvidence.originScanId,'scan-123')
 assert.equal(life.scannerEvidence.originEventAt,new Date(now-1100).toISOString())
})


test('diagnostics expose continuity cycle heartbeat timestamps',async()=>{
  const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old
  const nowMs=Date.parse('2026-08-19T22:10:00.000Z')
  const r=createPaperAutoExecutionContinuityRuntime({
    env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,
    setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({observedAt:new Date(nowMs).toISOString(),candidates:[]}),
    now:()=>nowMs
  })
  const out=await r.runOnce()
  const d2=r.diagnostics()
  assert.equal(out.lastCycleStartedAt,'2026-08-19T22:10:00.000Z')
  assert.equal(out.lastCycleCompletedAt,null)
  assert.equal(d2.lastCycleStartedAt,'2026-08-19T22:10:00.000Z')
  assert.equal(d2.lastCycleCompletedAt,'2026-08-19T22:10:00.000Z')
})


test('diagnostics prove authoritative zero eligible candidates from the exact scan snapshot',async()=>{
  const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old
  const nowMs=Date.parse('2026-08-19T22:20:00.000Z')
  const observedAt=new Date(nowMs-1000).toISOString()
  const r=createPaperAutoExecutionContinuityRuntime({
    env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,
    setActiveLifecycleFile:f=>{active=f},
    getScanSnapshot:async()=>({observedAt,candidates:[
      {symbol:'WAIT',state:'WAIT',buyRecommendation:false,blocked:true,blockers:['STATE_NOT_ENTER'],score:99},
      {symbol:'BLOCK',state:'ENTER',buyRecommendation:false,blocked:true,blockers:['SCORE_BELOW_MINIMUM'],score:69},
    ]}),
    now:()=>nowMs
  })
  const out=await r.runOnce()
  assert.equal(out.lastStatus,'NO_ELIGIBLE_CANDIDATE')
  const diag=r.diagnostics()
  assert.equal(diag.lastSnapshotObservedAt,observedAt)
  assert.equal(diag.lastSnapshotFresh,true)
  assert.equal(diag.lastSnapshotCandidateCount,2)
  assert.equal(diag.lastEligibleCandidateCount,0)
  assert.equal(diag.lastEligibleCandidateSymbol,null)
})

test('diagnostics identify strongest exact eligible candidate from authoritative snapshot',async()=>{
  const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old
  const nowMs=Date.parse('2026-08-19T22:21:00.000Z')
  const r=createPaperAutoExecutionContinuityRuntime({
    env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,
    setActiveLifecycleFile:f=>{active=f},idFactory:()=> 'assurance-proof',
    getScanSnapshot:async()=>({observedAt:new Date(nowMs-1000).toISOString(),candidates:[
      {symbol:'BBB',state:'ENTER',buyRecommendation:true,blocked:false,blockers:[],score:91},
      {symbol:'AAA',state:'ENTER',buyRecommendation:true,blocked:false,blockers:[],score:95},
    ]}),
    now:()=>nowMs
  })
  await r.runOnce()
  const diag=r.diagnostics()
  assert.equal(diag.lastSnapshotFresh,true)
  assert.equal(diag.lastEligibleCandidateCount,2)
  assert.equal(diag.lastEligibleCandidateSymbol,'AAA')
})


test('Module 13 continuity records candidate and no-trade evidence observationally without changing lifecycle eligibility',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,writes=[]
 const nowMs=Date.parse('2026-08-20T05:40:00.000Z')
 const r=createPaperAutoExecutionContinuityRuntime({
  env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},
  getScanSnapshot:async()=>({scanId:'scan-m13',observedAt:new Date(nowMs).toISOString(),candidates:[
   {symbol:'WAIT',state:'WAIT',buyRecommendation:false,blocked:true,blockers:['STRATEGY_STATE_NOT_ENTER'],score:68,price:4,momentumPct:2,spreadPct:.4,dollarVolume:2000000},
  ]}),
  appendEntryValidation:(input)=>{writes.push(input);return{record:input}},
  idFactory:()=> 'unused',now:()=>nowMs,
 })
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'NO_ELIGIBLE_CANDIDATE')
 assert.equal(active,old)
 assert.equal(writes.some(x=>x.eventType==='candidate_evaluation'&&x.symbol==='WAIT'),true)
 assert.equal(writes.some(x=>x.eventType==='no_trade_closeout'&&x.session?.orderSubmitted===false),true)
 assert.equal(out.entryValidationWriteFailures,0)
 assert.equal(out.safety.entryValidationObservationalOnly,true)
 assert.equal(out.safety.entryValidationFailureBlocksExecution,false)
})

test('Module 13 continuity evidence persistence failure is fail-open and cannot block legitimate lifecycle creation',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old
 const nowMs=Date.parse('2026-08-20T05:41:00.000Z')
 const r=createPaperAutoExecutionContinuityRuntime({
  env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},
  getScanSnapshot:async()=>({scanId:'scan-m13-ok',observedAt:new Date(nowMs).toISOString(),candidates:[
   {symbol:'PASS',state:'ENTER',buyRecommendation:true,blocked:false,blockers:[],score:91,price:4},
  ]}),
  appendEntryValidation:()=>{throw new Error('forced_evidence_write_failure')},
  idFactory:()=> 'm13-pass',now:()=>nowMs,
 })
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'FRESH_CANDIDATE_LIFECYCLE_CREATED')
 assert.equal(out.lastLifecycle.selectedSymbol,'PASS')
 assert.equal(out.entryValidationWriteFailures>0,true)
 assert.equal(out.lastEntryValidationError,'forced_evidence_write_failure')
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:active}).load().state,'CANDIDATE_SELECTED')
})


test('Module 13 no-trade evidence preserves snapshot provenance and authoritative session health',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,writes=[]
 const nowMs=Date.parse('2026-08-20T14:36:00.000Z')
 const r=createPaperAutoExecutionContinuityRuntime({
  env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},
  getScanSnapshot:async()=>({
   scanId:'under-five-77-2026-08-20T14:35:59.000Z',
   observedAt:'2026-08-20T14:35:59.000Z',
   sessionHealth:{marketHealthy:true,accountHealthy:true,brokerHealthy:true},
   candidates:[{symbol:'BEST',state:'WAIT',buyRecommendation:false,blocked:true,blockers:['STRATEGY_STATE_NOT_ENTER'],score:97}],
  }),
  appendEntryValidation:(input)=>{writes.push(input);return{record:input}},
  now:()=>nowMs,
 })
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'NO_ELIGIBLE_CANDIDATE')
 const closeout=writes.find(x=>x.eventType==='no_trade_closeout')
 assert.ok(closeout)
 assert.equal(closeout.scanId,'under-five-77-2026-08-20T14:35:59.000Z')
 assert.notEqual(closeout.correlationId,'entry:unknown')
 assert.equal(closeout.session.marketHealthy,true)
 assert.equal(closeout.session.accountHealthy,true)
 assert.equal(closeout.session.brokerHealthy,true)
 assert.equal(closeout.session.orderSubmitted,false)
})

test('portfolio mode permits fresh different-symbol lifecycle while monitored symbol remains independently owned',async()=>{
 const d=tmp(),owned=path.join(d,'paper_auto_execution_owned.json')
 const s=new PaperAutoExecutionLifecycleStore({filePath:owned,idFactory:()=> 'owned-life'})
 s.create({selectedSymbol:'OWN',scannerEvidence:{source:'paper_auto_continuity_scanner_candidate',paperOnly:true}})
 s.transition('ENTER_SUBMITTING',{enterClientOrderId:'e'})
 s.transition('ENTER_OPEN',{enterBrokerOrderId:'b'})
 s.transition('POSITION_CONFIRMED',{filledQuantity:1,averageFillPrice:4,brokerPositionIdentity:'OWN:1'})
 s.transition('MONITORING')
 let published=null
 const nowMs=Date.parse('2026-08-24T15:00:10Z')
 const portfolio={rows:[{file:owned,lifecycle:s.load(),lifecycleId:'owned-life',symbol:'OWN',state:'MONITORING'}],symbols:['OWN']}
 const r=createPaperAutoExecutionContinuityRuntime({
  env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,
  getActiveLifecycleFile:()=>owned,
  getLifecyclePortfolio:()=>portfolio,
  filterSnapshotForPortfolio:(snapshot,p)=>({...snapshot,candidates:snapshot.candidates.filter(c=>!p.symbols.includes(c.symbol))}),
  setActiveLifecycleFile:(file)=>{published=file},
  getScanSnapshot:async()=>({observedAt:'2026-08-24T15:00:00Z',candidates:[
   {symbol:'OWN',state:'ENTER',buyRecommendation:true,score:100},
   {symbol:'NEW',state:'ENTER',buyRecommendation:true,score:99},
  ]}),
  idFactory:()=> 'new-life',now:()=>nowMs,
 })
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'FRESH_CANDIDATE_LIFECYCLE_CREATED')
 assert.equal(out.lastLifecycle.selectedSymbol,'NEW')
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:owned}).load().state,'MONITORING')
 assert.equal(published,path.join(d,'paper_auto_execution_new-life.json'))
})

test('portfolio mode expires stale candidate-selected lifecycle after one fresh scan shows symbol no longer eligible', async () => {
  const d = tmp()
  const file = path.join(d, 'paper_auto_execution_old.json')
  ownedCandidate(file, { symbol: 'OLD' })
  const nowMs = Date.parse('2026-08-13T01:01:00Z')
  let reads = 0
  let scans = 0
  const portfolio = () => {
    reads += 1
    const lifecycle = new PaperAutoExecutionLifecycleStore({ filePath: file }).load()
    return lifecycle?.state === 'CANDIDATE_SELECTED'
      ? { rows: [{ file, lifecycle, lifecycleId: lifecycle.lifecycleId, symbol: lifecycle.selectedSymbol, state: lifecycle.state }], symbols: [lifecycle.selectedSymbol] }
      : { rows: [], symbols: [] }
  }
  const r = createPaperAutoExecutionContinuityRuntime({
    env: {
      PAPER_AUTO_CONTINUITY_ENABLED: '1',
      PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED: '1',
    },
    runsDir: d,
    now: () => nowMs,
    getLifecyclePortfolio: portfolio,
    filterSnapshotForPortfolio: snapshot => snapshot,
    getScanSnapshot: async () => {
      scans += 1
      return { observedAt: '2026-08-13T01:01:00Z', candidates: [] }
    },
  })
  const out = await r.runOnce()
  const expired = new PaperAutoExecutionLifecycleStore({ filePath: file }).load()
  assert.equal(out.lastStatus, 'STALE_CANDIDATE_EXPIRED')
  assert.equal(out.lastLifecycleFile, file)
  assert.equal(out.lastLifecycle.state, 'CANDIDATE_EXPIRED')
  assert.equal(expired.state, 'CANDIDATE_EXPIRED')
  assert.equal(expired.reconciliation.at(-1).reason, 'FRESH_SCAN_NO_LONGER_ELIGIBLE')
  assert.equal(scans, 1)
  assert.equal(reads, 2)
})

test('portfolio mode preserves stale candidate-selected lifecycle when fresh scan still revalidates symbol', async () => {
  const d = tmp()
  const file = path.join(d, 'paper_auto_execution_old.json')
  ownedCandidate(file, { symbol: 'OLD' })
  const nowMs = Date.parse('2026-08-13T01:01:00Z')
  let scans = 0
  const getLifecyclePortfolio = () => {
    const lifecycle = new PaperAutoExecutionLifecycleStore({ filePath: file }).load()
    return { rows: [{ file, lifecycle, lifecycleId: lifecycle.lifecycleId, symbol: lifecycle.selectedSymbol, state: lifecycle.state }], symbols: [lifecycle.selectedSymbol] }
  }
  const r = createPaperAutoExecutionContinuityRuntime({
    env: {
      PAPER_AUTO_CONTINUITY_ENABLED: '1',
      PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED: '1',
    },
    runsDir: d,
    now: () => nowMs,
    getLifecyclePortfolio,
    filterSnapshotForPortfolio: (snapshot, portfolio) => ({
      ...snapshot,
      candidates: snapshot.candidates.filter(candidate => !portfolio.symbols.includes(candidate.symbol)),
    }),
    getScanSnapshot: async () => {
      scans += 1
      return {
        observedAt: '2026-08-13T01:01:00Z',
        candidates: [{ symbol: 'OLD', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 100 }],
      }
    },
  })
  const out = await r.runOnce()
  assert.equal(out.lastStatus, 'NO_ELIGIBLE_CANDIDATE')
  assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
  assert.equal(scans, 1)
})

test('portfolio mode fails closed without expiring stale candidate when expiration snapshot is stale', async () => {
  const d = tmp()
  const file = path.join(d, 'paper_auto_execution_old.json')
  ownedCandidate(file, { symbol: 'OLD' })
  const nowMs = Date.parse('2026-08-13T01:01:00Z')
  const getLifecyclePortfolio = () => {
    const lifecycle = new PaperAutoExecutionLifecycleStore({ filePath: file }).load()
    return { rows: [{ file, lifecycle, lifecycleId: lifecycle.lifecycleId, symbol: lifecycle.selectedSymbol, state: lifecycle.state }], symbols: [lifecycle.selectedSymbol] }
  }
  const r = createPaperAutoExecutionContinuityRuntime({
    env: {
      PAPER_AUTO_CONTINUITY_ENABLED: '1',
      PAPER_AUTO_CONTINUITY_CANDIDATE_EXPIRATION_ENABLED: '1',
    },
    runsDir: d,
    now: () => nowMs,
    getLifecyclePortfolio,
    filterSnapshotForPortfolio: snapshot => snapshot,
    getScanSnapshot: async () => ({ observedAt: '2026-08-13T01:00:29Z', candidates: [] }),
  })
  const out = await r.runOnce()
  assert.equal(out.lastStatus, 'FRESH_SCAN_REQUIRED_FOR_EXPIRATION')
  assert.equal(new PaperAutoExecutionLifecycleStore({ filePath: file }).load().state, 'CANDIDATE_SELECTED')
})


test('portfolio mode rechecks ownership before creation and reselects highest remaining eligible symbol', async () => {
  const d = tmp()
  const nowMs = Date.parse('2026-08-24T15:00:10Z')
  let reads = 0
  const r = createPaperAutoExecutionContinuityRuntime({
    env: { PAPER_AUTO_CONTINUITY_ENABLED: '1' },
    runsDir: d,
    now: () => nowMs,
    idFactory: () => 'reselected',
    getActiveLifecycleFile: () => null,
    getLifecyclePortfolio: async () => ++reads === 1
      ? { rows: [], symbols: [] }
      : { rows: [{ file: 'aaa.json', lifecycleId: 'aaa', symbol: 'AAA', state: 'MONITORING' }], symbols: ['AAA'] },
    filterSnapshotForPortfolio: (s, p) => ({ ...s, candidates: s.candidates.filter(c => !p.symbols.includes(c.symbol)) }),
    getScanSnapshot: async () => ({
      observedAt: '2026-08-24T15:00:00Z',
      candidates: [
        { symbol: 'AAA', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 100 },
        { symbol: 'BBB', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 90 },
      ],
    }),
  })
  const out = await r.runOnce()
  assert.equal(reads, 2)
  assert.equal(out.lastStatus, 'FRESH_CANDIDATE_LIFECYCLE_CREATED')
  assert.equal(out.lastLifecycle.selectedSymbol, 'BBB')
  assert.equal(fs.existsSync(path.join(d, 'paper_auto_execution_reselected.json')), true)
})

test('portfolio mode creates nothing when creation-time ownership consumes every eligible symbol', async () => {
  const d = tmp()
  const nowMs = Date.parse('2026-08-24T15:00:10Z')
  let reads = 0
  const r = createPaperAutoExecutionContinuityRuntime({
    env: { PAPER_AUTO_CONTINUITY_ENABLED: '1' },
    runsDir: d,
    now: () => nowMs,
    idFactory: () => 'must-not-create',
    getActiveLifecycleFile: () => null,
    getLifecyclePortfolio: async () => ++reads === 1
      ? { rows: [], symbols: [] }
      : { rows: [{ file: 'aaa.json', lifecycleId: 'aaa', symbol: 'AAA', state: 'MONITORING' }], symbols: ['AAA'] },
    filterSnapshotForPortfolio: (s, p) => ({ ...s, candidates: s.candidates.filter(c => !p.symbols.includes(c.symbol)) }),
    getScanSnapshot: async () => ({
      observedAt: '2026-08-24T15:00:00Z',
      candidates: [
        { symbol: 'AAA', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 100 },
      ],
    }),
  })
  const out = await r.runOnce()
  assert.equal(reads, 2)
  assert.equal(out.lastStatus, 'NO_ELIGIBLE_CANDIDATE')
  assert.equal(fs.existsSync(path.join(d, 'paper_auto_execution_must-not-create.json')), false)
})

test('portfolio mode creation-time recheck can reintroduce strongest candidate when prior ownership disappears', async () => {
  const d = tmp()
  const nowMs = Date.parse('2026-08-24T15:00:10Z')
  let reads = 0
  const r = createPaperAutoExecutionContinuityRuntime({
    env: { PAPER_AUTO_CONTINUITY_ENABLED: '1' },
    runsDir: d,
    now: () => nowMs,
    idFactory: () => 'reintroduced',
    getActiveLifecycleFile: () => null,
    getLifecyclePortfolio: async () => ++reads === 1
      ? { rows: [{ file: 'aaa.json', lifecycleId: 'aaa', symbol: 'AAA', state: 'MONITORING' }], symbols: ['AAA'] }
      : { rows: [{ file: 'bbb.json', lifecycleId: 'bbb', symbol: 'BBB', state: 'MONITORING' }], symbols: ['BBB'] },
    filterSnapshotForPortfolio: (s, p) => ({ ...s, candidates: s.candidates.filter(c => !p.symbols.includes(c.symbol)) }),
    getScanSnapshot: async () => ({
      observedAt: '2026-08-24T15:00:00Z',
      candidates: [
        { symbol: 'AAA', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 100 },
        { symbol: 'BBB', state: 'ENTER', buyRecommendation: true, blocked: false, blockers: [], score: 90 },
      ],
    }),
  })
  const out = await r.runOnce()
  assert.equal(reads, 2)
  assert.equal(out.lastStatus, 'FRESH_CANDIDATE_LIFECYCLE_CREATED')
  assert.equal(out.lastLifecycle.selectedSymbol, 'AAA')
  assert.equal(fs.existsSync(path.join(d, 'paper_auto_execution_reintroduced.json')), true)
})

test('wind-down blocks new lifecycle creation before pointer mutation',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,setCalls=0
 const nowMs=Date.parse('2026-08-13T01:00:10Z')
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{setCalls++;active=f},getScanSnapshot:async()=>({observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'NEW',state:'ENTER',buyRecommendation:true,score:99}]}),getPortfolioWindDownState:async()=>({resolved:true,active:true}),idFactory:()=> 'wind-blocked',now:()=>nowMs})
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'PORTFOLIO_WIND_DOWN_ENTER_BLOCKED')
 assert.equal(setCalls,0)
 assert.equal(active,old)
 assert.equal(fs.existsSync(path.join(d,'paper_auto_execution_wind-blocked.json')),false)
})

test('unresolved execution owner blocks new lifecycle creation fail closed',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,setCalls=0
 const nowMs=Date.parse('2026-08-13T01:00:10Z')
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{setCalls++;active=f},getScanSnapshot:async()=>({observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'NEW',state:'ENTER',buyRecommendation:true,score:99}]}),getPortfolioWindDownState:async()=>({resolved:false,active:true}),idFactory:()=> 'owner-unresolved',now:()=>nowMs})
 const out=await r.runOnce()
 assert.equal(out.lastStatus,'PAPER_EXECUTION_OWNER_ACCOUNT_UNRESOLVED')
 assert.equal(setCalls,0)
 assert.equal(active,old)
 assert.equal(fs.existsSync(path.join(d,'paper_auto_execution_owner-unresolved.json')),false)
})
