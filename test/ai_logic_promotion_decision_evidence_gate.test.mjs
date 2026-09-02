import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicPromotionDecisionEvidence } from "../src/scanner/ai_logic_promotion_decision_evidence_gate.mjs";

const locks={productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false};

function fixture(){
  const acceptanceEvidence={version:"ai_logic_acceptance_evidence_store_v1",recordId:"a1",candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",localJsonlOnly:true,...locks};
  const knownGood={valid:true,status:"KNOWN_GOOD_RECORD_VALID",recordId:"k1",sourceCommit:"before",immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",rollbackTargetIdentified:true,rollbackExecutable:false,promotionEligible:false,strategySwitchingAllowed:false,...locks};
  const shadowAssessment={version:"ai_logic_shadow_probation_consumer_v1",accepted:true,status:"AI_LOGIC_SHADOW_PROBATION_ASSESSMENT_EVIDENCE",disposition:"ISOLATED_PROBATION_ASSESSMENT_EVIDENCE_ONLY",binding:{acceptanceRecordId:"a1",candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after"},immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",...locks};
  return {acceptanceEvidence,knownGood,shadowAssessment};
}

test("emits promotion decision evidence only with exact bindings and all locks closed",()=>{
  const r=evaluateAiLogicPromotionDecisionEvidence(fixture());
  assert.equal(r.eligible,true);
  assert.equal(r.status,"AI_LOGIC_PROMOTION_DECISION_EVIDENCE_READY");
  assert.equal(r.disposition,"PROMOTION_DECISION_EVIDENCE_ONLY");
  assert.equal(r.promotionExecutionAllowed,false);
  assert.equal(r.rollbackExecutionAllowed,false);
  assert.deepEqual(r.reasons,[]);
});

test("fails closed on shadow assessment identity mismatch",()=>{
  const f=fixture();
  f.shadowAssessment={...f.shadowAssessment,binding:{...f.shadowAssessment.binding,candidateId:"other"}};
  const r=evaluateAiLogicPromotionDecisionEvidence(f);
  assert.equal(r.eligible,false);
  assert.equal(r.disposition,"REJECT_OR_HOLD");
  assert.ok(r.reasons.includes("ASSESSMENT_CANDIDATE_BINDING_MISMATCH"));
});

test("fails closed without known-good rollback target or when a mutation lock is open",()=>{
  const f=fixture();
  f.knownGood={...f.knownGood,rollbackTargetIdentified:false};
  f.shadowAssessment={...f.shadowAssessment,promotionAllowed:true};
  const r=evaluateAiLogicPromotionDecisionEvidence(f);
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("KNOWN_GOOD_ROLLBACK_TARGET_REQUIRED"));
  assert.ok(r.reasons.includes("MUTATION_LOCK_NOT_CLOSED_PROMOTIONALLOWED"));
});
