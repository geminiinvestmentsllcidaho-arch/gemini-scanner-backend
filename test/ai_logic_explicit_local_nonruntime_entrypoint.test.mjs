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
      approvalRecordId:operatorApproval.recordId,
      candidatePath:"src/scanner/ai_logic_candidates/x.mjs",candidateTopic:"evidence_interpretation",
      expectedPreimageHash:"e".repeat(64),operationId:"op-ready-001",repositoryRoot:"/repo",
      knownGoodStorePath:"/kg",consumptionPath:"/cons",now:"2029-01-01T00:00:00.000Z",
      currentHeadProvider:()=> "before",
      verifyImmutableManifestAfter:()=>({ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"}),
      validators:{syntax:()=>true,focusedTests:()=>true,fullRegression:()=>true},
    },
    deps:{
      verifyImmutablePolicyManifest:()=>({ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"}),
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
