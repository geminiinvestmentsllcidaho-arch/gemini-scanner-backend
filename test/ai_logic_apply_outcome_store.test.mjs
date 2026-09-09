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
