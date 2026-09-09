import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildAiLogicOperatorApprovalRecord as build, appendAiLogicOperatorApprovalRecord as append } from "../src/scanner/ai_logic_operator_approval_record.mjs";
const base=(action="PROMOTION")=>({action,decisionRecordId:"d1",acceptanceRecordId:action==="PROMOTION"?"a1":null,candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",candidateSourceHash:"c".repeat(64),candidatePath:"src/scanner/ai_logic_candidates/c1.mjs",candidateTopic:"classification_coverage",nonce:"n1",explicitlyApproved:true,oneShot:true,issuedAt:"2026-09-02T23:00:00Z",expiresAt:"2026-09-03T00:00:00Z",paperOnly:true,noLiveTradingAcknowledged:true,noImmutablePolicyMutationAcknowledged:true});
test("builds deterministic promotion and rollback approvals with all authority locked",()=>{for(const a of ["PROMOTION","ROLLBACK"]){const r=build(base(a));assert.equal(r.valid,true);assert.equal(r.gitMutationAllowed,false);assert.equal(r.promotionExecutionAllowed,false);assert.equal(r.rollbackExecutionAllowed,false)}});
test("fails closed on missing approval nonce expiry or identity",()=>{for(const patch of [{explicitlyApproved:false},{nonce:""},{expiresAt:"2026-09-02T22:00:00Z"},{candidateId:""},{candidateSourceHash:""}]) assert.equal(build({...base(),...patch}).valid,false)});
test("persists private local jsonl once and deduplicates",()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),"a54r9-"));const f=path.join(d,"x","a.jsonl");const r=build(base());assert.equal(append(r,f).appended,true);assert.equal(append(r,f).appended,false);assert.equal(fs.statSync(f).mode&0o777,0o600);assert.equal(fs.statSync(path.dirname(f)).mode&0o777,0o700)});

test("candidate path and topic provenance is required preserved and identity-bound",()=>{
  for(const patch of [{candidatePath:""},{candidateTopic:""}]) assert.equal(build({...base(),...patch}).valid,false);
  const x=build(base());
  assert.equal(x.candidatePath,"src/scanner/ai_logic_candidates/c1.mjs");
  assert.equal(x.candidateTopic,"classification_coverage");
  assert.notEqual(build({...base(),candidatePath:"src/scanner/ai_logic_candidates/other.mjs"}).recordId,x.recordId);
  assert.notEqual(build({...base(),candidateTopic:"evidence_interpretation"}).recordId,x.recordId);
});

test("persists and identity-binds required safety acknowledgements",()=>{
  const r=build(base());
  assert.equal(r.noLiveTradingAcknowledged,true);
  assert.equal(r.noImmutablePolicyMutationAcknowledged,true);
  assert.equal(build({...base(),noLiveTradingAcknowledged:false}).valid,false);
  assert.equal(build({...base(),noImmutablePolicyMutationAcknowledged:false}).valid,false);
});
