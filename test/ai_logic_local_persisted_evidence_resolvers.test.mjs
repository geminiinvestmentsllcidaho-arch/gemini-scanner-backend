import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  VERSION,
  resolveAiLogicOperatorApprovalById,
  resolveAiLogicDecisionEvidenceById,
  resolveAiLogicPersistedApprovalAndDecision,
} from "../src/scanner/ai_logic_local_persisted_evidence_resolvers.mjs";

const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0,32);
const locks = {
  productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,
};
const dlocks = {...locks,persistenceAllowed:false,promotionAllowed:false};

function fixture(action="PROMOTION") {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-persisted-resolver-"));
  const approvalPath=path.join(dir,"approvals.jsonl");
  const promotionPath=path.join(dir,"promotion.jsonl");
  const rollbackPath=path.join(dir,"rollback.jsonl");
  const common={
    acceptanceRecordId:"ac1",candidateId:"c1",knownGoodRecordId:"kg1",replayId:"r1",
    sourceCommitBefore:"before",sourceCommitAfter:"after",candidateSourceHash:"a".repeat(64),
    candidatePath:"src/scanner/ai_logic_candidates/c1.mjs",candidateTopic:"classification_coverage",
  };
  const decisionIdentity=action==="PROMOTION"
    ? {...common}
    : {promotionDecisionRecordId:"pd1",...common};
  const decisionRecordId=hash(decisionIdentity);
  const approvalIdentity={
    action,decisionRecordId,acceptanceRecordId:"ac1",candidateId:"c1",knownGoodRecordId:"kg1",
    replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",
    candidateSourceHash:"a".repeat(64),candidatePath:"src/scanner/ai_logic_candidates/c1.mjs",
    candidateTopic:"classification_coverage",nonce:"n1",
    noLiveTradingAcknowledged:true,noImmutablePolicyMutationAcknowledged:true,
  };
  const operatorApproval={
    version:"ai_logic_operator_approval_record_v1",valid:true,status:"AI_LOGIC_OPERATOR_APPROVAL_RECORDED",
    reasons:[],recordId:hash(approvalIdentity),...approvalIdentity,explicitlyApproved:true,oneShot:true,
    noLiveTradingAcknowledged:true,noImmutablePolicyMutationAcknowledged:true,
    issuedAt:"2026-01-01T00:00:00.000Z",expiresAt:"2030-01-01T00:00:00.000Z",
    paperOnly:true,localJsonlOnly:true,...locks,
  };
  const decision={
    version:action==="PROMOTION"?"ai_logic_promotion_decision_evidence_store_v1":"ai_logic_rollback_decision_evidence_store_v1",
    recordId:decisionRecordId,recordedAt:"2026-01-01T00:00:00.000Z",...decisionIdentity,
    immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",localJsonlOnly:true,...dlocks,
    ...(action==="ROLLBACK"?{rollbackTargetIdentified:true,rollbackDecisionEvidenceOnly:true}:{}),
  };
  fs.writeFileSync(approvalPath,JSON.stringify(operatorApproval)+"\n",{mode:0o600});
  fs.writeFileSync(action==="PROMOTION"?promotionPath:rollbackPath,JSON.stringify(decision)+"\n",{mode:0o600});
  return {dir,approvalPath,promotionPath,rollbackPath,operatorApproval,decision};
}

test("exports version",()=>assert.equal(VERSION,"ai_logic_local_persisted_evidence_resolvers_v1"));

