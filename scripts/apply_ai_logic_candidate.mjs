#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import process from "node:process";
import { runAiLogicExplicitLocalNonruntimeCli } from "../src/scanner/ai_logic_explicit_local_nonruntime_cli_runner.mjs";
import { resolveAiLogicOperatorApprovalById } from "../src/scanner/ai_logic_local_persisted_evidence_resolvers.mjs";
import { verifyImmutablePolicyManifest } from "../src/scanner/ai_logic_immutable_manifest.mjs";

const value=(name)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)??null;
const approvalRecordId=value("approval-record-id");
const expectedPreimageHash=value("expected-preimage-hash");
const operationId=value("operation-id");
const explicitOperatorInvocation=process.argv.includes("--explicit-operator-invocation");
const confirmLocalCandidateSourceApply=process.argv.includes("--confirm-local-candidate-source-apply");
const root=process.cwd();
const fail=(reasons)=>{console.error(JSON.stringify({ok:false,status:"AI_LOGIC_EXPLICIT_LOCAL_NONRUNTIME_EXECUTABLE_BLOCKED",reasons},null,2));process.exit(1);};
if(!approvalRecordId) fail(["APPROVAL_RECORD_ID_REQUIRED"]);
if(!/^[a-f0-9]{64}$/i.test(String(expectedPreimageHash??""))) fail(["EXPECTED_PREIMAGE_HASH_INVALID"]);
if(!/^[A-Za-z0-9._-]{8,128}$/.test(String(operationId??""))) fail(["OPERATION_ID_INVALID"]);
const approval=resolveAiLogicOperatorApprovalById({approvalRecordId});
if(approval?.eligible!==true||!approval?.record?.candidatePath) fail(["PERSISTED_APPROVAL_RESOLUTION_FAILED"]);
const candidatePath=approval.record.candidatePath;
const run=(cmd,args,options={})=>{try{execFileSync(cmd,args,{cwd:root,stdio:"ignore",...options});return true}catch{return false}};
const head=()=>execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const receipt=runAiLogicExplicitLocalNonruntimeCli({
  argv:[
    `--approval-record-id=${approvalRecordId}`,
    ...(explicitOperatorInvocation?["--explicit-operator-invocation"]:[]),
    ...(confirmLocalCandidateSourceApply?["--confirm-local-candidate-source-apply"]:[]),
  ],
  entrypointInput:{
    repositoryRoot:root,
    expectedPreimageHash,
    operationId,
    now:new Date().toISOString(),
    currentHeadProvider:head,
    verifyImmutableManifestAfter:()=>verifyImmutablePolicyManifest({rootDir:root}),
    validators:{
      syntax:()=>run(process.execPath,["--check",candidatePath]),
      focusedTests:()=>run(process.execPath,["--test","test/ai_logic_candidate_safety_gate.test.mjs","test/ai_logic_atomic_apply_preapply_gate.test.mjs","test/ai_logic_atomic_apply_executor.test.mjs","test/ai_logic_explicit_local_nonruntime_entrypoint.test.mjs"]),
      fullRegression:()=>run("npm",["test"]),
    },
  },
});
const durableApplyOutcomeValid=
  receipt?.applied===true &&
  receipt?.applyOutcomePersistence?.persisted===true &&
  receipt?.applyOutcomeBinding?.durableEvidenceEligible===true &&
  receipt?.applyOutcomeBinding?.status==="AI_LOGIC_APPLY_OUTCOME_DURABLE_EVIDENCE_VALID";
console.log(JSON.stringify({ok:durableApplyOutcomeValid,receipt},null,2));
process.exit(durableApplyOutcomeValid?0:1);
