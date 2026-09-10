import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendAiLogicApplyOutcomeRecord } from "../src/scanner/ai_logic_apply_outcome_store.mjs";
import { resolveAndBindAiLogicApplyOutcomePersistence as resolve } from "../src/scanner/ai_logic_apply_outcome_persistence_binding.mjs";

const closed = {
  runtimeWiringAllowed:false,
  productionRuntimeWiringAllowed:false,
  brokerContactAllowed:false,
  orderPlacementAllowed:false,
  liveTradingAllowed:false,
  accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,
  sizingMutationAllowed:false,
  allocationMutationAllowed:false,
  gitMutationAllowed:false,
};

const approval = {
  version:"ai_logic_operator_approval_record_v1",
  valid:true,
  explicitlyApproved:true,
  oneShot:true,
  paperOnly:true,
  recordId:"approval-1",
  nonce:"nonce-1",
  action:"PROMOTION",
  decisionRecordId:"decision-1",
  knownGoodRecordId:"known-good-1",
  candidateSourceHash:"a".repeat(64),
  candidatePath:"src/scanner/ai_logic_candidates/c1.mjs",
  candidateTopic:"classification_coverage",
  sourceCommitBefore:"b".repeat(40),
  sourceCommitAfter:"c".repeat(40),
};

const receipt = {
  executed:true,
  consumed:true,
  applied:true,
  rolledBack:false,
  status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",
  candidateSourceHash:approval.candidateSourceHash,
  candidatePath:approval.candidatePath,
  candidateTopic:approval.candidateTopic,
};

function persisted(filePath){
  const out=appendAiLogicApplyOutcomeRecord({
    receipt,
    operatorApproval:approval,
    operationId:"operation-12345678",
    expectedPreimageHash:"d".repeat(64),
  },{filePath,now:"2026-09-09T22:30:00Z"});
  return {
    attempted:true,
    persisted:true,
    appended:out.appended,
    duplicateSkipped:out.duplicateSkipped,
    recordId:out.record.recordId,
    status:"APPLY_OUTCOME_PERSISTED",
    error:null,
  };
}

function tmp(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"apply-outcome-binding-"));
  return {dir,filePath:path.join(dir,"outcomes.jsonl")};
}

