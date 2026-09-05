import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildAiLogicKnownGoodRecord } from "../src/scanner/ai_logic_known_good_record.mjs";
import { appendAiLogicKnownGoodRecord, readAiLogicKnownGoodRecordById } from "../src/scanner/ai_logic_known_good_record_store.mjs";

function fixture(){
  return buildAiLogicKnownGoodRecord({versionId:"kg-1",sourceCommit:"a".repeat(40),immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",logicScope:"scanner_logic",activeForProduction:true},{now:new Date("2026-09-02T08:50:00.000Z")});
}
function tmp(){const d=fs.mkdtempSync(path.join(os.tmpdir(),"kg-store-"));return {d,f:path.join(d,"known-good.jsonl")};}

test("persists exact canonical known-good record and reads exact id",()=>{
  const {d,f}=tmp(); try { const r=fixture(); const a=appendAiLogicKnownGoodRecord(r,f); assert.equal(a.appended,true); assert.deepEqual(a.record,r); const q=readAiLogicKnownGoodRecordById(r.recordId,f); assert.deepEqual(q,r); assert.equal(fs.statSync(f).mode & 0o777,0o600); } finally { fs.rmSync(d,{recursive:true,force:true}); }
});

test("deduplicates identical record without rebuilding identity",()=>{
  const {d,f}=tmp(); try { const r=fixture(); appendAiLogicKnownGoodRecord(r,f); const a=appendAiLogicKnownGoodRecord(r,f); assert.equal(a.appended,false); assert.equal(a.record.recordedAt,r.recordedAt); assert.equal(fs.readFileSync(f,"utf8").trim().split("\n").length,1); } finally { fs.rmSync(d,{recursive:true,force:true}); }
});

test("fails closed on missing duplicate malformed and lock drift",()=>{
  const {d,f}=tmp(); try { const r=fixture(); assert.throws(()=>readAiLogicKnownGoodRecordById(r.recordId,f),/NOT_FOUND/); fs.writeFileSync(f,"not-json\n"); assert.throws(()=>readAiLogicKnownGoodRecordById(r.recordId,f),/MALFORMED/); fs.writeFileSync(f,JSON.stringify(r)+"\n"+JSON.stringify(r)+"\n"); assert.throws(()=>readAiLogicKnownGoodRecordById(r.recordId,f),/DUPLICATE/); fs.writeFileSync(f,JSON.stringify({...r,orderPlacementAllowed:true})+"\n"); assert.throws(()=>readAiLogicKnownGoodRecordById(r.recordId,f),/LOCK_OPEN_orderPlacementAllowed/); } finally { fs.rmSync(d,{recursive:true,force:true}); }
});

test("rejects noncanonical known-good state and identity drift",()=>{
  const {d,f}=tmp(); try { const r=fixture(); assert.throws(()=>appendAiLogicKnownGoodRecord({...r,status:"KNOWN_GOOD_RECORD_HOLD"},f),/RECORD_INVALID/); appendAiLogicKnownGoodRecord(r,f); assert.throws(()=>appendAiLogicKnownGoodRecord({...r,logicScope:"other"},f),/IDENTITY_DRIFT/); } finally { fs.rmSync(d,{recursive:true,force:true}); }
});
