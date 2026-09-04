import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createAiLogicIsolatedEvaluator as create } from "../src/scanner/ai_logic_candidate_isolated_runner.mjs";

const h=(s)=>crypto.createHash("sha256").update(s).digest("hex");
const source="export function evaluateCandidate(x){ return x?.ok === true ? 'OK' : 'NO'; }\n";

test("executes deterministic candidate in isolated child vm with authority closed",()=>{
  const r=create({sourceText:source,expectedSourceHash:h(source)},{timeoutMs:500});
  assert.equal(r.eligible,true);
  assert.equal(r.evaluator({ok:true}),"OK");
  assert.equal(r.evaluator({ok:false}),"NO");
  assert.equal(r.isolation,"CHILD_PROCESS_VM_MODULE");
  assert.equal(r.importsAllowed,false);
  assert.equal(r.dynamicImportAllowed,false);
  assert.equal(r.asyncEvaluatorAllowed,false);
  assert.equal(r.timeoutEnforced,true);
  assert.equal(r.environmentAuthority,"EMPTY");
  for(const k of [
    "productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed",
    "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
    "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
    "allocationMutationAllowed","gitMutationAllowed"
  ]) assert.equal(r[k],false,k);
});

test("fails closed on source hash drift",()=>{
  const r=create({sourceText:source,expectedSourceHash:"deadbeef"});
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("SOURCE_HASH_MISMATCH"));
});

test("candidate cannot access process or dynamic import",()=>{
  const p=create({sourceText:"export function evaluateCandidate(){ return typeof process; }\n"});
  assert.equal(p.eligible,true);
  assert.equal(p.evaluator({}),"undefined");

  const d=create({sourceText:"export function evaluateCandidate(){ return import('node:fs'); }\n"});
  assert.equal(d.eligible,true);
  assert.throws(()=>d.evaluator({}),/CANDIDATE_EVALUATION_ERROR/);
});

test("times out infinite candidate evaluation",()=>{
  const r=create({sourceText:"export function evaluateCandidate(){ while(true){} }\n"},{timeoutMs:50});
  assert.equal(r.eligible,true);
  assert.throws(()=>r.evaluator({}),/CANDIDATE_EVALUATION_(TIMEOUT|ERROR)/);
});
