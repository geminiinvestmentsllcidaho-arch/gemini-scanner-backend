import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLogicPromotionExecutionAuthorityContract as build } from "../src/scanner/ai_logic_promotion_execution_authority_contract.mjs";

const locks={productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false};
const evidence=()=>({version:"ai_logic_promotion_decision_evidence_store_v1",recordId:"pd1",acceptanceRecordId:"a1",candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",localJsonlOnly:true,...locks});
const approval=()=>({explicitlyApproved:true,oneShot:true,paperOnly:true,noLiveTradingAcknowledged:true,noImmutablePolicyMutationAcknowledged:true,promotionDecisionRecordId:"pd1",acceptanceRecordId:"a1",candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after"});
const base=()=>({promotionEvidence:evidence(),operatorApproval:approval(),currentSourceCommit:"before",immutableManifest:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"},knownGood:{valid:true,status:"KNOWN_GOOD_RECORD_VALID",recordId:"k1",sourceCommit:"before"}});
test("builds identity-bound operator-approved promotion authority evidence while execution remains closed", ()=>{
  const r=build(base());
  assert.equal(r.eligible,true);
  assert.equal(r.status,"AI_LOGIC_PROMOTION_EXECUTION_AUTHORITY_REVIEW_READY");
  assert.equal(r.targetSourceCommit,"after");
  assert.equal(r.baselineSourceCommit,"before");
  assert.equal(r.promotionExecutionAllowed,false);
  assert.equal(r.autonomousPromotionAllowed,false);
  assert.equal(r.gitCheckoutAllowed,false);
  assert.equal(r.gitMergeAllowed,false);
  assert.equal(r.gitCherryPickAllowed,false);
});
test("fails closed on missing approval or any approval identity drift", ()=>{
  assert.equal(build({...base(),operatorApproval:{...approval(),explicitlyApproved:false}}).eligible,false);
  for(const k of ["promotionDecisionRecordId","acceptanceRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter"]){
    const a=approval(); a[k]="drift"; assert.equal(build({...base(),operatorApproval:a}).eligible,false);
  }
});
test("fails closed on current commit drift known-good drift or immutable manifest failure", ()=>{
  assert.equal(build({...base(),currentSourceCommit:"other"}).eligible,false);
  assert.equal(build({...base(),knownGood:{...base().knownGood,sourceCommit:"other"}}).eligible,false);
  assert.equal(build({...base(),immutableManifest:{ok:false,status:"IMMUTABLE_MANIFEST_REJECT"}}).eligible,false);
});
test("fails closed if promotion evidence opens execution policy or runtime authority", ()=>{
  for(const k of Object.keys(locks)){
    const e=evidence(); e[k]=true; assert.equal(build({...base(),promotionEvidence:e}).eligible,false);
  }
});
test("never grants broker order account live immutable threshold sizing allocation or git mutation authority", ()=>{
  const r=build(base());
  for(const k of ["brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitCheckoutAllowed","gitResetAllowed","gitRevertAllowed","gitMergeAllowed","gitCherryPickAllowed"]) assert.equal(r[k],false);
});
