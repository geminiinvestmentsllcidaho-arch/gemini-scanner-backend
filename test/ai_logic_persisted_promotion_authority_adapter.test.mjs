import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildAiLogicOperatorApprovalRecord } from "../src/scanner/ai_logic_operator_approval_record.mjs";
import { buildAiLogicPersistedPromotionAuthorityAdapter as build, VERSION } from "../src/scanner/ai_logic_persisted_promotion_authority_adapter.mjs";
const h=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0,32);
const locks={productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false};
function fx(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aipaa-")),approvalPath=path.join(dir,"approvals.jsonl"),promotionPath=path.join(dir,"promotion.jsonl"),knownGoodPath=path.join(dir,"kg.jsonl");
 const id={acceptanceRecordId:"ac1",candidateId:"c1",knownGoodRecordId:"kg1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",candidateSourceHash:"c".repeat(64),candidatePath:"src/scanner/ai_logic_candidates/c1.mjs",candidateTopic:"classification_coverage"};
 const decision={version:"ai_logic_promotion_decision_evidence_store_v1",recordId:h(id),...id,immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",localJsonlOnly:true,...locks};
 const approval=buildAiLogicOperatorApprovalRecord({action:"PROMOTION",decisionRecordId:decision.recordId,...id,nonce:"n1",explicitlyApproved:true,oneShot:true,paperOnly:true,noLiveTradingAcknowledged:true,noImmutablePolicyMutationAcknowledged:true,issuedAt:"2026-09-09T06:00:00Z",expiresAt:"2026-09-09T07:00:00Z"});
 const kg={version:"ai_logic_known_good_record_v1",valid:true,status:"KNOWN_GOOD_RECORD_VALID",recordId:"kg1",versionId:"v1",sourceCommit:"before",recordedAt:"2026-09-09T05:00:00Z",logicScope:"classification_coverage",rollbackTargetIdentified:true,immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",persistenceAllowed:false,productionRuntimeWiringAllowed:false,strategySwitchingAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,rollbackExecutable:false,promotionEligible:false};
 fs.writeFileSync(approvalPath,JSON.stringify(approval)+"\n",{mode:0o600});fs.writeFileSync(promotionPath,JSON.stringify(decision)+"\n",{mode:0o600});fs.writeFileSync(knownGoodPath,JSON.stringify(kg)+"\n",{mode:0o600});
 return {dir,approvalPath,promotionPath,knownGoodPath,approval,decision};
}
test("exports version",()=>assert.equal(VERSION,"ai_logic_persisted_promotion_authority_adapter_v1"));
test("resolves canonical persisted promotion evidence into authority review without consuming approval",()=>{const f=fx();const r=build({explicitOperatorInvocation:true,approvalRecordId:f.approval.recordId,currentSourceCommit:"before"},f);assert.equal(r.eligible,true);assert.equal(r.status,"AI_LOGIC_PERSISTED_PROMOTION_AUTHORITY_ADAPTER_READY");assert.equal(r.promotionDecisionRecordId,f.decision.recordId);assert.equal(r.authorityReview.eligible,true);assert.equal(r.authorityReview.promotionExecutionAllowed,false);assert.equal(r.approvalConsumptionAllowed,false);assert.equal(r.gitMutationAllowed,false)});
test("requires explicit invocation and exact current source commit",()=>{const f=fx();assert.equal(build({approvalRecordId:f.approval.recordId,currentSourceCommit:"before"},f).eligible,false);assert.equal(build({explicitOperatorInvocation:true,approvalRecordId:f.approval.recordId,currentSourceCommit:"drift"},f).eligible,false)});
test("fails closed on non-promotion or persisted identity drift",()=>{const f=fx();const a={...f.approval,action:"ROLLBACK"};fs.writeFileSync(f.approvalPath,JSON.stringify(a)+"\n");assert.equal(build({explicitOperatorInvocation:true,approvalRecordId:f.approval.recordId,currentSourceCommit:"before"},f).eligible,false)});
test("never opens execution runtime broker account policy sizing allocation or git authority",()=>{const f=fx(),r=build({explicitOperatorInvocation:true,approvalRecordId:f.approval.recordId,currentSourceCommit:"before"},f);for(const k of ["productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed","approvalConsumptionAllowed"])assert.equal(r[k],false)});
