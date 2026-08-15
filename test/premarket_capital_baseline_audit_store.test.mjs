import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import os from'node:os'
import path from'node:path'
import{ensurePremarketCapitalBaselineAuditRecord as E,readPremarketCapitalBaselineAudit as R}from'../src/scanner/premarket_capital_baseline_audit_store.mjs'

const B={ok:true,status:'PREMARKET_CAPITAL_BASELINE_READY',observedAt:'2026-08-17T11:30:00.000Z',accountIdentity:'alpaca-paper:fedcba9876543210fedcba98',accountEquity:25000,buyingPower:50000,paperOnly:true,readOnly:true}

test('appends one durable 0600 immutable record per session and exact replay is idempotent',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'pba-'))
 try{
  const f=path.join(d,'audit.jsoln')
  const a=E({auditFile:f,sessionDate:'2026-08-17',baseline:B})
  const b=E({auditFile:f,sessionDate:'2026-08-17',baseline:B})
  assert.equal(a.appended,true)
  assert.equal(b.appended,false)
  assert.equal(R({auditFile:f}).length,1)
  assert.equal(R({auditFile:f})[0].baseline.accountEquity,25000)
  assert.equal(fs.statSync(f).mode&0o777,0o600)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('same-session drift conflicts fail closed and invalid PAPER/date records are rejected',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"pbc-"))
 try{
  const f=path.join(d,'audit.jsonl')
 E({auditFile:f,sessionDate:'2026-08-17',baseline:B})
 assert.throws(()=>E({auditFile:f,sessionDate:'2026-08-17',baseline:{...B,accountEquity:26000}}),/session_conflict/)
 assert.throws(()=>E({auditFile:f,sessionDate:'bad',baseline:B}),/session_date_required/)
 assert.throws(()=>E({auditFile:f,sessionDate:'2026-08-18',baseline:{...B,paperOnly:false}}),/audit_invalid/)
 assert.equal(R({auditFile:f}).length,1)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('malformed or invalid existing audit ledger fails closed instead of being treated as empty',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"pbd-"))
 try{
  const malformed=path.join(d,'malformed.jsonl')
 fs.writeFileSync(malformed,'{"version":\n',{mode:0o600})
 assert.throws(()=>R({auditFile:malformed}),/malformed_ledger/)
 assert.throws(()=>E({auditFile:malformed,sessionDate:'2026-08-17',baseline:B}),/malformed_ledger/)
 assert.equal(fs.readFileSync(malformed,'utf8'),'{"version":\n')

 const invalid=path.join(d,'invalid.jsonl')
 fs.writeFileSync(invalid,`${JSON.stringify({version:'wrong-version',sessionDate:'2026-08-17',baseline:B})}\n`,{mode:0o600})
 assert.throws(()=>R({auditFile:invalid}),/invalid_ledger_record/)
 assert.throws(()=>E({auditFile:invalid,sessionDate:'2026-08-17',baseline:B}),/invalid_ledger_record/)
 assert.equal(fs.readFileSync(invalid,'utf8').split('\n').filter(Boolean).length,1)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})

test('held same-session audit lock blocks concurrent append before ledger mutation',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'pbl-'))
 try{
  const f=path.join(d,'audit.jsonl')
  E({auditFile:f,sessionDate:'2026-08-17',baseline:B})
  const before=fs.readFileSync(f,'utf8')
  const lock=`${f}.2026-08-18.lock`
  const fd=fs.openSync(lock,'wx',0o600)
  try{fs.writeFileSync(fd,'999999\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  assert.throws(()=>E({auditFile:f,sessionDate:'2026-08-18',baseline:{...B,observedAt:'2026-08-18T11:30:00.000Z'}}),/session_lock_held/)
  assert.equal(fs.readFileSync(f,'utf8'),before)
  assert.equal(R({auditFile:f}).length,1)
  assert.equal(fs.existsSync(lock),true)
 }finally{fs.rmSync(d,{recursive:true,force:true})}
})
