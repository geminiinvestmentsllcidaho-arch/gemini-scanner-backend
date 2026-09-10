import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { runAiLogicExplicitLocalNonruntimeEntrypoint as run, VERSION } from "../src/scanner/ai_logic_explicit_local_nonruntime_entrypoint.mjs";

const h = (v) => crypto.createHash("sha256").update(v).digest("hex");
const locks = {
  productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,
};

function fx() {
  const candidateBytes = Buffer.from("candidate-v2");
  const candidateSourceHash = h(candidateBytes);
  const operatorApproval = {
    version:"ai_logic_operator_approval_record_v1",valid:true,recordId:"ap1",nonce:"nonce1",
    action:"PROMOTION",decisionRecordId:"d1",acceptanceRecordId:"ac1",candidateId:"c1",
    knownGoodRecordId:"kg1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",
    candidatePath:"src/scanner/ai_logic_candidates/x.mjs",candidateTopic:"evidence_interpretation",
    candidateSourceHash,explicitlyApproved:true,oneShot:true,paperOnly:true,
    expiresAt:"2030-01-01T00:00:00.000Z",...locks,
  };
  const decisionEvidence = {
    version:"ai_logic_promotion_decision_evidence_store_v1",recordId:"d1",acceptanceRecordId:"ac1",
    candidateId:"c1",knownGoodRecordId:"kg1",replayId:"r1",sourceCommitBefore:"before",
    sourceCommitAfter:"after",candidatePath:"src/scanner/ai_logic_candidates/x.mjs",candidateTopic:"evidence_interpretation",
    candidateSourceHash,immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",
    localJsonlOnly:true,persistenceAllowed:false,promotionAllowed:false,...locks,
  };
  const boundaryEvidence = {
    version:"ai_logic_execution_boundary_gate_v1",eligible:true,applyEligibilityOnly:true,
    readOnly:true,evidenceOnly:true,paperOnly:true,approvalRecordId:"ap1",nonce:"nonce1",
    action:"PROMOTION",decisionRecordId:"d1",candidateSourceHash,currentSourceCommit:"before",
    targetSourceCommit:"after",...locks,
  };
  const authorityGate = {
    version:"ai_logic_execution_authority_gate_v1",eligible:true,readOnly:true,evidenceOnly:true,paperOnly:true,
    approvalRecordId:"ap1",nonce:"nonce1",action:"PROMOTION",decisionRecordId:"d1",
    candidateSourceHash,currentSourceCommit:"before",targetSourceCommit:"after",...locks,
  };
  return {
    input:{
      explicitOperatorInvocation:true,
      approvalRecordId:operatorApproval.recordId,
      candidatePath:"src/scanner/ai_logic_candidates/x.mjs",candidateTopic:"evidence_interpretation",
      expectedPreimageHash:"e".repeat(64),operationId:"op-ready-001",repositoryRoot:"/repo",
      knownGoodStorePath:"/kg",consumptionPath:"/cons",applyOutcomePath:"/outcomes",now:"2029-01-01T00:00:00.000Z",
      currentHeadProvider:()=> "before",
      verifyImmutableManifestAfter:()=>({ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"}),
      validators:{syntax:()=>true,focusedTests:()=>true,fullRegression:()=>true},
    },
    deps:{
      verifyImmutablePolicyManifest:()=>({ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"}),
      buildAiLogicPersistedPromotionAuthorityAdapter:()=>({
        version:"ai_logic_persisted_promotion_authority_adapter_v1",
        eligible:true,
        status:"AI_LOGIC_PERSISTED_PROMOTION_AUTHORITY_ADAPTER_READY",
        approvalRecordId:operatorApproval.recordId,
        promotionDecisionRecordId:decisionEvidence.recordId,
        candidateSourceHash,
        candidatePath:operatorApproval.candidatePath,
        candidateTopic:operatorApproval.candidateTopic,
        authorityReview:{eligible:true},
        approvalConsumptionAllowed:false,
        promotionExecutionAllowed:false,
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
      }),
      buildAiLogicPersistedRollbackAuthorityAdapter:()=>({
        version:"ai_logic_persisted_rollback_authority_adapter_v1",eligible:true,status:"AI_LOGIC_PERSISTED_ROLLBACK_AUTHORITY_ADAPTER_READY",
        approvalRecordId:operatorApproval.recordId,rollbackDecisionRecordId:decisionEvidence.recordId,candidateSourceHash,
        candidatePath:operatorApproval.candidatePath,candidateTopic:operatorApproval.candidateTopic,authorityReview:{eligible:true},
        approvalConsumptionAllowed:false,rollbackExecutionAllowed:false,productionRuntimeWiringAllowed:false,brokerContactAllowed:false,
        orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,
        thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false,
      }),
      resolveAiLogicCandidateArtifact:({candidatePath,expectedSourceHash},{rootDir,manifestResult})=>({
        eligible:candidatePath==="src/scanner/ai_logic_candidates/x.mjs" && expectedSourceHash===candidateSourceHash && rootDir==="/repo" && manifestResult?.ok===true,
        status:"AI_LOGIC_CANDIDATE_ARTIFACT_RESOLVED",readOnly:true,evidenceOnly:true,
        sourceExecutionAllowed:false,dynamicImportAllowed:false,
        localSandboxMutationAllowed:false,filesystemMutationAllowed:false,runtimeActivationAllowed:false,
        candidatePath,candidateBytes:Buffer.from(candidateBytes),sourceText:candidateBytes.toString("utf8"),sourceHash:candidateSourceHash,reasons:[],
      }),
      resolveAiLogicPersistedApprovalAndDecision:({approvalRecordId})=>({
        eligible:approvalRecordId===operatorApproval.recordId,
        status:approvalRecordId===operatorApproval.recordId?"AI_LOGIC_PERSISTED_EVIDENCE_READY":"AI_LOGIC_PERSISTED_APPROVAL_HOLD",
        reasons:[],
        operatorApproval:approvalRecordId===operatorApproval.recordId?operatorApproval:null,
        decisionEvidence:approvalRecordId===operatorApproval.recordId?decisionEvidence:null,
      }),
      isAiLogicOperatorApprovalConsumed:()=>false,
      buildAiLogicOperatorApprovalConsumptionRecord:()=>({
        version:"ai_logic_operator_approval_consumption_record_v1",eligible:true,
        status:"AI_LOGIC_OPERATOR_APPROVAL_CONSUMPTION_READY",disposition:"ONE_SHOT_CONSUMPTION_EVIDENCE_ONLY",
        approvalRecordId:"ap1",nonce:"nonce1",action:"PROMOTION",decisionRecordId:"d1",
        candidateSourceHash,candidatePath:"src/scanner/ai_logic_candidates/x.mjs",candidateTopic:"evidence_interpretation",
        currentSourceCommit:"before",targetSourceCommit:"after",
        oneShot:true,atomicConsumptionRequired:true,exactlyOnceRequired:true,auditEvidenceRequired:true,paperOnly:true,...locks,
      }),
      resolveAndBindAiLogicKnownGoodFromStore:()=>({
        version:"ai_logic_known_good_store_integration_v1",eligible:true,status:"AI_LOGIC_KNOWN_GOOD_STORE_BINDING_VALID",
        knownGood:{valid:true,status:"KNOWN_GOOD_RECORD_VALID",recordId:"kg1",sourceCommit:"before"},
      }),
      buildAiLogicExecutionPreviewContract:()=>({version:"ai_logic_execution_preview_contract_v1",eligible:true,previewOnly:true}),
      buildAiLogicExecutionAuthorityGate:()=>authorityGate,
      buildAiLogicExecutionPlan:()=>({version:"ai_logic_execution_plan_v1",eligible:true,planOnly:true,readOnly:true}),
      buildAiLogicExecutionIntentEvidence:()=>({version:"ai_logic_execution_intent_evidence_contract_v1",eligible:true,readOnly:true,evidenceOnly:true,paperOnly:true,executionIntentOnly:true}),
      buildAiLogicExecutionIntentAcknowledgement:()=>({version:"ai_logic_execution_intent_acknowledgement_contract_v1",eligible:true,readOnly:true,evidenceOnly:true,acknowledgementOnly:true,paperOnly:true}),
      buildAiLogicExecutionBoundaryGate:()=>boundaryEvidence,
      appendAiLogicApplyOutcomeRecord:()=>({appended:true,duplicateSkipped:false,record:{recordId:"out1"}}),
      buildAiLogicOneShotNonruntimeAssembly:()=>({
        eligible:true,
        orchestratorContract:{
          version:"ai_logic_local_integration_orchestrator_contract_v1",eligible:true,
          localCandidateSourceApplySeamReady:true,status:"AI_LOGIC_LOCAL_INTEGRATION_ORCHESTRATOR_READY",
          disposition:"EXPLICIT_LOCAL_CANDIDATE_SOURCE_APPLY_SEAM_ONLY",
          localCandidateFilesystemMutationScope:"ALLOWLISTED_AI_LOGIC_CANDIDATE_SOURCE_ONLY",
          knownGoodRecordId:"kg1",knownGoodSourceCommit:"before",
          approvalRecordId:"ap1",nonce:"nonce1",action:"PROMOTION",decisionRecordId:"d1",
          candidateSourceHash,currentSourceCommit:"before",targetSourceCommit:"after",
          runtimeActivationAllowed:false,pm2RestartAllowed:false,gitCheckoutAllowed:false,gitResetAllowed:false,
          gitRevertAllowed:false,gitMergeAllowed:false,gitCherryPickAllowed:false,...locks,
        },
        invocationContract:{
          version:"ai_logic_one_shot_nonruntime_invocation_contract_v1",eligible:true,
          operatorInvokedLocalOnly:true,runtimeWiringAllowed:false,knownGoodRecordId:"kg1",
          knownGoodSourceCommit:"before",targetPath:"src/scanner/ai_logic_candidates/x.mjs",
          expectedPreimageHash:"e".repeat(64),operationId:"op-ready-001",
          approvalRecordId:"ap1",nonce:"nonce1",action:"PROMOTION",decisionRecordId:"d1",
          candidateSourceHash,currentSourceCommit:"before",targetSourceCommit:"after",
        },
      }),
    },
  };
}

test("exports version",()=>assert.equal(VERSION,"ai_logic_explicit_local_nonruntime_entrypoint_v1"));

test("explicit invocation builds then delegates exactly once",()=>{
  const f=fx();
  let calls=0;
  f.input.targetPath="src/server.js";
  f.deps.runAiLogicOneShotNonruntimeInvocation=(x)=>{
    calls++;
    assert.equal(x.consumptionRecord.eligible,true);
    assert.deepEqual(x.executionInput.atomicExecutorInput.candidateBytes,Buffer.from("candidate-v2"));
    assert.equal(x.executionInput.atomicExecutorInput.targetPath,"src/scanner/ai_logic_candidates/x.mjs");
    return {executed:true,consumed:true,applied:true,status:"OK"};
  };
  const r=run(f.input,f.deps);
  assert.equal(calls,1);
  assert.equal(r.executed,true);
  assert.equal(r.applied,true);
  assert.equal(r.runtimeActivationAllowed,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});

test("entrypoint successful receipt canonicalizes candidate provenance from persisted evidence",()=>{for(const invocationResult of [{executed:true,consumed:true,applied:true,status:"OK"},{executed:true,consumed:true,applied:true,status:"OK",candidateSourceHash:"d".repeat(64),candidatePath:"src/scanner/ai_logic_candidates/other.mjs",candidateTopic:"other"}]){const f=fx();f.input.targetPath="src/server.js";f.deps.runAiLogicOneShotNonruntimeInvocation=()=>invocationResult;const r=run(f.input,f.deps);assert.equal(r.candidateSourceHash,h(Buffer.from("candidate-v2")));assert.equal(r.candidatePath,"src/scanner/ai_logic_candidates/x.mjs");assert.equal(r.candidateTopic,"evidence_interpretation");assert.equal(r.runtimeActivationAllowed,false);assert.equal(r.liveTradingAllowed,false);assert.equal(r.gitMutationAllowed,false)}});

test("already consumed blocks before assembly or invocation",()=>{
  const f=fx();
  let n=0;
  f.deps.isAiLogicOperatorApprovalConsumed=()=>true;
  f.deps.buildAiLogicOneShotNonruntimeAssembly=()=>{n++;};
  f.deps.runAiLogicOneShotNonruntimeInvocation=()=>{n++;};
  const r=run(f.input,f.deps);
  assert.equal(n,0);
  assert.equal(r.consumed,true);
  assert.equal(r.executed,false);
  assert.equal(r.status,"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_ALREADY_CONSUMED");
});

test("candidate artifact resolution fails closed on injected byte or text trust drift",()=>{
  for (const mutate of [
    f=>{
      const good=f.deps.resolveAiLogicCandidateArtifact;
      f.deps.resolveAiLogicCandidateArtifact=(i,o)=>({...good(i,o),candidateBytes:Buffer.from("tampered")});
    },
    f=>{
      const good=f.deps.resolveAiLogicCandidateArtifact;
      f.deps.resolveAiLogicCandidateArtifact=(i,o)=>({...good(i,o),sourceText:"different"});
    },
    f=>{
      const good=f.deps.resolveAiLogicCandidateArtifact;
      f.deps.resolveAiLogicCandidateArtifact=(i,o)=>({...good(i,o),sourceExecutionAllowed:true});
    },
  ]) {
    const f=fx();
    let n=0;
    mutate(f);
    f.deps.runAiLogicOneShotNonruntimeInvocation=()=>{n++;};
    const r=run(f.input,f.deps);
    assert.equal(n,0);
    assert.equal(r.executed,false);
    assert.equal(r.consumed,false);
    assert.equal(r.status,"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED");
  }
});


test("entrypoint blocked receipts preserve canonical candidate provenance after persisted evidence resolution",()=>{
  const cases=[
    f=>{f.deps.verifyImmutablePolicyManifest=()=>({ok:false,status:"BAD"});},
    f=>{f.deps.isAiLogicOperatorApprovalConsumed=()=>true;},
    f=>{f.input.repositoryRoot="";},
    f=>{f.deps.resolveAndBindAiLogicKnownGoodFromStore=()=>({eligible:false});},
    f=>{f.deps.buildAiLogicOneShotNonruntimeAssembly=()=>({eligible:false});},
    f=>{f.input.currentHeadProvider=null;},
    f=>{delete f.input.validators.syntax;},
  ];
  for(const mutate of cases){
    const f=fx();
    const persisted=f.deps.resolveAiLogicPersistedApprovalAndDecision({approvalRecordId:"ap1"});
    const a=persisted.operatorApproval;
    mutate(f);
    const r=run(f.input,f.deps);
    assert.equal(r.candidateSourceHash,a.candidateSourceHash);
    assert.equal(r.candidatePath,a.candidatePath);
    assert.equal(r.candidateTopic,a.candidateTopic);
    assert.equal(r.executed,false);
    assert.equal(r.applied,false);
  }
});

test("candidate artifact resolution and required validators fail closed before invocation",()=>{
  for (const mutate of [
    f=>{f.deps.resolveAiLogicCandidateArtifact=()=>({eligible:false,reasons:["SOURCE_HASH_MISMATCH"]});},
    f=>{delete f.input.validators.fullRegression;},
  ]) {
    const f=fx();
    let n=0;
    mutate(f);
    f.deps.runAiLogicOneShotNonruntimeInvocation=()=>{n++;};
    const r=run(f.input,f.deps);
    assert.equal(n,0);
    assert.equal(r.executed,false);
    assert.equal(r.consumed,false);
    assert.equal(r.liveTradingAllowed,false);
  }
});


test("promotion authority requires caller explicit invocation and fresh observed HEAD before review",()=>{
  for (const mutate of [
    f=>{delete f.input.explicitOperatorInvocation;},
    f=>{f.input.explicitOperatorInvocation=false;},
    f=>{f.input.currentHeadProvider=()=> "drift";},
    f=>{f.input.currentHeadProvider=null;},
  ]) {
    const f=fx();
    let authorityCalls=0, invocationCalls=0;
    mutate(f);
    f.deps.buildAiLogicPersistedPromotionAuthorityAdapter=()=>{authorityCalls++; return {eligible:true};};
    f.deps.runAiLogicOneShotNonruntimeInvocation=()=>{invocationCalls++; return {executed:true,consumed:true,applied:true,status:"OK"};};
    const r=run(f.input,f.deps);
    assert.equal(authorityCalls,0);
    assert.equal(invocationCalls,0);
    assert.equal(r.executed,false);
    assert.equal(r.consumed,false);
    assert.equal(r.applied,false);
    assert.equal(r.status,"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_BLOCKED");
  }
});

test("promotion authority receives exact caller explicit flag and observed current HEAD",()=>{
  const f=fx();
  let seen=null;
  const good=f.deps.buildAiLogicPersistedPromotionAuthorityAdapter;
  f.deps.buildAiLogicPersistedPromotionAuthorityAdapter=(input,options)=>{
    seen={input,options};
    return good(input,options);
  };
  f.deps.runAiLogicOneShotNonruntimeInvocation=()=>({executed:true,consumed:true,applied:true,status:"OK"});
  const r=run(f.input,f.deps);
  assert.equal(r.executed,true);
  assert.equal(seen.input.explicitOperatorInvocation,true);
  assert.equal(seen.input.approvalRecordId,"ap1");
  assert.equal(seen.input.currentSourceCommit,"before");
});


test("rollback authority requires caller explicit invocation and fresh observed HEAD before review",()=>{
  for (const mutate of [f=>{f.input.explicitOperatorInvocation=false;},f=>{f.input.currentHeadProvider=()=>"drift";},f=>{f.input.currentHeadProvider=null;}]) {
    const f=fx(), base=f.deps.resolveAiLogicPersistedApprovalAndDecision;
    f.deps.resolveAiLogicPersistedApprovalAndDecision=(i)=>{const r=base(i);return {...r,operatorApproval:{...r.operatorApproval,action:"ROLLBACK",sourceCommitBefore:"before",sourceCommitAfter:"after"},decisionEvidence:{...r.decisionEvidence,version:"ai_logic_rollback_decision_evidence_store_v1"}}};
    f.input.currentHeadProvider=()=>"after"; mutate(f);
    let calls=0; f.deps.buildAiLogicPersistedRollbackAuthorityAdapter=()=>{calls++;return {eligible:true};};
    const r=run(f.input,f.deps);
    assert.equal(calls,0); assert.equal(r.executed,false); assert.equal(r.consumed,false);
  }
});

test("rollback authority receives exact caller explicit flag and observed current HEAD",()=>{
  const f=fx(), base=f.deps.resolveAiLogicPersistedApprovalAndDecision;
  f.deps.resolveAiLogicPersistedApprovalAndDecision=(i)=>{const r=base(i);return {...r,operatorApproval:{...r.operatorApproval,action:"ROLLBACK",sourceCommitBefore:"before",sourceCommitAfter:"after"},decisionEvidence:{...r.decisionEvidence,version:"ai_logic_rollback_decision_evidence_store_v1"}}};
  f.input.currentHeadProvider=()=>"after";
  let seen=null;
  f.deps.buildAiLogicPersistedRollbackAuthorityAdapter=(input,options)=>{seen={input,options};return {version:"ai_logic_persisted_rollback_authority_adapter_v1",eligible:false,status:"AI_LOGIC_PERSISTED_ROLLBACK_AUTHORITY_ADAPTER_HOLD",reasons:["TEST_HOLD"]};};
  const r=run(f.input,f.deps);
  assert.deepEqual(seen.input,{explicitOperatorInvocation:true,approvalRecordId:"ap1",currentSourceCommit:"after"});
  assert.equal(seen.options.knownGoodPath,"/kg"); assert.equal(seen.options.rootDir,"/repo");
  assert.equal(r.executed,false); assert.equal(r.consumed,false); assert.equal(r.reasons[0],"PERSISTED_ROLLBACK_AUTHORITY_REVIEW_NOT_READY");
});


test("successful invocation persists canonical apply outcome once after invocation",()=>{
  const f=fx();
  let invocationCalls=0, outcomeCalls=0, seen=null;
  f.deps.runAiLogicOneShotNonruntimeInvocation=()=>{
    invocationCalls++;
    return {executed:true,consumed:true,applied:true,rolledBack:false,status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED"};
  };
  f.deps.appendAiLogicApplyOutcomeRecord=(input,options)=>{
    outcomeCalls++;
    seen={input,options};
    return {appended:true,duplicateSkipped:false,record:{recordId:"outcome-1"}};
  };
  const r=run(f.input,f.deps);
  assert.equal(invocationCalls,1);
  assert.equal(outcomeCalls,1);
  assert.equal(seen.input.operatorApproval.recordId,"ap1");
  assert.equal(seen.input.operationId,"op-ready-001");
  assert.equal(seen.input.expectedPreimageHash,"e".repeat(64));
  assert.equal(seen.input.receipt.status,"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED");
  assert.equal(seen.input.receipt.candidateSourceHash,h(Buffer.from("candidate-v2")));
  assert.equal(seen.options.filePath,"/outcomes");
  assert.equal(seen.options.now,"2029-01-01T00:00:00.000Z");
  assert.equal(r.status,"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED");
  assert.equal(r.applyOutcomePersistence.persisted,true);
  assert.equal(r.applyOutcomePersistence.recordId,"outcome-1");
  assert.equal(r.runtimeActivationAllowed,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});

test("apply outcome persistence failure preserves authoritative invocation receipt and never reruns execution",()=>{
  const f=fx();
  let invocationCalls=0, outcomeCalls=0;
  f.deps.runAiLogicOneShotNonruntimeInvocation=()=>{
    invocationCalls++;
    return {executed:true,consumed:true,applied:false,rolledBack:true,status:"ATOMIC_APPLY_FAILED_ROLLED_BACK",errorCode:"VALIDATION_FAILED"};
  };
  f.deps.appendAiLogicApplyOutcomeRecord=()=>{
    outcomeCalls++;
    throw new Error("ledger unavailable");
  };
  const r=run(f.input,f.deps);
  assert.equal(invocationCalls,1);
  assert.equal(outcomeCalls,1);
  assert.equal(r.executed,true);
  assert.equal(r.consumed,true);
  assert.equal(r.applied,false);
  assert.equal(r.rolledBack,true);
  assert.equal(r.status,"ATOMIC_APPLY_FAILED_ROLLED_BACK");
  assert.equal(r.applyOutcomePersistence.persisted,false);
  assert.equal(r.applyOutcomePersistence.status,"APPLY_OUTCOME_PERSIST_FAILED");
  assert.match(r.applyOutcomePersistence.error,/ledger unavailable/);
  assert.equal(r.runtimeActivationAllowed,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});

test("entrypoint blockers before invocation do not attempt apply outcome persistence",()=>{
  const f=fx();
  let outcomeCalls=0;
  f.deps.isAiLogicOperatorApprovalConsumed=()=>true;
  f.deps.appendAiLogicApplyOutcomeRecord=()=>{outcomeCalls++;};
  const r=run(f.input,f.deps);
  assert.equal(outcomeCalls,0);
  assert.equal(r.status,"EXPLICIT_LOCAL_NONRUNTIME_ENTRYPOINT_ALREADY_CONSUMED");
  assert.equal(r.executed,false);
});

test("entrypoint binds persisted apply outcome into durable evidence exactly once",()=>{
  const f=fx();
  let bindCalls=0, seen;
  f.deps.runAiLogicOneShotNonruntimeInvocation=()=>({executed:true,consumed:true,applied:true,rolledBack:false,status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED"});
  f.deps.appendAiLogicApplyOutcomeRecord=()=>({appended:true,duplicateSkipped:false,record:{recordId:"outcome-1"}});
  f.deps.resolveAndBindAiLogicApplyOutcomePersistence=(input,options)=>{
    bindCalls++; seen={input,options};
    return {version:"ai_logic_apply_outcome_persistence_binding_v1",eligible:true,durable:true,durableEvidenceEligible:true,status:"AI_LOGIC_APPLY_OUTCOME_DURABLE_EVIDENCE_VALID",disposition:"LOCAL_DURABLE_APPLY_OUTCOME_EVIDENCE_ONLY"};
  };
  const r=run(f.input,f.deps);
  assert.equal(bindCalls,1);
  assert.equal(seen.input.receipt.status,"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED");
  assert.equal(seen.input.applyOutcomePersistence.recordId,"outcome-1");
  assert.equal(seen.options.filePath,"/outcomes");
  assert.equal(r.applyOutcomeBinding.durableEvidenceEligible,true);
  assert.equal(r.runtimeActivationAllowed,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});

test("entrypoint preserves execution fact while exposing fail-closed durable binding on persistence failure",()=>{
  const f=fx();
  let bindCalls=0;
  f.deps.runAiLogicOneShotNonruntimeInvocation=()=>({executed:true,consumed:true,applied:false,rolledBack:true,status:"ATOMIC_APPLY_FAILED_ROLLED_BACK"});
  f.deps.appendAiLogicApplyOutcomeRecord=()=>{throw new Error("ledger unavailable")};
  f.deps.resolveAndBindAiLogicApplyOutcomePersistence=({receipt,applyOutcomePersistence})=>{
    bindCalls++;
    assert.equal(receipt.status,"ATOMIC_APPLY_FAILED_ROLLED_BACK");
    assert.equal(applyOutcomePersistence.persisted,false);
    return {version:"ai_logic_apply_outcome_persistence_binding_v1",eligible:false,durable:false,durableEvidenceEligible:false,status:"AI_LOGIC_APPLY_OUTCOME_PERSISTENCE_BINDING_HOLD",disposition:"REJECT_OR_HOLD",reasons:["APPLY_OUTCOME_PERSISTENCE_REQUIRED"]};
  };
  const r=run(f.input,f.deps);
  assert.equal(bindCalls,1);
  assert.equal(r.status,"ATOMIC_APPLY_FAILED_ROLLED_BACK");
  assert.equal(r.applied,false);
  assert.equal(r.rolledBack,true);
  assert.equal(r.applyOutcomePersistence.persisted,false);
  assert.equal(r.applyOutcomeBinding.durableEvidenceEligible,false);
  assert.equal(r.runtimeActivationAllowed,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});
