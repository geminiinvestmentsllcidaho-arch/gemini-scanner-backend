import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionContinuityRuntime } from '../src/scanner/paper_auto_execution_continuity_runtime.mjs'
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'paper-cont-'))
function terminal(file){const s=new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=> 'old-life'});s.create({selectedSymbol:'BTG'});s.transition('ENTER_SUBMITTING',{enterClientOrderId:'e'});s.transition('ENTER_UNKNOWN',{enterBrokerOrderId:'eb'});s.transition('POSITION_CONFIRMED',{filledQuantity:1,averageFillPrice:4.12,brokerPositionIdentity:'BTG:1'});s.transition('MONITORING');s.transition('EXIT_TRIGGERED',{exitClientOrderId:'x'});s.transition('EXIT_SUBMITTING',{exitBrokerOrderId:'xb'});return s.transition('ROUND_TRIP_COMPLETED')}
test('terminal preserved and no candidate creates nothing',async()=>{const d=tmp(),old=path.join(d,'old.json'),before=terminal(old);let active=old;const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({candidates:[]}),idFactory:()=> 'new-life'});const out=await r.runOnce();assert.equal(out.lastStatus,'NO_ELIGIBLE_CANDIDATE');assert.equal(active,old);assert.deepEqual(new PaperAutoExecutionLifecycleStore({filePath:old}).load(),before)})
test('eligible ENTER creates one fresh lifecycle and preserves terminal evidence',async()=>{const d=tmp(),old=path.join(d,'old.json'),before=terminal(old);let active=old;const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>({observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'NEW',state:'ENTER',buyRecommendation:true,score:9}]}),idFactory:()=> 'new-life'});const out=await r.runOnce();assert.equal(out.lastStatus,'FRESH_CANDIDATE_LIFECYCLE_CREATED');assert.notEqual(active,old);assert.equal(out.lastLifecycle.state,'CANDIDATE_SELECTED');assert.equal(out.lastLifecycle.selectedSymbol,'NEW');assert.equal(out.lastLifecycle.enterIdentity.phase,'enter');assert.deepEqual(new PaperAutoExecutionLifecycleStore({filePath:old}).load(),before)})
test('concurrent cycles deduplicate and active nonterminal blocks replacement',async()=>{const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,scans=0;const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:f=>{active=f},getScanSnapshot:async()=>{scans++;await new Promise(x=>setTimeout(x,10));return{candidates:[{symbol:'ABC',state:'ENTER',buyRecommendation:true}]}},idFactory:()=> 'only-one'});const[a,b]=await Promise.all([r.runOnce(),r.runOnce()]);assert.equal(scans,1);assert.equal(a.lastLifecycleFile,b.lastLifecycleFile);const c=await r.runOnce();assert.equal(c.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT')})
test('disabled by default and safety is nonmutating',async()=>{const r=createPaperAutoExecutionContinuityRuntime({env:{},getScanSnapshot:async()=>({candidates:[{symbol:'XYZ',state:'ENTER',buyRecommendation:true}]})});const out=await r.runOnce();assert.equal(out.lastStatus,'CONTINUITY_DISABLED_BY_ENV');assert.equal(out.safety.paperOnly,true);assert.equal(out.safety.brokerContactAllowed,false);assert.equal(out.safety.orderPlacementAllowed,false);assert.equal(out.safety.accountMutationAllowed,false);assert.equal(out.safety.liveTradingAllowed,false)})


test('pointer publish failure retains created lifecycle in-process and retry cannot create a duplicate',async()=>{
 const d=tmp(),old=path.join(d,'old.json');terminal(old);let active=old,setCalls=0,scans=0
 const r=createPaperAutoExecutionContinuityRuntime({env:{PAPER_AUTO_CONTINUITY_ENABLED:'1'},runsDir:d,getActiveLifecycleFile:()=>active,setActiveLifecycleFile:()=>{setCalls++;throw new Error('forced_pointer_write_failure')},getScanSnapshot:async()=>{scans++;return{observedAt:'2026-08-13T01:00:00Z',candidates:[{symbol:'SAFE',state:'ENTER',buyRecommendation:true,score:99}]}},idFactory:()=> 'pointer-failure-life'})
 await assert.rejects(r.runOnce(),/forced_pointer_write_failure/)
 const created=path.join(d,'paper_auto_execution_pointer-failure-life.json')
 assert.equal(fs.existsSync(created),true)
 assert.equal(new PaperAutoExecutionLifecycleStore({filePath:created}).load().selectedSymbol,'SAFE')
 const retry=await r.runOnce()
 assert.equal(retry.lastStatus,'ACTIVE_NONTERMINAL_LIFECYCLE_PRESENT')
 assert.equal(retry.lastLifecycleFile,created)
 assert.equal(setCalls,1)
 assert.equal(scans,1)
 assert.equal(fs.readdirSync(d).filter(name=>name.startsWith('paper_auto_execution_')&&name.endsWith('.json')).length,1)
})


function ownedCandidate(file,{observedAt='2026-08-13T01:00:00Z',symbol='OLD',patch={}}={}){
 const s=new PaperAutoExecutionLifecycleStore({filePath:file,idFactory:()=>`life-${symbol}`,clock:()=>Date.parse(observedAt)})
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
 assert.equal(out.lastStatus,'NO_ELIGIBLE_CANDIDATE')
 assert.equal(expired.state,'CANDIDATE_EXPIRED')
 assert.equal(expired.reconciliation.at(-1).kind,'candidate_expired')
 assert.equal(expired.reconciliation.at(-1).revalidatedAt,'2026-08-13T01:01:00Z')
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
