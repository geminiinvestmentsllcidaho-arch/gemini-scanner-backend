import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bindAiLogicCandidateEvaluator as bind } from "../src/scanner/ai_logic_candidate_evaluator_binding.mjs";

const manifest=Object.freeze({ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"});
const h=(s)=>crypto.createHash("sha256").update(s).digest("hex");
test("binds exactly one isolated evaluator with source hash and all authority closed", async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"a57e-"));
  const rel="src/scanner/ai_logic_candidates/c1.mjs";
  const src="export function evaluateCandidate(x){ return x?.ok === true ? 'OK' : 'NO'; }\n";
  fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});
  fs.writeFileSync(path.join(root,rel),src,{mode:0o600});
  const r=await bind({candidatePath:rel,expectedSourceHash:h(src)},{rootDir:root,manifestResult:manifest});
  assert.equal(r.eligible,true);
  assert.equal(r.status,"AI_LOGIC_CANDIDATE_EVALUATOR_BOUND");
  assert.equal(r.evaluator({ok:true}),"OK");
  assert.equal(r.sourceHash,h(src));
  for(const k of ["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed",
    "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
    "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
    "allocationMutationAllowed","gitMutationAllowed"]) assert.equal(r[k],false,k);
});
test("fails closed on outside path dependency import hash drift or extra export", async()=>{
  const cases=[
    ["src/server.mjs","export function evaluateCandidate(x){return x;}\n",null,"CANDIDATE_SANDBOX_PATH_REQUIRED"],
    ["src/scanner/ai_logic_candidates/c2.mjs","import fs from 'node:fs'; export function evaluateCandidate(x){return x;}\n",null,"DEPENDENCY_IMPORT_FORBIDDEN"],
    ["src/scanner/ai_logic_candidates/c3.mjs","export function evaluateCandidate(x){return x;}\n","deadbeef","SOURCE_HASH_MISMATCH"],
    ["src/scanner/ai_logic_candidates/c4.mjs","export function evaluateCandidate(x){return x;} export const extra=1;\n",null,"SINGLE_EVALUATOR_EXPORT_REQUIRED"],
  ];
  for(const [rel,src,expected,reason] of cases){
    const root=fs.mkdtempSync(path.join(os.tmpdir(),"a57e-"));
    if(rel.startsWith("src/scanner/ai_logic_candidates/")){
      fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});
      fs.writeFileSync(path.join(root,rel),src);
    }
    const r=await bind({candidatePath:rel,expectedSourceHash:expected ?? ""},{rootDir:root,manifestResult:manifest});
    assert.equal(r.eligible,false);
    assert.ok(r.reasons.includes(reason),`${reason}: ${r.reasons}`);
    assert.equal(r.evaluator,null);
  }
});
