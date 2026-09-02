import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAiLogicOfflineCandidateAcceptance } from "../src/scanner/ai_logic_offline_candidate_acceptance_gate.mjs";

const base = {
  eligible: true,
  disposition: "OFFLINE_EVIDENCE_ONLY",
  replay: {
    sampleCount: 4,
    baselineMetrics: { accuracy: 0.75 },
    candidateMetrics: { accuracy: 1, accuracyDelta: 0.25, changedCount: 1 },
  },
};

test("accepts non-regressing offline candidate evidence with every mutation lock closed", () => {
  const r = evaluateAiLogicOfflineCandidateAcceptance(base);
  assert.equal(r.eligible, true);
  assert.equal(r.status, "AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_EVIDENCE");
  assert.equal(r.disposition, "OFFLINE_ACCEPTANCE_EVIDENCE_ONLY");
  assert.equal(r.comparison.candidateAtLeastBaseline, true);
  assert.equal(r.comparison.nonnegativeAccuracyDelta, true);
  for (const key of [
    "productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
    "rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed",
    "liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed",
    "thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed",
  ]) assert.equal(r[key], false);
});

test("allows exact baseline parity without inventing minimum improvement", () => {
  const r = evaluateAiLogicOfflineCandidateAcceptance({
    ...base,
    replay: {
      ...base.replay,
      candidateMetrics: { accuracy: 0.75, accuracyDelta: 0, changedCount: 0 },
    },
  });
  assert.equal(r.eligible, true);
});

test("holds a candidate that underperforms baseline", () => {
  const r = evaluateAiLogicOfflineCandidateAcceptance({
    ...base,
    replay: {
      ...base.replay,
      candidateMetrics: { accuracy: 0.5, accuracyDelta: -0.25, changedCount: 1 },
    },
  });
  assert.equal(r.eligible, false);
  assert.equal(r.status, "AI_LOGIC_OFFLINE_CANDIDATE_ACCEPTANCE_HOLD");
  assert.ok(r.reasons.includes("CANDIDATE_UNDERPERFORMS_BASELINE"));
});

test("fails closed for missing replay evidence or nonfinite metrics", () => {
  const r = evaluateAiLogicOfflineCandidateAcceptance({
    eligible: true,
    disposition: "OFFLINE_EVIDENCE_ONLY",
    replay: {
      sampleCount: 0,
      baselineMetrics: { accuracy: Number.NaN },
      candidateMetrics: { accuracy: 1, accuracyDelta: Number.POSITIVE_INFINITY, changedCount: -1 },
    },
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("REPLAY_EVIDENCE_REQUIRED"));
  assert.ok(r.reasons.includes("BASELINE_ACCURACY_REQUIRED"));
  assert.ok(r.reasons.includes("ACCURACY_DELTA_REQUIRED"));
  assert.ok(r.reasons.includes("CHANGED_COUNT_INVALID"));
});

test("fails closed when combined safety gate is not eligible", () => {
  const r = evaluateAiLogicOfflineCandidateAcceptance({ ...base, eligible: false });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("SAFETY_GATE_NOT_ELIGIBLE"));
});
