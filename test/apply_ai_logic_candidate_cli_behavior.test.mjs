import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync,execFileSync } from "node:child_process";
import { buildAiLogicKnownGoodRecord } from "../src/scanner/ai_logic_known_good_record.mjs";
import { buildAiLogicOperatorApprovalRecord } from "../src/scanner/ai_logic_operator_approval_record.mjs";

const repo=path.resolve(".");
const script=path.join(repo,"scripts","apply_ai_logic_candidate.mjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const id32=x=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0,32);
const dlocks={productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false};
const immutable=[
"src/scanner/automatic_position_sizing_policy.mjs",
"src/scanner/automatic_position_target_allocation_policy.mjs",
"src/scanner/paper_auto_execution_strategy_authorization.mjs",
"src/scanner/paper_auto_execution_same_symbol_hard_loss_cooldown.mjs",
"src/scanner/customer_portfolio_wind_down_policy.mjs",
"src/scanner/customer_owned_position_scale_in_review_policy.mjs",
"src/scanner/customer_owned_position_scale_out_review_policy.mjs",
"src/scanner/customer_owned_position_exit_review_policy.mjs",
"src/scanner/paper_auto_execution_submission_boundary.mjs",
"src/scanner/paper_auto_execution_position_mutation_lock.mjs"
];

function fx(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"ai-apply-cli-beh-"));
 for(const rel of immutable){const dst=path.join(root,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(repo,rel),dst);}
 const candidatePath="src/scanner/ai_logic_candidates/behavior.mjs",bytes=Buffer.from("export default 1;\n");
 fs.mkdirSync(path.dirname(path.join(root,candidatePath)),{recursive:true});fs.writeFileSync(path.join(root,candidatePath),bytes,{mode:0o600});
 fs.mkdirSync(path.join(root,"test"),{recursive:true});
 for(const n of ["ai_logic_candidate_safety_gate.test.mjs","ai_logic_atomic_apply_preapply_gate.test.mjs","ai_logic_atomic_apply_executor.test.mjs","ai_logic_explicit_local_nonruntime_entrypoint.test.mjs"]) fs.writeFileSync(path.join(root,"test",n),'import test from "node:test";test("fixture",()=>{});\n');
 fs.writeFileSync(path.join(root,"package.json"),JSON.stringify({type:"module",scripts:{test:"node --test"}}));
 execFileSync("git",["init","-q"],{cwd:root});execFileSync("git",["config","user.email","fixture@example.invalid"],{cwd:root});execFileSync("git",["config","user.name","Fixture"],{cwd:root});execFileSync("git",["add","."],{cwd:root});execFileSync("git",["commit","-qm","fixture"],{cwd:root});
 const before=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),after="b".repeat(40);
 const kg=buildAiLogicKnownGoodRecord({versionId:"v1",sourceCommit:before,immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",logicScope:"classification_coverage",activeForProduction:true},{now:new Date("2026-09-09T20:00:00Z")});
 const id={acceptanceRecordId:"ac1",candidateId:"c1",knownGoodRecordId:kg.recordId,replayId:"r1",sourceCommitBefore:before,sourceCommitAfter:after,candidateSourceHash:sha(bytes),candidatePath,candidateTopic:"classification_coverage"};
 const decision={version:"ai_logic_promotion_decision_evidence_store_v1",recordId:id32(id),recordedAt:"2026-09-09T20:01:00Z",...id,immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",localJsonlOnly:true,...dlocks};
 const approval=buildAiLogicOperatorApprovalRecord({action:"PROMOTION",decisionRecordId:decision.recordId,...id,nonce:"n1",explicitlyApproved:true,oneShot:true,paperOnly:true,noLiveTradingAcknowledged:true,noImmutablePolicyMutationAcknowledged:true,issuedAt:"2026-09-09T20:02:00Z",expiresAt:"2030-09-09T20:02:00Z"});
 const runs=path.join(root,"runs");fs.mkdirSync(runs,{recursive:true});
 fs.writeFileSync(path.join(runs,"ai_logic_known_good_records.jsonl"),JSON.stringify(kg)+"\n",{mode:0o600});
 fs.writeFileSync(path.join(runs,"ai_logic_promotion_decision_evidence.jsonl"),JSON.stringify(decision)+"\n",{mode:0o600});
 fs.writeFileSync(path.join(runs,"ai_logic_operator_approvals.jsonl"),JSON.stringify(approval)+"\n",{mode:0o600});
 return {root,approval,before,preimageHash:sha(bytes)};
}

test("apply executable exits success only with durable bound outcome in isolated repo",()=>{
 const f=fx();
 try{
  const r=spawnSync(process.execPath,[script,`--approval-record-id=${f.approval.recordId}`,`--expected-preimage-hash=${f.preimageHash}`,"--operation-id=behavior-001","--explicit-operator-invocation","--confirm-local-candidate-source-apply"],{cwd:f.root,encoding:"utf8",timeout:120000});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=JSON.parse(r.stdout);
  assert.equal(out.ok,true);
  assert.equal(out.receipt.applied,true);
  assert.equal(out.receipt.applyOutcomePersistence.persisted,true);
  assert.equal(out.receipt.applyOutcomeBinding.durableEvidenceEligible,true);
  assert.equal(out.receipt.applyOutcomeBinding.status,"AI_LOGIC_APPLY_OUTCOME_DURABLE_EVIDENCE_VALID");
  assert.equal(out.receipt.runtimeActivationAllowed,false);
  assert.equal(out.receipt.liveTradingAllowed,false);
  assert.equal(out.receipt.gitMutationAllowed,false);
  assert.equal(execFileSync("git",["rev-parse","HEAD"],{cwd:f.root,encoding:"utf8"}).trim(),f.before);
 } finally { fs.rmSync(f.root,{recursive:true,force:true}); }
});
