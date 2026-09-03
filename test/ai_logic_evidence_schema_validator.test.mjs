import test from "node:test";
import assert from "node:assert/strict";
import { validateAiLogicEvidenceSchemas } from "../src/scanner/ai_logic_evidence_schema_validator.mjs";

const locks=()=>({
  productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false
});

function fixture(action="PROMOTION"){
  const before="a".repeat(40), after="b".repeat(40), decisionRecordId="decision-1";
  const identity={decisionRecordId,candidateId:"cand-1",knownGoodRecordId:"kg-1",replayId:"replay-1",
    sourceCommitBefore:before,sourceCommitAfter:after,nonce:"nonce-1",
    ...(action==="PROMOTION"?{acceptanceRecordId:"acc-1"}:{})};
  const decisionEvidence={
    version:action==="PROMOTION"?"ai_logic_promotion_decision_evidence_store_v1":"ai_logic_rollback_decision_evidence_store_v1",
    recordId:decisionRecordId,candidateId:identity.candidateId,knownGoodRecordId:identity.knownGoodRecordId,
    replayId:identity.replayId,sourceCommitBefore:before,sourceCommitAfter:after,
    ...(identity.acceptanceRecordId?{acceptanceRecordId:identity.acceptanceRecordId}:{}),
    ...(action==="ROLLBACK"?{rollbackTargetIdentified:true,rollbackDecisionEvidenceOnly:true}:{}),
    ...(action==="ROLLBACK"?{rollbackTargetIdentified:true,rollbackDecisionEvidenceOnly:true}:{}),
    localJsonlOnly:true,persistenceAllowed:false,promotionAllowed:false,immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",...locks()
  };
  const knownGood={version:"ai_logic_known_good_record_v1",valid:true,status:"KNOWN_GOOD_RECORD_VALID",
    recordId:"kg-1",sourceCommit:before,persistenceAllowed:false,strategySwitchingAllowed:false,...locks()};
  const operatorApproval={version:"ai_logic_operator_approval_record_v1",valid:true,explicitlyApproved:true,oneShot:true,
    recordId:"approval-1",...identity,paperOnly:true,localJsonlOnly:true,...locks()};
  const currentSourceCommit=action==="PROMOTION"?before:after;
  const targetSourceCommit=action==="PROMOTION"?after:before;
  const executionPreview={version:"ai_logic_execution_preview_contract_v1",eligible:true,previewOnly:true,paperOnly:true,
    approvalRecordId:"approval-1",nonce:"nonce-1",action,decisionRecordId,currentSourceCommit,targetSourceCommit,
    gitEffects:"NONE",...locks()};
  const consumptionStoreRecord={version:"ai_logic_operator_approval_consumption_store_v1",exactlyOnce:true,paperOnly:true,
    localJsonlOnly:true,approvalRecordId:"approval-1",nonce:"nonce-1",action,decisionRecordId,currentSourceCommit,targetSourceCommit,
    ...locks()};
  return {action,decisionEvidence,knownGood,executionPreview,operatorApproval,consumptionStoreRecord};
}

test("validates promotion and rollback schemas as readonly evidence only",()=>{
  for(const action of ["PROMOTION","ROLLBACK"]){
    const r=validateAiLogicEvidenceSchemas(fixture(action));
    assert.equal(r.eligible,true);
    assert.equal(r.readOnly,true);
    assert.equal(r.evidenceOnly,true);
    assert.equal(r.paperOnly,true);
    assert.equal(r.executionSideEffects,"NONE");
    assert.equal(r.runtimeIntegration,"NONE");
    assert.equal(r.gitEffects,"NONE");
  }
});

test("fails closed on version lock mode and binding drift",()=>{
  const cases=[
    f=>f.decisionEvidence.version="bad",
    f=>f.decisionEvidence.promotionAllowed=true,
    f=>f.executionPreview.previewOnly=false,
    f=>f.operatorApproval.localJsonlOnly=false,
    f=>f.consumptionStoreRecord.exactlyOnce=false,
    f=>f.executionPreview.targetSourceCommit="c".repeat(40),
    f=>f.executionPreview.action="ROLLBACK",
    f=>f.executionPreview.approvalRecordId="other",
    f=>f.executionPreview.nonce="other",
    f=>f.executionPreview.decisionRecordId="other",
    f=>f.consumptionStoreRecord.currentSourceCommit=f.consumptionStoreRecord.targetSourceCommit,
    f=>f.decisionEvidence.candidateId="other",
    f=>f.knownGood.sourceCommit="d".repeat(40)
  ];
  for(const mutate of cases){
    const f=fixture(); mutate(f);
    assert.equal(validateAiLogicEvidenceSchemas(f).eligible,false);
  }
});
