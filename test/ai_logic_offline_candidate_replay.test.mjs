import assert from "node:assert/strict";
import test from "node:test";

import { runAiLogicOfflineCandidateReplay } from "../src/scanner/ai_logic_offline_candidate_replay.mjs";

const common = {
  candidateId: "candidate-001",
  topic: "classification_coverage",
  changedPaths: [
    "src/scanner/ai_logic_candidates/classification_coverage_v1.mjs",
    "test/ai_logic_candidates/classification_coverage_v1.test.mjs",
  ],
  mutationIntents: ["classification_coverage"],
  sourceText: `
    export function classifyEvidence(input) {
      return input.confirmed ? "CONFIRMED" : "UNCONFIRMED";
    }
  `,
  samples: [
    { sampleId: "a", input: { confirmed: true }, expected: "CONFIRMED" },
    { sampleId: "b", input: { confirmed: false }, expected: "UNCONFIRMED" },
  ],
};

test("runs deterministic offline baseline versus candidate replay with every mutation lock closed", () => {
  const input = {
    ...common,
    baselineEvaluator: (value) => value.confirmed ? "CONFIRMED" : "UNKNOWN",
    candidateEvaluator: (value) => value.confirmed ? "CONFIRMED" : "UNCONFIRMED",
  };

  const first = runAiLogicOfflineCandidateReplay(input);
  const second = runAiLogicOfflineCandidateReplay(input);

  assert.equal(first.eligible, true);
  assert.equal(first.status, "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE");
  assert.equal(first.baselineMetrics.accuracy, 0.5);
  assert.equal(first.candidateMetrics.accuracy, 1);
  assert.equal(first.candidateMetrics.accuracyDelta, 0.5);
  assert.equal(first.candidateMetrics.changedCount, 1);
  assert.equal(first.replayId, second.replayId);
  assert.equal(first.baselineHash, second.baselineHash);
  assert.equal(first.candidateHash, second.candidateHash);
  assert.equal(first.productionRuntimeWiringAllowed, false);
  assert.equal(first.persistenceAllowed, false);
  assert.equal(first.promotionAllowed, false);
  assert.equal(first.rollbackExecutionAllowed, false);
  assert.equal(first.brokerContactAllowed, false);
  assert.equal(first.orderPlacementAllowed, false);
  assert.equal(first.liveTradingAllowed, false);
  assert.equal(first.accountMutationAllowed, false);
  assert.equal(first.immutablePolicyMutationAllowed, false);
  assert.equal(first.thresholdMutationAllowed, false);
  assert.equal(first.sizingMutationAllowed, false);
  assert.equal(first.allocationMutationAllowed, false);
});

test("fails closed when candidate diff escapes sandbox", () => {
  const result = runAiLogicOfflineCandidateReplay({
    ...common,
    changedPaths: ["src/server.js"],
    baselineEvaluator: () => "A",
    candidateEvaluator: () => "A",
  });

  assert.equal(result.eligible, false);
  assert.equal(result.status, "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_REJECT");
  assert.ok(result.reasons.some((reason) => reason.includes("FORBIDDEN_PATH:src/server.js")));
});

test("fails closed when semantics attempt immutable policy mutation", () => {
  const result = runAiLogicOfflineCandidateReplay({
    ...common,
    mutationIntents: ["position_sizing"],
    baselineEvaluator: () => "A",
    candidateEvaluator: () => "A",
  });

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("SEMANTIC:FORBIDDEN_MUTATION_INTENT:position_sizing"));
});

test("fails closed without explicit fixture samples and evaluators", () => {
  const result = runAiLogicOfflineCandidateReplay({
    candidateId: "candidate-002",
    topic: "classification_coverage",
    changedPaths: ["src/scanner/ai_logic_candidates/x.mjs"],
    mutationIntents: ["classification_coverage"],
  });

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("REPLAY_SAMPLES_REQUIRED"));
  assert.ok(result.reasons.includes("BASELINE_EVALUATOR_REQUIRED"));
  assert.ok(result.reasons.includes("CANDIDATE_EVALUATOR_REQUIRED"));
});

test("normalizes object key ordering for deterministic hashes", () => {
  const result = runAiLogicOfflineCandidateReplay({
    ...common,
    samples: [
      { sampleId: "one", input: { b: 2, a: 1 }, expected: { y: 2, x: 1 } },
    ],
    baselineEvaluator: () => ({ x: 1, y: 2 }),
    candidateEvaluator: () => ({ y: 2, x: 1 }),
  });

  assert.equal(result.eligible, true);
  assert.equal(result.baselineMetrics.accuracy, 1);
  assert.equal(result.candidateMetrics.accuracy, 1);
  assert.equal(result.candidateMetrics.changedCount, 0);
  assert.equal(result.baselineHash, result.candidateHash);
});
