import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';
import{derivePaperPositionMutationLockFile as D,acquirePaperPositionMutationLock as A,releasePaperPositionMutationLock as R}from'../src/scanner/paper_auto_execution_position_mutation_lock.mjs';
const N=Date.parse('2026-08-15T12:00:00Z');
test('exclusive shared mutation lock blocks concurrent scale or exit and releases exact owner',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'position-lock-'));try{const life=path.join(d,'life.json'),f=D(life);const a=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'scale_out',now:()=>N,tokenFactory:()=> 't1'});assert.equal(a.status,'POSITION_MUTATION_LOCK_ACQUIRED');const b=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'exit',now:()=>N,tokenFactory:()=> 't2'});assert.equal(b.status,'POSITION_MUTATION_LOCK_HELD');assert.equal(R(a).status,'POSITION_MUTATION_LOCK_RELEASED');const c=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'exit',now:()=>N,tokenFactory:()=> 't3'});assert.equal(c.status,'POSITION_MUTATION_LOCK_ACQUIRED');R(c);assert.equal(fs.existsSync(f),false)}finally{fs.rmSync(d,{recursive:true,force:true})}})
test('tampered lock cannot be released as original owner',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'position-lock-tamper-'));try{const f=D(path.join(d,'life.json')),a=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'scale_in',tokenFactory:()=> 't1'});const j=JSON.parse(fs.readFileSync(f,'utf8'));j.token='other';fs.writeFileSync(f,JSON.stringify(j));assert.throws(()=>R(a),/paper_position_mutation_lock_token_changed/);assert.equal(fs.existsSync(f),true);fs.rmSync(f,{force:true})}finally{fs.rmSync(d,{recursive:true,force:true})}})

test('stale definitely-dead owner is quarantined and recovered',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'position-lock-stale-dead-'))
 try{
  const f=D(path.join(d,'life.json')),base=Date.now()
  const a=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'scale_out',now:()=>base,tokenFactory:()=> 'old'})
  assert.equal(a.status,'POSITION_MUTATION_LOCK_ACQUIRED')
  const b=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'exit',now:()=>base+60000,tokenFactory:()=> 'new',ownerDefinitelyDead:()=>true,staleMs:30000})
  assert.equal(b.status,'POSITION_MUTATION_LOCK_ACQUIRED')
  assert.equal(b.token,'new')
  assert.equal(fs.readdirSync(d).filter(x=>x.includes('.stale-')).length,0)
  R(b)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('recent or not-definitely-dead owner remains fail-closed',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'position-lock-stale-block-'))
 try{
  const f=D(path.join(d,'life.json')),base=Date.now()
  const a=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'scale_in',now:()=>base,tokenFactory:()=> 'held'})
  const recent=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'exit',now:()=>base+1000,tokenFactory:()=> 'r',ownerDefinitelyDead:()=>true,staleMs:30000})
  assert.equal(recent.status,'POSITION_MUTATION_LOCK_HELD')
  const alive=A({lockFile:f,lifecycleId:'life-1',symbol:'ABC',action:'exit',now:()=>base+60000,tokenFactory:()=> 'a',ownerDefinitelyDead:()=>false,staleMs:30000})
  assert.equal(alive.status,'POSITION_MUTATION_LOCK_HELD')
  R(a)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})
