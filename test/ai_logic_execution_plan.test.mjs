import test from"node:test";
import assert from"node:assert/strict";
import{buildAiLogicExecutionPlan as b}from"../src/scanner/ai_logic_execution_plan.mjs";
const L={productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false};
function fx(action="PROMOTION"){
 const before="before",after="after",cur=action==="PROMOTION"?before:after,tar=action==="PROMOTION"?after:before;
 const identity={action,decisionRecordId:"d1",sourceCommitBefore:before,sourceCommitAfter:after,nonce:"n1"};
 return{
  authorityGate:{version:"ai_logic_execution_authority_gate_v1",eligible:true,evidenceOnly:true,approvalRecordId:"ap1",nonce:"n1",action,decisionRecordId:"d1",currentSourceCommit:cur,targetSourceCommit:tar,...L},
  immutableManifest:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"},
  operatorApproval:{version:"ai_logic_operator_approval_record_v1",valid:true,explicitlyApproved:true,oneShot:true,recordId:"ap1",...identity,expiresAt:"2030-01-01T00:00:00.000Z"},
  consumptionStoreRecord:{version:"ai_logic_operator_approval_consumption_store_v1",exactlyOnce:true,approvalRecordId:"ap1",nonce:"n1",action,decisionRecordId:"d1",currentSourceCommit:cur,targetSourceCommit:tar},
  now:"2029-01-01T00:00:00.000Z"
 }
}
test("builds promotion and rollback readonly plans with zero effects", ()=>{
 for(const action of["PROMOTION","ROLLBACK"]){
  const r=b(fx(action));
  assert.equal(r.eligible,true);
  assert.equal(r.planOnly,true);
  assert.equal(r.readOnly,true);
  assert.equal(r.executionSideEffects,"NONE");
  assert.equal(r.gitEffects,"NONE");
  assert.equal(r.promotionExecutionAllowed,false);
  assert.equal(r.rollbackExecutionAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
  assert.equal(r.exactSourceTransition.from,r.currentSourceCommit);
  assert.equal(r.exactSourceTransition.to,r.targetSourceCommit);
  assert.deepEqual(r.auditIdentity,{approvalRecordId:r.approvalRecordId,nonce:r.nonce,action:r.action,decisionRecordId:r.decisionRecordId,currentSourceCommit:r.currentSourceCommit,targetSourceCommit:r.targetSourceCommit});
  assert.equal(r.preconditions.authorityGateEligible,true);
  assert.equal(r.preconditions.immutableManifestVerified,true);
  assert.equal(r.preconditions.operatorApprovalValid,true);
  assert.equal(r.preconditions.consumptionExactlyOnce,true);
  assert.equal(r.postconditions.executionSideEffects,"NONE");
  assert.equal(r.postconditions.gitEffects,"NONE");
  assert.equal(r.postconditions.runtimeIntegration,"NONE");
 }
});
test("fails closed on authority drift expiry manifest and consumption mismatch", ()=>{
 let f=fx(); assert.equal(b({...f,authorityGate:{...f.authorityGate,gitMutationAllowed:true}}).eligible,false);
 f=fx(); assert.equal(b({...f,now:"2031-01-01T00:00:00.000Z"}).eligible,false);
 f=fx(); assert.equal(b({eligible:false,...f,immutableManifest:{ok:false,status:"BAD"}}).eligible,false);
 f=fx(); assert.equal(b({...f,consumptionStoreRecord:{...f.consumptionStoreRecord,targetSourceCommit:"drift"}}).eligible,false);
});
