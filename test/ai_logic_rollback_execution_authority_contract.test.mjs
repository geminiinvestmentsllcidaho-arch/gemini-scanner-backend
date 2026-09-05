import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLogicRollbackExecutionAuthorityContract as build } from "../src/scanner/ai_logic_rollback_execution_authority_contract.mjs";

const locks={productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false};
const evidence=()=>({version:"ai_logic_rollback_decision_evidence_store_v1",recordId:"rb1",candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",candidateSourceHash:"c".repeat(64),immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",rollbackTargetIdentified:true,rollbackDecisionEvidenceOnly:true,localJsonlOnly:true,...locks});
const approval=()=>({explicitlyApproved:true,oneShot:true,paperOnly:true,noLiveTradingAcknowledged:true,noImmutablePolicyMutationAcknowledged:true,rollbackDecisionRecordId:"rb1",candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",candidateSourceHash:"c".repeat(64)});
const base=()=>({rollbackEvidence:evidence(),operatorApproval:approval(),currentSourceCommit:"after",immutableManifest:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"},knownGood:{valid:true,status:"KNOWN_GOOD_RECORD_VALID",recordId:"k1",sourceCommit:"before"}});

test("builds identity-bound operator-approved rollback authority evidence while execution remains closed",()=>{
  const r=build(base());
  assert.equal(r.eligible,true);
  assert.equal(r.targetSourceCommit,"before");
  assert.equal(r.currentSourceCommit,"after");
  assert.equal(r.preExecutionRevalidationComplete,true);
  assert.equal(r.rollbackExecutionAllowed,false);
  assert.equal(r.autonomousRollbackAllowed,false);
  assert.equal(r.productionRuntimeWiringAllowed,false);
  assert.equal(r.gitCheckoutAllowed,false);
  assert.equal(r.gitResetAllowed,false);
  assert.equal(r.gitRevertAllowed,false);
});

test("fails closed on missing approval or any approval identity drift",()=>{
  assert.equal(build({...base(),operatorApproval:{...approval(),explicitlyApproved:false}}).eligible,false);
  for(const k of ["rollbackDecisionRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"]){
    assert.equal(build({...base(),operatorApproval:{...approval(),[k]:"drift"}}).eligible,false,k);
  }
});

test("fails closed on current commit drift known-good drift or immutable manifest failure",()=>{
  assert.equal(build({...base(),currentSourceCommit:"other"}).eligible,false);
  assert.equal(build({...base(),knownGood:{...base().knownGood,sourceCommit:"other"}}).eligible,false);
  assert.equal(build({...base(),immutableManifest:{ok:false,status:"IMMUTABLE_MANIFEST_REJECT"}}).eligible,false);
});

test("fails closed if rollback evidence opens execution policy or runtime authority",()=>{
  for(const k of Object.keys(locks)){
    const x=base(); x.rollbackEvidence={...x.rollbackEvidence,[k]:true};
    assert.equal(build(x).eligible,false,k);
  }
});

test("never grants broker order account live immutable threshold sizing allocation or git mutation authority",()=>{
  const r=build(base());
  for(const k of ["brokerContactAllowed","orderPlacementAllowed","accountMutationAllowed","liveTradingAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitCheckoutAllowed","gitResetAllowed","gitRevertAllowed"]) assert.equal(r[k],false,k);
});

test("candidate source hash is required bound and preserved",()=>{const r=build(base());assert.equal(r.candidateSourceHash,"c".repeat(64));const e=evidence();delete e.candidateSourceHash;assert.equal(build({...base(),rollbackEvidence:e}).eligible,false);assert.equal(build({...base(),operatorApproval:{...approval(),candidateSourceHash:"d".repeat(64)}}).eligible,false)});
