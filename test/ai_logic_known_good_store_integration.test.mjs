import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildAiLogicKnownGoodRecord } from "../src/scanner/ai_logic_known_good_record.mjs";
import { appendAiLogicKnownGoodRecord } from "../src/scanner/ai_logic_known_good_record_store.mjs";
import { resolveAndBindAiLogicKnownGoodFromStore as resolve } from "../src/scanner/ai_logic_known_good_store_integration.mjs";

function fixture(){
  return buildAiLogicKnownGoodRecord({
    versionId:"kg-1",
    sourceCommit:"a".repeat(40),
    immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",
    logicScope:"scanner_logic",
    activeForProduction:true,
  },{now:new Date("2026-09-02T08:50:00.000Z")});
}
function tmp(){
  const d=fs.mkdtempSync(path.join(os.tmpdir(),"kg-int-"));
  return {d,f:path.join(d,"known-good.jsonl")};
}

test("resolves exact persisted known-good record with source commit binding",()=>{
  const {d,f}=tmp();
  try{
    const r=fixture();
    appendAiLogicKnownGoodRecord(r,f);
    const out=resolve({knownGoodRecordId:r.recordId,sourceCommitBefore:r.sourceCommit},{filePath:f});
    assert.equal(out.eligible,true);
    assert.deepEqual(out.knownGood,r);
    assert.equal(out.readOnly,true);
    assert.equal(out.storeWritePerformed,false);
    assert.equal(out.productionRuntimeWiringAllowed,false);
    assert.equal(out.gitMutationAllowed,false);
  } finally { fs.rmSync(d,{recursive:true,force:true}); }
});

test("fails closed on source commit drift and missing record",()=>{
  const {d,f}=tmp();
  try{
    const r=fixture();
    appendAiLogicKnownGoodRecord(r,f);
    const drift=resolve({knownGoodRecordId:r.recordId,sourceCommitBefore:"b".repeat(40)},{filePath:f});
    assert.equal(drift.eligible,false);
    assert.match(drift.reasons.join(","),/SOURCE_COMMIT_MISMATCH/);
    const missing=resolve({knownGoodRecordId:"missing",sourceCommitBefore:r.sourceCommit},{filePath:f});
    assert.equal(missing.eligible,false);
    assert.match(missing.reasons.join(","),/NOT_FOUND/);
  } finally { fs.rmSync(d,{recursive:true,force:true}); }
});

test("fails closed on malformed persisted ledger",()=>{
  const {d,f}=tmp();
  try{
    fs.writeFileSync(f,"not-json\n");
    const out=resolve({knownGoodRecordId:"k1",sourceCommitBefore:"a".repeat(40)},{filePath:f});
    assert.equal(out.eligible,false);
    assert.match(out.reasons.join(","),/MALFORMED/);
  } finally { fs.rmSync(d,{recursive:true,force:true}); }
});
