import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAiLogicAcceptanceEvidenceBinding } from "../src/scanner/ai_logic_acceptance_evidence_binding.mjs";

const replay = {
  candidateId: "candidate-001",
  status: "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE",
  disposition: "OFFLINE_EVIDENCE_ONLY",
  immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
  replayId: "replay-001",
  baselineHash: "basehash",
  candidateHash: "candhash",
  sampleCount: 4,
  baselineMetrics: { accuracy: 0.75 },
  candidateMetrics: { accuracy: 1, accuracyDelta: 0.25, changedCount: 1 },
};
const base = {
  knownGood: {
    valid: true,
    status: "KNOWN_GOOD_RECORD_VALID",
    rollbackTargetIdentified: true,
    immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
    sourceCommit: "a".repeat(40),
    versionId: "known-good-001",
    logicScope: "decision_quality_classification",
    rollbackExecutable: false,
    promotionEligible: false,
    recordId: "kg-001",
  },
  experiment: {
    sourceCommitBefore: "a".repeat(40),
    sourceCommitAfter: "b".repeat(40),
    immutablePolicyCompatibility: { ok: true, status: "IMMUTABLE_MANIFEST_VERIFIED" },
    baselineMetrics: { accuracy: 0.75 },
    candidateMetrics: { accuracy: 1, accuracyDelta: 0.25, changedCount: 1 },
    sampleInfo: { count: 4 },
  },
  safetyGate: {
    candidateId: "candidate-001",
    eligible: true,
    status: "AI_LOGIC_CANDIDATE_SAFETY_GATE_ELIGIBLE",
    disposition: "OFFLINE_EVIDENCE_ONLY",
    replay,
  },
  acceptance: {
    eligible: true,
    status: "AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_EVIDENCE",
    disposition: "OFFLINE_ACCEPTANCE_EVIDENCE_ONLY",
    comparison: {
      sampleCount: 4,
      baselineAccuracy: 0.75,
      candidateAccuracy: 1,
      accuracyDelta: 0.25,
      changedCount: 1,
    },
  },
};

test("binds exact known-good replay experiment and acceptance evidence with all mutation locks closed", () => {
  const r = evaluateAiLogicAcceptanceEvidenceBinding(base);
  assert.equal(r.eligible, true);
  assert.equal(r.status, "AI_LOGIC_ACCEPTANCE_EVIDENCE_BINDING_VALID");
  assert.equal(r.disposition, "OFFLINE_ACCEPTANCE_BINDING_EVIDENCE_ONLY");
  for (const key of [
    "persistenceAllowed","promotionAllowed","rollbackExecutionAllowed","productionRuntimeWiringAllowed",
    "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
    "immutablePolicyMutationAllowed",
  ]) assert.equal(r[key], false);
});

test("fails closed on candidate identity mismatch", () => {
  const r = evaluateAiLogicAcceptanceEvidenceBinding({
    ...base,
    safetyGate: { ...base.safetyGate, candidateId: "other-candidate" },
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("CANDIDATE_ID_BINDING_MISMATCH"));
});

test("fails closed on known-good source commit mismatch", () => {
  const r = evaluateAiLogicAcceptanceEvidenceBinding({
    ...base,
    experiment: { ...base.experiment, sourceCommitBefore: "c".repeat(40) },
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH"));
});

test("fails closed on replay metric binding mismatch", () => {
  const r = evaluateAiLogicAcceptanceEvidenceBinding({
    ...base,
    experiment: { ...base.experiment, candidateMetrics: { ...base.experiment.candidateMetrics, accuracy: 0.99 } },
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("CANDIDATE_METRICS_BINDING_MISMATCH"));
});

test("fails closed when replay or acceptance is not eligible evidence", () => {
  const r = evaluateAiLogicAcceptanceEvidenceBinding({
    ...base,
    acceptance: { ...base.acceptance, eligible: false },
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("ACCEPTANCE_NOT_ELIGIBLE"));
});
