import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicOfflineCandidateAcceptanceBridge as bridge } from "../src/scanner/ai_logic_offline_candidate_acceptance_bridge.mjs";

const replay={
  candidateId:"c1",status:"AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE",disposition:"OFFLINE_EVIDENCE_ONLY",
  immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",replayId:"r1",baselineHash:"bh",candidateHash:"ch",
  sampleCount:2,baselineMetrics:{sampleCount:2,correctCount:1,accuracy:.5},
  candidateMetrics:{sampleCount:2,correctCount:2,accuracy:1,changedCount:1,accuracyDelta:.5}
};
const safety={
  candidateId:"c1",eligible:true,status:"AI_LOGIC_CANDIDATE_SAFETY_GATE_ELIGIBLE_FOR_OFFLINE_EVIDENCE_ONLY",
  disposition:"OFFLINE_EVIDENCE_ONLY",replay
};
const orchestrator={
  eligible:true,status:"AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE",disposition:"OFFLINE_EVIDENCE_ONLY",
  candidateId:"c1",sourceHash:"sh1",safety
};
const knownGood={
  valid:true,status:"KNOWN_GOOD_RECORD_VALID",rollbackTargetIdentified:true,
  immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",sourceCommit:"before",versionId:"kgv1",
  logicScope:"classification_coverage",rollbackExecutable:false,promotionEligible:false,recordId:"kg1"
};
const experiment={
  sourceCommitBefore:"before",sourceCommitAfter:"after",
  immutablePolicyCompatibility:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"},
  baselineMetrics:replay.baselineMetrics,candidateMetrics:replay.candidateMetrics,sampleInfo:{count:2}
};

test("bridges isolated orchestration replay into acceptance binding evidence only",()=>{
  const r=bridge({orchestrator,knownGood,experiment,candidateSourceHash:"sh1",replayId:"r1"});
  assert.equal(r.eligible,true);
  assert.equal(r.status,"AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_BRIDGE_READY");
  assert.equal(r.candidateSourceHash,"sh1");
  assert.equal(r.acceptance.eligible,true);
  assert.equal(r.binding.eligible,true);
  assert.equal(r.binding.binding.candidateSourceHash,"sh1");
  for(const k of ["persistenceAllowed","promotionAllowed","rollbackExecutionAllowed",
    "productionRuntimeWiringAllowed","brokerContactAllowed","orderPlacementAllowed",
    "liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed",
    "thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed"]) assert.equal(r[k],false,k);
});

test("fails closed on source hash or replay binding drift",()=>{
  const r=bridge({
    orchestrator:{...orchestrator,safety:{...safety,replay:{...replay,replayId:"other"}}},
    knownGood,experiment,candidateSourceHash:"sh1",replayId:"r1"
  });
  assert.equal(r.eligible,false);
  assert.equal(r.stage,"IDENTITY_BINDING");
  assert.ok(r.reasons.includes("REPLAY_ID_BINDING_MISMATCH"));
});

test("fails closed before acceptance when orchestration is not eligible",()=>{
  const r=bridge({orchestrator:{...orchestrator,eligible:false},knownGood,experiment});
  assert.equal(r.eligible,false);
  assert.equal(r.stage,"ORCHESTRATOR");
});
