import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const p=path.resolve("scripts/apply_ai_logic_candidate.mjs");
const s=fs.readFileSync(p,"utf8");

test("requires explicit operator invocation and local source apply confirmation",()=>{
  for(const name of ["approval-record-id","expected-preimage-hash","operation-id"]) assert.match(s,new RegExp(`value\\("${name}"\\)`));
  for(const token of ["--explicit-operator-invocation","--confirm-local-candidate-source-apply"]) assert.equal(s.includes(token),true,token);
});

test("supplies fresh HEAD immutable revalidation and all executor validators",()=>{
  assert.match(s,/git[\s\S]*rev-parse[\s\S]*HEAD/);
  assert.match(s,/verifyImmutablePolicyManifest/);
  for(const name of ["syntax","focusedTests","fullRegression"]) assert.match(s,new RegExp(`${name}:`));
});

test("does not grant runtime broker account policy sizing allocation or git authority",()=>{
  for(const x of ["pm2","alpaca","orderPlacementAllowed:true","liveTradingAllowed:true","accountMutationAllowed:true","immutablePolicyMutationAllowed:true","thresholdMutationAllowed:true","sizingMutationAllowed:true","allocationMutationAllowed:true","gitMutationAllowed:true"]) assert.equal(s.includes(x),false,x);
});

test("requires durable apply outcome binding before executable success",()=>{
  assert.match(s,/applyOutcomePersistence\?\.persisted===true/);
  assert.match(s,/applyOutcomeBinding\?\.durableEvidenceEligible===true/);
  assert.match(s,/AI_LOGIC_APPLY_OUTCOME_DURABLE_EVIDENCE_VALID/);
  assert.match(s,/process\.exit\(durableApplyOutcomeValid\?0:1\)/);
});