test("binds exact durable apply outcome record and keeps all authority closed",()=>{
  const {dir,filePath}=tmp();
  try{
    const p=persisted(filePath);
    const r=resolve({applyOutcomePersistence:p},{filePath});
    assert.equal(r.eligible,true);
    assert.equal(r.durable,true);
    assert.equal(r.applyOutcomeRecord.recordId,p.recordId);
    assert.equal(r.persistenceReceipt.appended,true);
    assert.equal(r.persistenceReceipt.duplicateSkipped,false);
    assert.equal(r.readOnly,true);
    assert.equal(r.evidenceOnly,true);
    for(const [k,v] of Object.entries(closed)) assert.equal(r[k],v,k);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test("accepts idempotent duplicate skip as durable existing evidence without claiming fresh append",()=>{
  const {dir,filePath}=tmp();
  try{
    persisted(filePath);
    const p=persisted(filePath);
    assert.equal(p.appended,false);
    assert.equal(p.duplicateSkipped,true);
    const r=resolve({applyOutcomePersistence:p},{filePath});
    assert.equal(r.eligible,true);
    assert.equal(r.durable,true);
    assert.equal(r.persistenceReceipt.appended,false);
    assert.equal(r.persistenceReceipt.duplicateSkipped,true);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test("fails closed when persistence receipt is missing failed or contradictory",()=>{
  const cases=[
    undefined,
    {attempted:true,persisted:false,appended:false,duplicateSkipped:false,recordId:null,status:"APPLY_OUTCOME_PERSIST_FAILED",error:"ledger unavailable"},
    {attempted:true,persisted:true,appended:true,duplicateSkipped:true,recordId:"x",status:"APPLY_OUTCOME_PERSISTED",error:null},
    {attempted:true,persisted:true,appended:false,duplicateSkipped:false,recordId:"x",status:"APPLY_OUTCOME_PERSISTED",error:null},
    {attempted:true,persisted:true,appended:true,duplicateSkipped:false,recordId:null,status:"APPLY_OUTCOME_PERSISTED",error:null},
  ];
  for(const p of cases){
    const r=resolve({applyOutcomePersistence:p},{filePath:"/tmp/does-not-matter.jsonl"});
    assert.equal(r.eligible,false);
    assert.equal(r.durable,false);
    assert.equal(r.applyOutcomeRecord,null);
    assert.equal(r.liveTradingAllowed,false);
    assert.equal(r.gitMutationAllowed,false);
  }
});

test("persistence failure error remains visible in fail-closed receipt",()=>{
  const p={attempted:true,persisted:false,appended:false,duplicateSkipped:false,recordId:null,status:"APPLY_OUTCOME_PERSIST_FAILED",error:"ledger unavailable"};
  const r=resolve({applyOutcomePersistence:p});
  assert.equal(r.eligible,false);
  assert.equal(r.persistenceReceipt.error,"ledger unavailable");
  assert.match(r.reasons.join(","),/PERSISTENCE_REQUIRED/);
  assert.match(r.reasons.join(","),/STATUS_INVALID/);
  assert.match(r.reasons.join(","),/ERROR_PRESENT/);
});

test("fails closed when claimed persisted record is absent",()=>{
  const {dir,filePath}=tmp();
  try{
    const p={attempted:true,persisted:true,appended:true,duplicateSkipped:false,recordId:"missing-record",status:"APPLY_OUTCOME_PERSISTED",error:null};
    const r=resolve({applyOutcomePersistence:p},{filePath});
    assert.equal(r.eligible,false);
    assert.match(r.reasons.join(","),/RECORD_NOT_FOUND/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test("full receipt preserves execution fact and closed evidence-only authorities",()=>{
  const {dir,filePath}=tmp();
  try{
    const p=persisted(filePath);
    const r=resolve({receipt:{...receipt,applyOutcomePersistence:p}},{filePath});
    assert.equal(r.eligible,true);
    assert.equal(r.durableEvidenceEligible,true);
    assert.equal(r.executionOutcomeStatus,receipt.status);
    assert.equal(r.applied,true);
    assert.equal(r.rolledBack,false);
    assert.equal(r.freshAppend,true);
    assert.equal(r.duplicateSkipped,false);
    assert.equal(r.recordId,p.recordId);
    assert.equal(r.persistenceError,null);
    assert.equal(r.storeWritePerformed,false);
    assert.equal(r.executionSideEffects,"NONE");
    assert.equal(r.gitEffects,"NONE");
    assert.equal(r.persistenceAllowed,false);
    assert.equal(r.promotionAllowed,false);
    assert.equal(r.promotionExecutionAllowed,false);
    assert.equal(r.rollbackExecutionAllowed,false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("successful local apply with persistence failure preserves raw execution fact but is not durable evidence",()=>{
  const p={attempted:true,persisted:false,appended:false,duplicateSkipped:false,recordId:null,status:"APPLY_OUTCOME_PERSIST_FAILED",error:"ledger unavailable"};
  const r=resolve({receipt:{...receipt,applyOutcomePersistence:p}});
  assert.equal(r.eligible,false);
  assert.equal(r.durable,false);
  assert.equal(r.durableEvidenceEligible,false);
  assert.equal(r.executionOutcomeStatus,receipt.status);
  assert.equal(r.applied,true);
  assert.equal(r.rolledBack,false);
  assert.equal(r.persistenceError,"ledger unavailable");
  assert.equal(r.applyOutcomeRecord,null);
});

test("durable row drift fails closed and correctly persisted rollback remains valid durable evidence",()=>{
  const {dir,filePath}=tmp();
  try{
    const p=persisted(filePath);
    for(const drift of [
      {...receipt,status:"ATOMIC_APPLY_FAILED_BEFORE_RENAME"},
      {...receipt,applied:false},
      {...receipt,rolledBack:true},
      {...receipt,candidatePath:"src/scanner/ai_logic_candidates/drift.mjs"},
    ]){
      const r=resolve({receipt:{...drift,applyOutcomePersistence:p}},{filePath});
      assert.equal(r.durableEvidenceEligible,false);
      assert.equal(r.applyOutcomeRecord,null);
    }
    const rollbackReceipt={...receipt,applied:false,rolledBack:true,status:"ATOMIC_APPLY_FAILED_ROLLED_BACK"};
    const rollbackPath=path.join(dir,"rollback.jsonl");
    const out=appendAiLogicApplyOutcomeRecord({
      receipt:rollbackReceipt,
      operatorApproval:approval,
      operationId:"operation-rollback-12345678",
      expectedPreimageHash:"e".repeat(64),
    },{filePath:rollbackPath,now:"2026-09-09T23:10:00Z"});
    const rp={attempted:true,persisted:true,appended:out.appended,duplicateSkipped:out.duplicateSkipped,recordId:out.record.recordId,status:"APPLY_OUTCOME_PERSISTED",error:null};
    const rr=resolve({receipt:{...rollbackReceipt,applyOutcomePersistence:rp}},{filePath:rollbackPath});
    assert.equal(rr.eligible,true);
    assert.equal(rr.durable,true);
    assert.equal(rr.durableEvidenceEligible,true);
    assert.equal(rr.executionOutcomeStatus,"ATOMIC_APPLY_FAILED_ROLLED_BACK");
    assert.equal(rr.applied,false);
    assert.equal(rr.rolledBack,true);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
