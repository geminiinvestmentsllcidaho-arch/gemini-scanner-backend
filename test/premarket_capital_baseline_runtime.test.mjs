import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';
import{collectPremarketCapitalBaseline as C,getPersistedPremarketCapitalBaseline as G}from'../src/scanner/premarket_capital_baseline_runtime.mjs';
const A={ok:true,status:'connected_readonly',mode:'PAPER_ONLY',observedAt:'2026-08-17T11:31:00Z',account:{accountIdentity:'alpaca-paper:89abcdef0123456789abcdef',equity:25000,buyingPower:50000,cash:20000,portfolioValue:25000},positions:[]};
test('exact-session persisted reuse avoids second broker read',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'pbr-'));try{const f=path.join(d,'b.json');let n=0,F=async()=>{n++;return A};const a=await C({now:new Date('2026-08-17T11:30:00Z'),fetchPaperAccount:F,filePath:f,auditFile:path.join(d,'a.jsonl')});assert.equal(a.accountEquity,25000);const b=await C({now:new Date('2026-08-17T12:00:00Z'),fetchPaperAccount:F,filePath:f,auditFile:path.join(d,'a.jsonl')});assert.equal(b.ok,true);assert.equal(n,1);assert.equal(G({now:new Date('2026-08-17T15:00:00Z'),filePath:f,auditFile:path.join(d,'a.jsonl')}).accountEquity,25000)}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('non-PAPER disconnected and stale session fail closed',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'pbb-'));try{const f=path.join(d,'b.json');assert.equal((await C({now:new Date('2026-08-17T11:30:00Z'),fetchPaperAccount:async()=>({...A,mode:'LIVE'}),filePath:f,auditFile:path.join(d,'a.jsonl')})).status,'PAPER_READONLY_ACCOUNT_REQUIRED');assert.equal((await C({now:new Date('2026-08-17T11:30:00Z'),fetchPaperAccount:async()=>({...A,status:'not_connected_readonly'}),filePath:f,auditFile:path.join(d,'a.jsonl')})).status,'PAPER_READONLY_ACCOUNT_REQUIRED');assert.equal(G({now:new Date('2026-08-18T11:30:00Z'),filePath:f,auditFile:path.join(d,'a.jsonl')}),null)}finally{fs.rmSync(d,{recursive:true,force:true})}});

test('persisted current-session baseline is unavailable when its audit record is missing',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'pbm-'))
 try{
  const f=path.join(d,'b.json'),a=path.join(d,'a.jsonl'),now=new Date('2026-08-17T11:30:00Z')
  await C({now,fetchPaperAccount:async()=>A,filePath:f,auditFile:a})
  fs.unlinkSync(a)
  assert.equal(G({now,filePath:f,auditFile:a}),null)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('persisted current-session baseline is unavailable when audit baseline mismatches latest state',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'pbx-'))
 try{
  const f=path.join(d,'b.json'),a=path.join(d,'a.jsonl'),now=new Date('2026-08-17T11:30:00Z')
  await C({now,fetchPaperAccount:async()=>A,filePath:f,auditFile:a})
  const row=JSON.parse(fs.readFileSync(a,'utf8').trim())
  row.baseline={...row.baseline,accountEquity:Number(row.baseline.accountEquity)+1}
  fs.writeFileSync(a,`${JSON.stringify(row)}\n`,{mode:0o600})
  assert.equal(G({now,filePath:f,auditFile:a}),null)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})
