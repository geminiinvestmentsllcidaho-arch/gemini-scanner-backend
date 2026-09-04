import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicPreShadowAcceptanceEvidenceBinding as bind } from "../src/scanner/ai_logic_pre_shadow_acceptance_evidence_binding.mjs";

function fixture() {
  const replay = {
    status:"AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE",
    disposition:"OFFLINE_EVIDENCE_ONLY",
    replayId:"replay-1",
    candidateId:"candidate-1",
    baselineHash:"baseline-hash",
    candidateHash:"candidate-hash",
    immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",
    baselineMetrics:{accuracy:0.8},
    candidateMetrics:{accuracy:0.9,accuracyDelta:0.1,changedCount:2},
    sampleCount:10
  };
  const safetyGate = {
    eligible:true,
    status:"AI_LOGIC_CANDIDATE_SAFETY_GATE_ELIGIBLE_FOR_OFFLINE_EVIDENCE_ONLY",
    disposition:"OFFLINE_EVIDENCE_ONLY",
    candidateId:"candidate-1",
    replay
  };
  return {
    knownGood:{
      valid:true,
      status:"KNOWN_GOOD_RECORD_VALID",
      rollbackTargetIdentified:true,
      immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",
      recordId:"known-good-1",
      sourceCommit:"commit-before",
      versionId:"v1",
      logicScope:"scanner_logic",
      rollbackExecutable:false,
      promotionEligible:false
    },
    orchestrator:{
      eligible:true,
      status:"AI_LOGIC_OFFLINE_CANDIDATE_ORCHESTRATION_COMPLETE",
      disposition:"OFFLINE_EVIDENCE_ONLY",
      candidateId:"candidate-1",
      sourceHash:"source-hash-1",
      safety:structuredClone(safetyGate)
    },
    safetyGate,
    acceptance:{
      eligible:true,
      status:"AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_EVIDENCE",
      disposition:"OFFLINE_ACCEPTANCE_EVIDENCE_ONLY",
      comparison:{
        sampleCount:10,
        baselineAccuracy:0.8,
        candidateAccuracy:0.9,
        accuracyDelta:0.1,
        changedCount:2
      }
    },
    candidateSourceHash:"source-hash-1",
    sourceCommitAfter:"commit-after"
  };
}

test("binds genuine pre-shadow acceptance without experiment or shadow results", () => {
  const input = fixture();
  const out = bind(input);
  assert.equal(out.eligible, true);
  assert.equal(out.status, "AI_LOGIC_PRE_SHADOW_ACCEPTANCE_EVIDENCE_BINDING_VALID");
  assert.equal(out.disposition, "OFFLINE_PRE_SHADOW_ACCEPTANCE_BINDING_EVIDENCE_ONLY");
  assert.deepEqual(out.binding, {
    knownGoodRecordId:"known-good-1",
    candidateId:"candidate-1",
    candidateSourceHash:"source-hash-1",
    replayId:"replay-1",
    sourceCommitBefore:"commit-before",
    sourceCommitAfter:"commit-after"
  });
  assert.deepEqual(out.replayEvidence, {
    baselineMetrics:{accuracy:0.8},
    candidateMetrics:{accuracy:0.9,accuracyDelta:0.1,changedCount:2},
    sampleCount:10
  });
  assert.equal(out.productionRuntimeWiringAllowed, false);
  assert.equal(out.brokerContactAllowed, false);
  assert.equal(out.orderPlacementAllowed, false);
  assert.equal(out.liveTradingAllowed, false);
  assert.equal(out.immutablePolicyMutationAllowed, false);
  assert.equal(out.gitMutationAllowed, false);
});

test("fails closed on source hash replay or candidate provenance drift", () => {
  for (const mutate of [
    x => { x.candidateSourceHash="wrong"; },
    x => { x.orchestrator.safety.replay.replayId="wrong"; },
    x => { x.orchestrator.candidateId="wrong"; }
  ]) {
    const input = fixture();
    mutate(input);
    const out = bind(input);
    assert.equal(out.eligible, false);
    assert.equal(out.disposition, "REJECT_OR_HOLD");
  }
});

test("fails closed when acceptance comparison differs from replay evidence", () => {
  const fields = [
    ["sampleCount",11],
    ["baselineAccuracy",0.7],
    ["candidateAccuracy",0.8],
    ["accuracyDelta",0.0],
    ["changedCount",3]
  ];
  for (const [field,value] of fields) {
    const input = fixture();
    input.acceptance.comparison[field]=value;
    const out = bind(input);
    assert.equal(out.eligible, false);
    assert.ok(out.reasons.includes("ACCEPTANCE_REPLAY_COMPARISON_MISMATCH"));
  }
});

test("rejects post-shadow experiment or shadow results input", () => {
  for (const field of ["experiment","shadowResults"]) {
    const input = fixture();
    input[field]={fabricated:true};
    const out = bind(input);
    assert.equal(out.eligible, false);
    assert.ok(out.reasons.includes("POST_SHADOW_INPUT_FORBIDDEN"));
  }
});

test("fails closed on immutable or authority drift", () => {
  const a = fixture();
  a.knownGood.immutableManifestStatus="BROKEN";
  assert.equal(bind(a).eligible,false);

  const b = fixture();
  b.safetyGate.eligible=false;
  assert.equal(bind(b).eligible,false);

  const c = fixture();
  c.acceptance.eligible=false;
  assert.equal(bind(c).eligible,false);
});
