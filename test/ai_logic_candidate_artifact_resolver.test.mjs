import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveAiLogicCandidateArtifact as resolve } from "../src/scanner/ai_logic_candidate_artifact_resolver.mjs";

const manifest={ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"};
const H=b=>crypto.createHash("sha256").update(b).digest("hex");
function fx(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"ai-artifact-resolver-"));
  const rel="src/scanner/ai_logic_candidates/example.mjs";
  const abs=path.join(root,rel);
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  const bytes=Buffer.from("export function evaluateCandidate(x){ return x; }\n","utf8");
  fs.writeFileSync(abs,bytes,{mode:0o600});
  return {root,rel,abs,bytes};
}

test("resolves exact canonical candidate bytes with all authority closed",()=>{
  const f=fx();
  const before=fs.readFileSync(f.abs);
  const r=resolve({candidatePath:f.rel,expectedSourceHash:H(f.bytes)},{rootDir:f.root,manifestResult:manifest});
  assert.equal(r.eligible,true);
  assert.equal(r.status,"AI_LOGIC_CANDIDATE_ARTIFACT_RESOLVED");
  assert.equal(r.sourceHash,H(f.bytes));
  assert.deepEqual(r.candidateBytes,f.bytes);
  assert.equal(r.sourceText,f.bytes.toString("utf8"));
  for(const k of [
    "productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed",
    "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
    "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
    "allocationMutationAllowed","gitMutationAllowed"
  ]) assert.equal(r[k],false);
  assert.deepEqual(fs.readFileSync(f.abs),before);
});

test("fails closed on hash path manifest symlink and malformed utf8",()=>{
  let f=fx();
  assert.equal(resolve({candidatePath:f.rel,expectedSourceHash:"0".repeat(64)},{rootDir:f.root,manifestResult:manifest}).eligible,false);
  assert.equal(resolve({candidatePath:"../escape.mjs",expectedSourceHash:H(f.bytes)},{rootDir:f.root,manifestResult:manifest}).eligible,false);
  assert.equal(resolve({candidatePath:f.rel,expectedSourceHash:H(f.bytes)},{rootDir:f.root,manifestResult:{ok:false,status:"BAD"}}).eligible,false);

  f=fx();
  const outside=path.join(f.root,"outside.mjs");
  fs.writeFileSync(outside,f.bytes);
  fs.unlinkSync(f.abs);
  fs.symlinkSync(outside,f.abs);
  assert.equal(resolve({candidatePath:f.rel,expectedSourceHash:H(f.bytes)},{rootDir:f.root,manifestResult:manifest}).eligible,false);

  f=fx();
  const bad=Buffer.from([0xc3,0x28]);
  fs.writeFileSync(f.abs,bad);
  assert.equal(resolve({candidatePath:f.rel,expectedSourceHash:H(bad)},{rootDir:f.root,manifestResult:manifest}).eligible,false);
});


test("fails closed on group/world writable candidate mode",()=>{
  const f=fx();
  fs.chmodSync(f.abs,0o622);
  const r=resolve({candidatePath:f.rel,expectedSourceHash:H(f.bytes)},{rootDir:f.root,manifestResult:manifest});
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("CANDIDATE_MODE_UNSAFE"));
});

test("keeps local sandbox filesystem and runtime activation authority closed",()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),"ai-candidate-authority-"));
  const rel="src/scanner/ai_logic_candidates/c1.mjs", f=path.join(d,rel);
  fs.mkdirSync(path.dirname(f),{recursive:true});
  fs.writeFileSync(f,"export function evaluate(x){return x}\n",{mode:0o600});
  const h=crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  const r=resolve({candidatePath:rel,expectedSourceHash:h},{rootDir:d,manifestResult:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"}});
  assert.equal(r.eligible,true);
  assert.equal(r.localSandboxMutationAllowed,false);
  assert.equal(r.filesystemMutationAllowed,false);
  assert.equal(r.runtimeActivationAllowed,false);
});
