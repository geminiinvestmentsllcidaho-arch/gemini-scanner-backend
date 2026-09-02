import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicCandidateSafetyGate } from "../src/scanner/ai_logic_candidate_safety_gate.mjs";

const base = {
  candidateId: "candidate-gate-001",
  topic: "evidence_interpretation",
  explicitFixtureOrInMemoryOnly: true,
  changedPaths: ["src/scanner/ai_logic_candidates/evidence_v1.mjs"],
  mutationIntents: ["evidence_interpretation"],
  sourceText: "classify bounded evidence only",
  samples: [{ sampleId: "one", input: { x: 1 }, expected: "OK" }],
  baselineEvaluator: () => "OK",
  candidateEvaluator: () => "OK",
};

test("combined gate permits offline evidence only with all mutation locks closed", () => {
  const r = evaluateAiLogicCandidateSafetyGate(base);
  assert.equal(r.eligible, true);
  assert.equal(r.disposition, "OFFLINE_EVIDENCE_ONLY");
  assert.equal(r.gates.immutableManifest, "IMMUTABLE_MANIFEST_VERIFIED");
  assert.equal(r.gates.offlineReplay, "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE");
  for (const k of [
    "productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
    "rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed",
    "liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed",
    "thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed"
  ]) assert.equal(r[k], false, k);
});

test("combined gate fails closed for forbidden production path", () => {
  const r = evaluateAiLogicCandidateSafetyGate({ ...base, changedPaths: ["src/server.js"] });
  assert.equal(r.eligible, false);
  assert.equal(r.disposition, "REJECT_OR_HOLD");
  assert.ok(r.reasons.length > 0);
  assert.equal(r.productionRuntimeWiringAllowed, false);
  assert.equal(r.promotionAllowed, false);
});

test("combined gate fails closed for immutable mutation intent", () => {
  const r = evaluateAiLogicCandidateSafetyGate({ ...base, mutationIntents: ["position_sizing"] });
  assert.equal(r.eligible, false);
  assert.equal(r.immutablePolicyMutationAllowed, false);
  assert.equal(r.sizingMutationAllowed, false);
});

test("combined gate does not invoke evaluators when offline experiment contract rejects", () => {
  let baselineCalls = 0;
  let candidateCalls = 0;

  const result = evaluateAiLogicCandidateSafetyGate({
    candidateId: "candidate-experiment-reject",
    topic: "classification_coverage",
    explicitFixtureOrInMemoryOnly: false,
    changedPaths: ["src/scanner/ai_logic_candidates/candidate-experiment-reject.mjs"],
    mutationIntents: ["classification_coverage"],
    sourceText: 'export const classify = (x) => x;',
    samples: [{ sampleId: "s1", input: { x: 1 }, expected: 1 }],
    baselineEvaluator: () => {
      baselineCalls += 1;
      return 1;
    },
    candidateEvaluator: () => {
      candidateCalls += 1;
      return 1;
    },
  });

  assert.equal(result.eligible, false);
  assert.equal(result.gates.offlineReplay, "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_SKIPPED_PRECHECK");
  assert.equal(baselineCalls, 0);
  assert.equal(candidateCalls, 0);
  assert.ok(result.reasons.some((reason) => reason.startsWith("EXPERIMENT:")));
});
