import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicManualRecommendationCandidateBridge as run } from "../src/scanner/ai_logic_manual_recommendation_candidate_bridge.mjs";

const rec=(patch={})=>({
  recommendationId:"rec-1",targetArea:"classification_coverage",
  suggestedDirection:"Add historical measurement coverage.",evidenceSummary:"Repeated unclassified decisions.",
  proposalOnly:true,requiresBacktest:true,requiresOperatorApproval:true,
  implementationIncluded:false,patchIncluded:false,automaticLearningAllowed:false,
  automaticPatchAllowed:false,scannerLogicMutationAllowed:false,thresholdMutationAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,...patch
});

test("maps explicit manual recommendation to allowlisted offline candidate topic without source patch",()=>{
  const r=run({explicitOperatorInvocation:true,recommendation:rec()});
  assert.equal(r.eligible,true);
  assert.equal(r.recommendationId,"rec-1");
  assert.equal(r.candidateTopic,"classification_coverage");
  assert.equal(r.candidateSourceText,null);
  assert.deepEqual(r.candidateFiles,[]);
  assert.equal(r.sourcePatchIncluded,false);
  for(const k of ["runtimeActivationAllowed","productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
    "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed",
    "liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed",
    "sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"]) assert.equal(r[k],false,k);
});

test("requires explicit operator invocation",()=>{
  const r=run({recommendation:rec()});
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("EXPLICIT_OPERATOR_INVOCATION_REQUIRED"));
});

test("rejects unsafe recommendation authority or included implementation",()=>{
  for(const patch of [
    {proposalOnly:false},{requiresBacktest:false},{requiresOperatorApproval:false},
    {implementationIncluded:true},{patchIncluded:true},{automaticLearningAllowed:true},
    {automaticPatchAllowed:true},{scannerLogicMutationAllowed:true},{thresholdMutationAllowed:true},
    {brokerContactAllowed:true},{orderPlacementAllowed:true},{accountMutationAllowed:true}
  ]) assert.equal(run({explicitOperatorInvocation:true,recommendation:rec(patch)}).eligible,false);
});

test("maps only known review areas to existing allowlisted candidate topics",()=>{
  const cases=[
    ["entry_confirmation","false_positive_classification_logic"],
    ["ranking_confidence","false_positive_classification_logic"],
    ["rejection_sensitivity","missed_opportunity_classification_logic"],
    ["wait_timing","decision_timing_logic_without_threshold_mutation"],
    ["entry_timing","decision_timing_logic_without_threshold_mutation"],
    ["decision_boundaries","evidence_interpretation"],
    ["manual_scanner_calibration","evidence_interpretation"],
    ["classification_coverage","classification_coverage"]
  ];
  for(const [targetArea,topic] of cases){
    const r=run({explicitOperatorInvocation:true,recommendation:rec({targetArea})});
    assert.equal(r.eligible,true,targetArea);
    assert.equal(r.candidateTopic,topic,targetArea);
  }
  const bad=run({explicitOperatorInvocation:true,recommendation:rec({targetArea:"position_sizing"})});
  assert.equal(bad.eligible,false);
  assert.ok(bad.reasons.includes("TARGET_AREA_NOT_MAPPABLE_TO_ALLOWLISTED_CANDIDATE_TOPIC"));
});

test("preserves recommendation identity on rejection",()=>{
  const r=run({explicitOperatorInvocation:true,recommendation:rec({targetArea:"unknown"})});
  assert.equal(r.recommendationId,"rec-1");
  assert.equal(r.sourcePatchIncluded,false);
});
