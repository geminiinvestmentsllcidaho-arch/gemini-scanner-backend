import test from "node:test";
import assert from "node:assert/strict";
import { VERSION,runAiLogicExplicitLocalNonruntimeCli } from "../src/scanner/ai_logic_explicit_local_nonruntime_cli_runner.mjs";

test("exports version",()=>assert.equal(VERSION,"ai_logic_explicit_local_nonruntime_cli_runner_v1"));

test("requires exact operator flags and approval id before entrypoint",()=>{
 let calls=0;
 const r=runAiLogicExplicitLocalNonruntimeCli({argv:["--approval-record-id=ap1","--explicit-operator-invocation"]},{runAiLogicExplicitLocalNonruntimeEntrypoint(){calls++;}});
 assert.equal(r.status,"AI_LOGIC_EXPLICIT_LOCAL_NONRUNTIME_CLI_RUNNER_BLOCKED");
 assert.equal(calls,0);
 assert.ok(r.reasons.includes("LOCAL_CANDIDATE_SOURCE_APPLY_CONFIRMATION_REQUIRED"));
});

test("delegates exactly once with caller-derived explicit invocation and persisted approval id",()=>{
 let calls=0,seen;
 const r=runAiLogicExplicitLocalNonruntimeCli({
   argv:["--approval-record-id=ap1","--explicit-operator-invocation","--confirm-local-candidate-source-apply"],
   entrypointInput:{repositoryRoot:"/repo",operationId:"op1"}
 },{runAiLogicExplicitLocalNonruntimeEntrypoint(input){calls++;seen=input;return {executed:true,consumed:true,applied:true,status:"OK"};}});
 assert.equal(calls,1);
 assert.equal(seen.approvalRecordId,"ap1");
 assert.equal(seen.explicitOperatorInvocation,true);
 assert.equal(seen.repositoryRoot,"/repo");
 assert.equal(seen.operationId,"op1");
 assert.equal(r.status,"OK");
});

test("passes apply outcome path through and preserves outcome persistence receipt",()=>{
 let calls=0,seen;
 const r=runAiLogicExplicitLocalNonruntimeCli({
   argv:["--approval-record-id=ap1","--explicit-operator-invocation","--confirm-local-candidate-source-apply"],
   entrypointInput:{repositoryRoot:"/repo",operationId:"op1",applyOutcomePath:"/outcomes"}
 },{runAiLogicExplicitLocalNonruntimeEntrypoint(input){
   calls++; seen=input;
   return {executed:true,consumed:true,applied:true,status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",applyOutcomePersistence:{attempted:true,persisted:true,appended:true,duplicateSkipped:false,recordId:"out1",status:"APPLY_OUTCOME_PERSISTED",error:null}};
 }});
 assert.equal(calls,1);
 assert.equal(seen.applyOutcomePath,"/outcomes");
 assert.equal(r.status,"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED");
 assert.equal(r.applyOutcomePersistence.persisted,true);
 assert.equal(r.applyOutcomePersistence.recordId,"out1");
 assert.equal(r.runtimeWiringAllowed,false);
 assert.equal(r.liveTradingAllowed,false);
 assert.equal(r.gitMutationAllowed,false);
});

test("preserves durable apply outcome binding exactly from entrypoint receipt",()=>{
 const binding=Object.freeze({version:"ai_logic_apply_outcome_persistence_binding_v1",eligible:true,durable:true,durableEvidenceEligible:true,status:"AI_LOGIC_APPLY_OUTCOME_DURABLE_EVIDENCE_VALID",disposition:"LOCAL_DURABLE_APPLY_OUTCOME_EVIDENCE_ONLY"});
 const r=runAiLogicExplicitLocalNonruntimeCli({
   argv:["--approval-record-id=ap1","--explicit-operator-invocation","--confirm-local-candidate-source-apply"],
  entrypointInput:{repositoryRoot:"/repo",operationId:"op1"}
 },{runAiLogicExplicitLocalNonruntimeEntrypoint(){return {executed:true,consumed:true,applied:true,status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",applyOutcomePersistence:{attempted:true,persisted:true,appended:true,duplicateSkipped:false,recordId:"out1",status:"APPLY_OUTCOME_PERSISTED",error:null},applyOutcomeBinding:binding};}});
 assert.equal(r.applyOutcomeBinding,binding);
 assert.equal(r.applyOutcomeBinding.durableEvidenceEligible,true);
 assert.equal(r.applyOutcomeBinding.status,"AI_LOGIC_APPLY_OUTCOME_DURABLE_EVIDENCE_VALID");
 assert.equal(r.runtimeWiringAllowed,false);
 assert.equal(r.liveTradingAllowed,false);
 assert.equal(r.gitMutationAllowed,false);
});



test("never opens runtime broker account policy sizing allocation or git authority",()=>{
 const r=runAiLogicExplicitLocalNonruntimeCli({argv:[]});
 for(const k of ["runtimeWiringAllowed","productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"]) assert.equal(r[k],false,k);
});
