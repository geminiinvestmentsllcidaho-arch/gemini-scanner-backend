import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLogicManualRecommendationCandidateOrchestratorInput as run } from "../src/scanner/ai_logic_manual_recommendation_candidate_orchestrator_adapter.mjs";

const locks={
  runtimeActivationAllowed:false,productionRuntimeWiringAllowed:false,persistenceAllowed:false,
  promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,
};
const draft=(patch={})=>({
  version:"ai_logic_manual_recommendation_candidate_draft_producer_v1",eligible:true,
  status:"AI_LOGIC_MANUAL_RECOMMENDATION_CANDIDATE_DRAFT_READY",
  disposition:"IN_MEMORY_OFFLINE_CANDIDATE_DRAFT_ONLY",recommendationId:"rec-1",
  candidateId:"cand-1",candidateTopic:"classification_coverage",
  sourceText:"export function evaluateCandidate(input){\nreturn input?.ok===true?'OK':'NO';\n}\n",
  mutationIntents:["classification_coverage"],singleExport:"evaluateCandidate",importsAllowed:false,
  inMemoryOnly:true,orchestratorCalled:false,filesWritten:false,...locks,...patch
});
const input=(patch={})=>({explicitOperatorInvocation:true,draft:draft(),samples:[{sampleId:"s1",input:{ok:true},expected:"OK"}],baselineEvaluator:()=>"NO",...patch});

test("builds exact explicit offline orchestrator input without calling or writing",()=>{
  const r=run(input());
  assert.equal(r.eligible,true);
  assert.equal(r.recommendationId,"rec-1");
  assert.equal(r.candidatePath,"src/scanner/ai_logic_candidates/cand-1.mjs");
  assert.equal(r.orchestratorInput.candidateId,"cand-1");
  assert.equal(r.orchestratorInput.topic,"classification_coverage");
  assert.equal(r.orchestratorInput.explicitFixtureOrInMemoryOnly,true);
  assert.equal(r.orchestratorInput.requestsExistingSourceMutation,false);
  assert.equal(r.orchestratorInput.requestsProductionWiring,false);
  assert.equal(r.orchestratorInput.requestsLedgerWrite,false);
  assert.deepEqual(r.orchestratorInput.files,[{path:"src/scanner/ai_logic_candidates/cand-1.mjs",content:r.orchestratorInput.files[0].content}]);
  assert.equal(r.orchestratorCalled,false); assert.equal(r.filesWritten,false);
  for(const [k,v] of Object.entries(locks)) assert.equal(r[k],v,k);
});
test("requires explicit invocation ready draft samples and baseline evaluator",()=>{
  for(const x of [
    input({explicitOperatorInvocation:false}),
    input({draft:draft({eligible:false})}),
    input({samples:[]}),
    input({baselineEvaluator:null})
  ]) assert.equal(run(x).eligible,false);
});
test("rejects unsafe candidate ids before constructing sandbox path",()=>{
  for(const id of ["../x","a/b","", " x "]) {
    const r=run(input({draft:draft({candidateId:id})}));
    assert.equal(r.eligible,false,id);
    assert.equal(r.candidatePath,null);
  }
});
test("fails closed if draft safety locks or single-export contract drift",()=>{
  for(const patch of [
    {gitMutationAllowed:true},{productionRuntimeWiringAllowed:true},{singleExport:"x"},
    {importsAllowed:true},{inMemoryOnly:false},{orchestratorCalled:true},{filesWritten:true}
  ]) assert.equal(run(input({draft:draft(patch)})).eligible,false);
});
test("preserves draft provenance on rejection",()=>{
  const r=run(input({samples:[]}));
  assert.equal(r.recommendationId,"rec-1");
  assert.equal(r.candidateId,"cand-1");
  assert.equal(r.candidateTopic,"classification_coverage");
});
