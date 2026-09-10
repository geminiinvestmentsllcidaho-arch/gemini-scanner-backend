import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {buildAiLogicApplyOutcomeRecord,appendAiLogicApplyOutcomeRecord,listAiLogicApplyOutcomeRecords} from "../src/scanner/ai_logic_apply_outcome_store.mjs";

const h="a".repeat(64);
const approval=Object.freeze({
  version:"ai_logic_operator_approval_record_v1",valid:true,explicitlyApproved:true,oneShot:true,paperOnly:true,
  recordId:"approval-1",nonce:"nonce-123",action:"PROMOTION",decisionRecordId:"decision-1",knownGoodRecordId:"kg-1",
  candidateSourceHash:"b".repeat(64),candidatePath:"src/scanner/ai_logic_candidates/x.mjs",candidateTopic:"classification_coverage",
  sourceCommitBefore:"before",sourceCommitAfter:"after",
});
const success=Object.freeze({
  applied:true,rolledBack:false,status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",
  candidateSourceHash:approval.candidateSourceHash,candidatePath:approval.candidatePath,candidateTopic:approval.candidateTopic,
});

test("builds immutable local-only apply outcome with closed authorities",()=>{
  const r=buildAiLogicApplyOutcomeRecord({receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h},{now:"2026-09-09T22:00:00Z"});
  assert.equal(r.applied,true);
  assert.equal(r.outcomeStatus,success.status);
  assert.equal(r.currentSourceCommit,"before");
  assert.equal(r.targetSourceCommit,"after");
  assert.equal(r.runtimeActivated,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.immutablePolicyMutationAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});

test("rejects receipt provenance drift and inconsistent success shape",()=>{
  assert.throws(()=>buildAiLogicApplyOutcomeRecord({receipt:{...success,candidatePath:"src/scanner/ai_logic_candidates/y.mjs"},operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h}),/RECEIPT_BINDING_MISMATCH_candidatePath/);
  assert.throws(()=>buildAiLogicApplyOutcomeRecord({receipt:{...success,applied:false},operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h}),/SUCCESS_SHAPE_INVALID/);
});

test("persists once at 0600 and lists newest first",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const a=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"});
    const b=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"});
    assert.equal(a.appended,true);
    assert.equal(b.duplicateSkipped,true);
    assert.equal(fs.statSync(filePath).mode&0o777,0o600);
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});


test("retry with a later recordedAt is idempotent and preserves the original record",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-retry-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const first=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"});
    const retry=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:01:00Z"});
    assert.equal(first.appended,true);
    assert.equal(retry.appended,false);
    assert.equal(retry.duplicateSkipped,true);
    assert.equal(retry.record.recordId,first.record.recordId);
    assert.equal(retry.record.recordedAt,first.record.recordedAt);
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("one approval operation identity cannot record a conflicting outcome",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-drift-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const base={operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    appendAiLogicApplyOutcomeRecord({...base,receipt:{...success,applied:false,status:"ATOMIC_APPLY_BLOCKED_PRECONDITION"}},{filePath,now:"2026-09-09T22:00:00Z"});
    assert.throws(
      ()=>appendAiLogicApplyOutcomeRecord({...base,receipt:{...success,applied:false,status:"ATOMIC_APPLY_FAILED_BEFORE_RENAME"}},{filePath,now:"2026-09-09T22:01:00Z"}),
      /APPLY_OUTCOME_IDENTITY_DRIFT/
    );
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("exact reader resolves records older than list limit and fails closed on duplicate or malformed ledger",async()=>{
  const {readAiLogicApplyOutcomeRecordById}=await import("../src/scanner/ai_logic_apply_outcome_store.mjs");
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-exact-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    let firstId=null;
    for(let i=0;i<101;i++){
      const a={...approval,recordId:`approval-${i}`,nonce:`nonce-${i}`};
      const r=appendAiLogicApplyOutcomeRecord({receipt:{...success},operatorApproval:a,operationId:`operation-${String(i).padStart(8,"0")}`,expectedPreimageHash:h},{filePath,now:new Date(Date.UTC(2026,8,9,22,0,i)).toISOString()});
      if(i===0) firstId=r.record.recordId;
    }
    assert.equal(listAiLogicApplyOutcomeRecords({filePath,limit:100}).some(r=>r.recordId===firstId),false);
    assert.equal(readAiLogicApplyOutcomeRecordById(firstId,filePath).recordId,firstId);
    const row=readAiLogicApplyOutcomeRecordById(firstId,filePath);
    fs.appendFileSync(filePath,JSON.stringify(row)+"\n");
    assert.throws(()=>readAiLogicApplyOutcomeRecordById(firstId,filePath),/DUPLICATE_RECORD_ID/);
    fs.writeFileSync(filePath,"{bad json\n");
    assert.throws(()=>readAiLogicApplyOutcomeRecordById(firstId,filePath),/LEDGER_MALFORMED/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("list reader fails closed on invalid authority or effect rows",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-list-closed-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const written=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}).record;
    for(const drift of [
      {...written,runtimeActivationAllowed:true},
      {...written,brokerOrderAccountEffects:"ORDER"},
      {...written,paperOnly:false},
    ]){
      fs.writeFileSync(filePath,JSON.stringify(drift)+"\n");
      assert.throws(()=>listAiLogicApplyOutcomeRecords({filePath}),/APPLY_OUTCOME_(LOCK_OPEN_runtimeActivationAllowed|EFFECTS_INVALID|RECORD_INVALID)/);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
