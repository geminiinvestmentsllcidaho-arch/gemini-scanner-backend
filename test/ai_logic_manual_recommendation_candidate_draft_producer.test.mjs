import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLogicManualRecommendationCandidateDraft as run } from "../src/scanner/ai_logic_manual_recommendation_candidate_draft_producer.mjs";

const bridge=(patch={})=>({
  version:"ai_logic_manual_recommendation_candidate_bridge_v1",eligible:true,
  status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_BRIDGE_READY",
  disposition:"OPERATOR_INVOKED_OFFLINE_CANDIDATE_DRAFT_ONLY",
  recommendationId:"rec-1",candidateTopic:"classification_coverage",...patch
});
const spec=(patch={})=>({
  candidateId:"cand-1",candidateTopic:"classification_coverage",
  evaluatorBody:"return input?.classified === true ? 'KNOWN' : 'UNKNOWN';",
  mutationIntents:["classification_coverage"],fromRecommendationText:false,writeFiles:false,callOrchestrator:false,...patch
});
test("builds only an explicit in-memory single-export candidate draft with authority closed",()=>{
  const r=run({explicitOperatorInvocation:true,bridge:bridge(),operatorDraftSpec:spec()});
  assert.equal(r.eligible,true);
  assert.equal(r.recommendationId,"rec-1");
  assert.equal(r.candidateTopic,"classification_coverage");
  assert.match(r.sourceText,/^export function evaluateCandidate\(input\)\{/);
  assert.equal((r.sourceText.match(/\bexport\b/g)||[]).length,1);
  assert.equal(r.filesWritten,false); assert.equal(r.orchestratorCalled,false); assert.deepEqual(r.files,[]);
  for(const k of ["runtimeActivationAllowed","productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
    "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed",
    "accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
    "allocationMutationAllowed","gitMutationAllowed"]) assert.equal(r[k],false,k);
});
test("requires ready bridge explicit invocation and exact operator topic binding",()=>{
  for(const x of [
    {explicitOperatorInvocation:false,bridge:bridge(),operatorDraftSpec:spec()},
    {explicitOperatorInvocation:true,bridge:bridge({eligible:false}),operatorDraftSpec:spec()},
    {explicitOperatorInvocation:true,bridge:bridge(),operatorDraftSpec:spec({candidateTopic:"evidence_interpretation"})}
  ]) assert.equal(run(x).eligible,false);
});
test("forbids freeform recommendation translation imports nested exports and side-effect requests",()=>{
  for(const p of [
    {fromRecommendationText:true},
    {evaluatorBody:"import fs from 'node:fs'; return input;"},
    {evaluatorBody:"export const x=1; return input;"},
    {writeFiles:true},{callOrchestrator:true}
  ]) assert.equal(run({explicitOperatorInvocation:true,bridge:bridge(),operatorDraftSpec:spec(p)}).eligible,false);
});
test("runs semantic guard before declaring draft ready",()=>{
  const r=run({explicitOperatorInvocation:true,bridge:bridge(),operatorDraftSpec:spec({
    evaluatorBody:"return input.position_sizing;",
    mutationIntents:["position_sizing"]
  })});
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.some(x=>x.includes("FORBIDDEN_MUTATION_INTENT:position_sizing")));
});
test("preserves bridge provenance on rejection",()=>{
  const r=run({explicitOperatorInvocation:true,bridge:bridge(),operatorDraftSpec:spec({evaluatorBody:""})});
  assert.equal(r.recommendationId,"rec-1");
  assert.equal(r.candidateTopic,"classification_coverage");
  assert.equal(r.sourceText,null);
});
