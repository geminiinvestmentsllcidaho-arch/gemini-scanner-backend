import test from"node:test";import assert from"node:assert/strict";import fs from"node:fs";import os from"node:os";import path from"node:path";
import{buildAiLogicPromotionDecisionEvidenceRecord as b,appendAiLogicPromotionDecisionEvidenceRecord as a,listAiLogicPromotionDecisionEvidenceRecords as l}from"../src/scanner/ai_logic_promotion_decision_evidence_store.mjs";
const locks={productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false};
const d=()=>({version:"ai_logic_promotion_decision_evidence_gate_v1",eligible:true,status:"AI_LOGIC_PROMOTION_DECISION_EVIDENCE_READY",disposition:"PROMOTION_DECISION_EVIDENCE_ONLY",immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",binding:{acceptanceRecordId:"a",candidateId:"c",knownGoodRecordId:"k",replayId:"r",sourceCommitBefore:"b",sourceCommitAfter:"n",candidateSourceHash:"c".repeat(64),candidatePath:"src/scanner/ai_logic_candidates/c.mjs",candidateTopic:"classification_coverage"},...locks});
test("builds locked local evidence",()=>{const r=b(d(),{now:new Date("2026-09-02T20:00:00Z")});assert.equal(r.localJsonlOnly,true);assert.equal(r.promotionAllowed,false);assert.equal(r.recordedAt,"2026-09-02T20:00:00.000Z")});
test("appends once lists and keeps 0600",()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),"a54-"));const p=path.join(dir,"x.jsonl");assert.equal(a(d(),{ledgerPath:p}).appended,true);assert.equal(a(d(),{ledgerPath:p}).appended,false);assert.equal(l({ledgerPath:p}).length,1);assert.equal(fs.statSync(p).mode&0o777,0o600)});
test("fails closed on open lock or malformed ledger",()=>{assert.throws(()=>b({...d(),promotionAllowed:true}));const dir=fs.mkdtempSync(path.join(os.tmpdir(),"a54-"));const p=path.join(dir,"x.jsonl");fs.writeFileSync(p,"bad\n");assert.throws(()=>l({ledgerPath:p}),/MALFORMED/)});

test("fails closed when candidate source hash binding is missing",()=>{
  const x=d(); delete x.binding.candidateSourceHash;
  assert.throws(()=>b(x),/PROMOTION_DECISION_EVIDENCE_NOT_PERSISTABLE/);
});

test("persists exact candidate source hash binding",()=>{
  const r=b(d());
  assert.equal(r.candidateSourceHash,"c".repeat(64));
});

test("fails closed when candidate path or topic binding is missing",()=>{
  const a=d(); delete a.binding.candidatePath;
  assert.throws(()=>b(a),/PROMOTION_DECISION_EVIDENCE_NOT_PERSISTABLE/);
  const c=d(); delete c.binding.candidateTopic;
  assert.throws(()=>b(c),/PROMOTION_DECISION_EVIDENCE_NOT_PERSISTABLE/);
});

test("persists exact candidate path and topic binding and identity changes on drift",()=>{
  const x=b(d());
  assert.equal(x.candidatePath,"src/scanner/ai_logic_candidates/c.mjs");
  assert.equal(x.candidateTopic,"classification_coverage");
  const y=d(); y.binding={...y.binding,candidatePath:"src/scanner/ai_logic_candidates/other.mjs"};
  assert.notEqual(b(y).recordId,x.recordId);
  const z=d(); z.binding={...z.binding,candidateTopic:"evidence_interpretation"};
  assert.notEqual(b(z).recordId,x.recordId);
});
