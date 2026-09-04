import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicPreShadowAcceptanceEvidenceBinding as bind } from "../src/scanner/ai_logic_pre_shadow_acceptance_evidence_binding.mjs";
import { buildAiLogicPreShadowExperimentEvidence as build } from "../src/scanner/ai_logic_pre_shadow_experiment_evidence.mjs";
import { evaluateAiLogicShadowEntryBinding as enter } from "../src/scanner/ai_logic_shadow_entry_binding.mjs";

function fixture() {
  const replay={status:"AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE",disposition:"OFFLINE_EVIDENCE_ONLY",replayId:"replay-1",candidateId:"cand-1",baselineHash:"base",candidateHash:"cand",immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",baselineMetrics:{accuracy:.8},candidateMetrics:{accuracy:.9,accuracyDelta:.1,changedCount:2},sampleCount:10};
  const safety={eligible:true,status:"AI_LOGIC_CANDIDATE_SAFETY_GATE_ELIGIBLE_FOR_OFFLINE_EVIDENCE_ONLY",disposition:"OFFLINE_EVIDENCE_ONLY",candidateId:"cand-1",replay};
  const knownGood={valid:true,status:"KNOWN_GOOD_RECORD_VALID",rollbackTargetIdentified:true,immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",recordId:"kg-1",sourceCommit:"a".repeat(40),versionId:"v1",logicScope:"scanner_logic",rollbackExecutable:false,promotionEligible:false};
  const orchestrator={eligible:true,status:"AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE",disposition:"OFFLINE_EVIDENCE_ONLY",candidateId:"cand-1",sourceHash:"c".repeat(64),safety:structuredClone(safety)};
  const acceptance={eligible:true,status:"AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_EVIDENCE",disposition:"OFFLINE_ACCEPTANCE_EVIDENCE_ONLY",comparison:{sampleCount:10,baselineAccuracy:.8,candidateAccuracy:.9,accuracyDelta:.1,changedCount:2}};
  return {knownGood,orchestrator,safetyGate:safety,acceptance,candidateSourceHash:"c".repeat(64),sourceCommitAfter:"b".repeat(40)};
}

test("genuine offline acceptance flows into pre-shadow evidence and shadow-entry evidence without post-shadow data",()=>{
  const input=fixture();
  const acceptanceBinding=bind(input);
  assert.equal(acceptanceBinding.eligible,true);
  const pre=build({knownGood:input.knownGood,orchestrator:input.orchestrator,acceptanceBinding});
  assert.equal(pre.valid,true);
  assert.equal(pre.shadowResultsAllowed,false);
  assert.equal(pre.shadowComplete,false);
  const entry=enter({preShadowEvidence:pre,acceptanceEvidence:acceptanceBinding});
  assert.equal(entry.eligible,true);
  assert.deepEqual(entry.binding,acceptanceBinding.binding);
  for(const x of [acceptanceBinding,pre,entry]) for(const [k,v] of Object.entries(x)) if(k.endsWith("Allowed")) assert.equal(v,false);
});

test("chain fails closed on cross-stage source-hash drift",()=>{
  const input=fixture();
  const acceptanceBinding=bind(input);
  const pre=build({knownGood:input.knownGood,orchestrator:input.orchestrator,acceptanceBinding});
  const drift={...acceptanceBinding,binding:{...acceptanceBinding.binding,candidateSourceHash:"d".repeat(64)}};
  assert.equal(enter({preShadowEvidence:pre,acceptanceEvidence:drift}).eligible,false);
});
