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

test("serialization exactness rejects lossy descriptors without invoking getters",()=>{
  const r=create({sourceText:"export function evaluateCandidate(x){ return x; }\n"});
  const hidden={a:1};
  Object.defineProperty(hidden,"hidden",{value:2,enumerable:false});
  assert.throws(()=>r.evaluator(hidden),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  let objectGetterHits=0;
  const accessor={};
  Object.defineProperty(accessor,"x",{get(){objectGetterHits++;return 1;},enumerable:true});
  assert.throws(()=>r.evaluator(accessor),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  assert.equal(objectGetterHits,0);
  const sparse=[]; sparse.length=1;
  assert.throws(()=>r.evaluator(sparse),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  const extra=[1]; extra.extra=2;
  assert.throws(()=>r.evaluator(extra),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  const sym=[1]; sym[Symbol("x")]=2;
  assert.throws(()=>r.evaluator(sym),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  let arrayGetterHits=0;
  const arr=[];
  Object.defineProperty(arr,"0",{get(){arrayGetterHits++;return 1;},enumerable:true,configurable:true});
  arr.length=1;
  assert.throws(()=>r.evaluator(arr),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  assert.equal(arrayGetterHits,0);
  const shared={x:1};
  assert.deepEqual(r.evaluator({a:shared,b:shared}),{a:{x:1},b:{x:1}});
});

test("serialization exactness rejects invalid input and timeout forms",()=>{
  const r=create({sourceText:"export function evaluateCandidate(x){ return x; }\n"});
  for(const bad of [undefined,NaN,Infinity,()=>1,1n,new Date()]) {
    assert.throws(()=>r.evaluator(bad),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  }
  const cycle={}; cycle.self=cycle;
  assert.throws(()=>r.evaluator(cycle),/CANDIDATE_INPUT_NOT_SERIALIZABLE/);
  for(const bad of [NaN,Infinity,"500"]) {
    const rejected=create({sourceText:source},{timeoutMs:bad});
    assert.equal(rejected.eligible,false);
  }
});

test("worker serialization exactness rejects lossy candidate outputs",()=>{
  const bodies=[
    'const o={a:1};Object.defineProperty(o,"hidden",{value:2,enumerable:false});return o;',
    'const o={};Object.defineProperty(o,"x",{get(){return 1},enumerable:true});return o;',
    'const a=[];a.length=1;return a;',
    'const a=[1];a.extra=2;return a;',
    'const a=[1];a[Symbol("x")]=2;return a;',
    'const a=[];Object.defineProperty(a,"0",{get(){return 1},enumerable:true});a.length=1;return a;'
  ];
  for(const body of bodies) {
    const r=create({sourceText:`export function evaluateCandidate(){${body}}\n`});
    assert.equal(r.eligible,true);
    assert.throws(()=>r.evaluator({}),/CANDIDATE_EVALUATION_ERROR/);
  }
});

test("candidate authority globals and import surfaces remain blocked",()=>{
  for(const name of ["process","Buffer","require","fetch"]) {
    const r=create({sourceText:`export function evaluateCandidate(){return typeof ${name};}\n`});
    assert.equal(r.eligible,true);
    assert.equal(r.evaluator({}),"undefined");
  }
  for(const body of ["return import('node:fs');","return import.meta.url;"]) {
    const r=create({sourceText:`export function evaluateCandidate(){${body}}\n`});
    assert.equal(r.eligible,true);
    assert.throws(()=>r.evaluator({}),/CANDIDATE_EVALUATION_ERROR/);
  }
  const st=create({sourceText:"import fs from 'node:fs'; export function evaluateCandidate(){return 1;}\n"});
  assert.equal(st.eligible,true);
  assert.throws(()=>st.evaluator({}),/CANDIDATE_EVALUATION_ERROR/);
});