test("resolves exact canonical persisted promotion approval and decision",()=>{
  const f=fixture("PROMOTION");
  const r=resolveAiLogicPersistedApprovalAndDecision({approvalRecordId:f.operatorApproval.recordId},f);
  assert.equal(r.eligible,true);
  assert.equal(r.operatorApproval.recordId,f.operatorApproval.recordId);
  assert.equal(r.decisionEvidence.recordId,f.decision.recordId);
  assert.equal(r.runtimeWiringAllowed,false);
  assert.equal(r.brokerContactAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});

test("resolves exact canonical persisted rollback approval and decision",()=>{
  const f=fixture("ROLLBACK");
  const r=resolveAiLogicPersistedApprovalAndDecision({approvalRecordId:f.operatorApproval.recordId},f);
  assert.equal(r.eligible,true);
  assert.equal(r.decisionEvidence.version,"ai_logic_rollback_decision_evidence_store_v1");
  assert.equal(r.liveTradingAllowed,false);
});

test("missing malformed duplicate and approval identity drift fail closed",()=>{
  for (const mode of ["missing","malformed","duplicate","drift"]) {
    const f=fixture();
    if (mode==="malformed") fs.appendFileSync(f.approvalPath,"{\n");
    if (mode==="duplicate") fs.appendFileSync(f.approvalPath,JSON.stringify(f.operatorApproval)+"\n");
    if (mode==="drift") {
      const bad={...f.operatorApproval,candidateId:"changed"};
      fs.writeFileSync(f.approvalPath,JSON.stringify(bad)+"\n");
    }
    const id=mode==="missing"?"0".repeat(32):f.operatorApproval.recordId;
    const r=resolveAiLogicOperatorApprovalById({approvalRecordId:id},{filePath:f.approvalPath});
    assert.equal(r.eligible,false);
    assert.equal(r.record,null);
    assert.equal(r.orderPlacementAllowed,false);
  }
});

test("decision duplicate identity drift action mismatch and approval binding drift fail closed",()=>{
  for (const mode of ["duplicate","identity","action","binding"]) {
    const f=fixture();
    if (mode==="duplicate") fs.appendFileSync(f.promotionPath,JSON.stringify(f.decision)+"\n");
    if (mode==="identity") fs.writeFileSync(f.promotionPath,JSON.stringify({...f.decision,replayId:"changed"})+"\n");
    const approval=mode==="binding"?{...f.operatorApproval,candidateId:"changed"}:f.operatorApproval;
    const action=mode==="action"?"ROLLBACK":"PROMOTION";
    const r=resolveAiLogicDecisionEvidenceById({
      action,decisionRecordId:f.decision.recordId,operatorApproval:approval
    },f);
    assert.equal(r.eligible,false);
    assert.equal(r.record,null);
    assert.equal(r.immutablePolicyMutationAllowed,false);
  }
});

test("candidate path or topic identity drift fails closed",()=>{
  {
    const f=fixture();
    const bad={...f.operatorApproval,candidatePath:"src/scanner/ai_logic_candidates/other.mjs"};
    fs.writeFileSync(f.approvalPath,JSON.stringify(bad)+"\n");
    assert.equal(resolveAiLogicOperatorApprovalById({approvalRecordId:f.operatorApproval.recordId},{filePath:f.approvalPath}).eligible,false);
  }
  {
    const f=fixture();
    const bad={...f.decision,candidateTopic:"evidence_interpretation"};
    fs.writeFileSync(f.promotionPath,JSON.stringify(bad)+"\n");
    assert.equal(resolveAiLogicDecisionEvidenceById({action:"PROMOTION",decisionRecordId:f.decision.recordId,operatorApproval:f.operatorApproval},f).eligible,false);
  }
  {
    const f=fixture();
    const approval={...f.operatorApproval,candidatePath:"src/scanner/ai_logic_candidates/other.mjs"};
    assert.equal(resolveAiLogicDecisionEvidenceById({action:"PROMOTION",decisionRecordId:f.decision.recordId,operatorApproval:approval},f).eligible,false);
  }
  const f=fixture();
  const r=resolveAiLogicPersistedApprovalAndDecision({approvalRecordId:f.operatorApproval.recordId},f);
  assert.equal(r.eligible,true);
  assert.equal(r.operatorApproval.candidatePath,"src/scanner/ai_logic_candidates/c1.mjs");
  assert.equal(r.operatorApproval.candidateTopic,"classification_coverage");
  assert.equal(r.decisionEvidence.candidatePath,"src/scanner/ai_logic_candidates/c1.mjs");
  assert.equal(r.decisionEvidence.candidateTopic,"classification_coverage");
});

test("persisted approval requires identity-bound safety acknowledgements",()=>{
  const f=fixture();
  for(const k of ["noLiveTradingAcknowledged","noImmutablePolicyMutationAcknowledged"]){
    const bad={...f.operatorApproval}; delete bad[k];
    fs.writeFileSync(f.approvalPath,JSON.stringify(bad)+"\n");
    assert.equal(resolveAiLogicOperatorApprovalById({approvalRecordId:f.operatorApproval.recordId},{filePath:f.approvalPath}).eligible,false);
  }
});
