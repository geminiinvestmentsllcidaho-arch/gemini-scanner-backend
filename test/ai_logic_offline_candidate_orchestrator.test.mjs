import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAiLogicOfflineCandidateOrchestrator as run } from "../src/scanner/ai_logic_offline_candidate_orchestrator.mjs";

const manifest=Object.freeze({ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"});
const base=()=>({
  candidateId:"a57g-1",topic:"classification_coverage",explicitFixtureOrInMemoryOnly:true,
  mutationIntents:["classification_coverage"],
  files:[{path:"src/scanner/ai_logic_candidates/a57g.mjs",content:"export function evaluateCandidate(x){ return x?.ok === true ? 'OK' : 'NO'; }\n"}],
  samples:[{sampleId:"s1",input:{ok:true},expected:"OK"}],
  baselineEvaluator:()=>"NO",
});

test("writes binds and replays isolated candidate with authority closed",async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"a57g-"));
  const r=await run(base(),{rootDir:root,manifestResult:manifest});
  assert.equal(r.eligible,false);
  assert.equal(r.stage,"CANDIDATE_EXECUTION_DISABLED");
  assert.ok(r.reasons.includes("CANDIDATE_SOURCE_EXECUTION_REQUIRES_ISOLATED_RUNNER"));
  assert.equal(r.binding.sourceExecutionAllowed,false);
  assert.equal(r.binding.dynamicImportAllowed,false);
  for(const k of ["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed",
    "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
    "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
    "allocationMutationAllowed","gitMutationAllowed"]) assert.equal(r[k],false,k);
});

test("fails closed before replay when sandbox mutation is forbidden",async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"a57g-"));
  let calls=0;
  const r=await run({...base(),mutationIntents:["position_sizing"],baselineEvaluator:()=>{calls++;return "NO";}},
    {rootDir:root,manifestResult:manifest});
  assert.equal(r.eligible,false);
  assert.equal(r.stage,"SANDBOX_WRITE");
  assert.equal(calls,0);
  assert.equal(fs.existsSync(path.join(root,"src/scanner/ai_logic_candidates/a57g.mjs")),false);
});
