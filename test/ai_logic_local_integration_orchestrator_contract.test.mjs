import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLogicLocalIntegrationOrchestratorContract as build } from "../src/scanner/ai_logic_local_integration_orchestrator_contract.mjs";

const locks={
 productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
 brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
 immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
 allocationMutationAllowed:false,gitMutationAllowed:false
};

function fx(action="PROMOTION"){
 const before="before",after="after";
 const currentSourceCommit=action==="PROMOTION"?before:after;
 const targetSourceCommit=action==="PROMOTION"?after:before;
 const operatorApproval={
  version:"ai_logic_operator_approval_record_v1",valid:true,recordId:"ap1",nonce:"n1",action,
  decisionRecordId:"d1",acceptanceRecordId:action==="PROMOTION"?"ac1":null,candidateId:"c1",
  knownGoodRecordId:"kg1",replayId:"r1",sourceCommitBefore:before,sourceCommitAfter:after,
  candidateSourceHash:"c".repeat(64),explicitlyApproved:true,oneShot:true,paperOnly:true,...locks
 };
 const decisionEvidence={
  recordId:"d1",acceptanceRecordId:operatorApproval.acceptanceRecordId,candidateId:"c1",
  knownGoodRecordId:"kg1",replayId:"r1",sourceCommitBefore:before,sourceCommitAfter:after,
  candidateSourceHash:"c".repeat(64)
 };
 const id={
  approvalRecordId:"ap1",nonce:"n1",action,decisionRecordId:"d1",
  candidateSourceHash:"c".repeat(64),currentSourceCommit,targetSourceCommit
 };
 return {
  operatorApproval,decisionEvidence,
  consumptionStoreRecord:{version:"ai_logic_operator_approval_consumption_store_v1",exactlyOnce:true,paperOnly:true,...id,...locks},
  authorityGate:{version:"ai_logic_execution_authority_gate_v1",eligible:true,readOnly:true,evidenceOnly:true,paperOnly:true,...id,...locks},
  boundaryGate:{version:"ai_logic_execution_boundary_gate_v1",eligible:true,applyEligibilityOnly:true,readOnly:true,evidenceOnly:true,paperOnly:true,...id,...locks},
  immutableManifest:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"},
  currentSourceCommit,targetSourceCommit
 };
}

test("permits only explicit local candidate-source apply seam for promotion and rollback",()=>{
 for(const action of ["PROMOTION","ROLLBACK"]){
  const r=build(fx(action));
  assert.equal(r.eligible,true);
  assert.equal(r.localCandidateSourceApplySeamReady,true);
  assert.equal(r.localCandidateFilesystemMutationScope,"ALLOWLISTED_AI_LOGIC_CANDIDATE_SOURCE_ONLY");
  for(const f of ["runtimeActivationAllowed","pm2RestartAllowed","productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed","gitCheckoutAllowed","gitResetAllowed","gitRevertAllowed","gitMergeAllowed","gitCherryPickAllowed"]) assert.equal(r[f],false,f);
 }
});

test("fails closed on approval decision or source identity drift",()=>{
 let x=fx(); x.operatorApproval={...x.operatorApproval,explicitlyApproved:false};
 assert.equal(build(x).eligible,false);
 x=fx(); x.decisionEvidence={...x.decisionEvidence,candidateId:"other"};
 assert.equal(build(x).eligible,false);
 x=fx(); x.currentSourceCommit="drift";
 assert.equal(build(x).eligible,false);
 x=fx("ROLLBACK"); x.targetSourceCommit="drift";
 assert.equal(build(x).eligible,false);
});

test("fails closed unless one-shot consumption authority and boundary evidence are exact",()=>{
 let x=fx(); x.consumptionStoreRecord={...x.consumptionStoreRecord,exactlyOnce:false};
 assert.equal(build(x).eligible,false);
 x=fx(); x.authorityGate={...x.authorityGate,eligible:false};
 assert.equal(build(x).eligible,false);
 x=fx(); x.boundaryGate={...x.boundaryGate,eligible:false};
 assert.equal(build(x).eligible,false);
 x=fx(); x.boundaryGate={...x.boundaryGate,nonce:"other"};
 assert.equal(build(x).eligible,false);
});

test("fails closed on immutable manifest failure or any opened protected authority",()=>{
 let x=fx(); x.immutableManifest={ok:false,status:"BAD"};
 assert.equal(build(x).eligible,false);
 for(const field of Object.keys(locks)){
   x=fx();
   x.boundaryGate={...x.boundaryGate,[field]:true};
   assert.equal(build(x).eligible,false,field);
 }
});

test("never relabels runtime git broker account or immutable policy authority",()=>{
 const r=build(fx());
 for(const field of [
   "runtimeActivationAllowed","pm2RestartAllowed","productionRuntimeWiringAllowed",
   "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed",
   "orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
   "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
   "allocationMutationAllowed","gitMutationAllowed","gitCheckoutAllowed","gitResetAllowed",
   "gitRevertAllowed","gitMergeAllowed","gitCherryPickAllowed"
 ]) assert.equal(r[field],false,field);
});

test("fails closed when authority or boundary gate is not paper only", () => {
  for (const target of ["authorityGate", "boundaryGate"]) {
    const f = fx("PROMOTION");
    f[target] = { ...f[target], paperOnly: false };
    const r = build(f);
    assert.equal(r.eligible, false);
    assert.equal(r.localCandidateSourceApplySeamReady, false);
    assert.equal(r.localCandidateFilesystemMutationScope, "NONE");
  }
});

test("blocked orchestrator exposes no local candidate filesystem mutation scope", () => {
  const f = fx("PROMOTION");
  f.operatorApproval = { ...f.operatorApproval, explicitlyApproved: false };
  const r = build(f);
  assert.equal(r.eligible, false);
  assert.equal(r.localCandidateSourceApplySeamReady, false);
  assert.equal(r.localCandidateFilesystemMutationScope, "NONE");
});
