import assert from "node:assert/strict";
import test from "node:test";
import { buildAiLogicExperimentRecord } from "../src/scanner/ai_logic_experiment_record.mjs";

const now = new Date("2026-09-02T08:50:00.000Z");
const base = {
  hypothesisId: "hyp-001",
  affectedSubsystem: "decision_quality_classification",
  detectedProblem: "False-positive classification lacks contextual evidence separation.",
  evidence: [{ source: "fixture", count: 25 }],
  priority: 4,
  confidence: 0.82,
  proposedLogicDelta: "Refine evidence interpretation without changing thresholds.",
  immutablePolicyCompatibility: { ok: true, status: "IMMUTABLE_MANIFEST_VERIFIED" },
  baselineMetrics: { falsePositiveCount: 7 },
  candidateMetrics: { falsePositiveCount: 5 },
  sampleInfo: { count: 25 },
  regressionResults: { passed: true },
  shadowResults: { status: "NOT_RUN" },
  disposition: "HOLD",
  reason: "Awaiting deterministic replay",
  sourceCommitBefore: "a".repeat(40),
  sourceCommitAfter: "b".repeat(40),
};

test("builds deterministic valid offline experiment record", () => {
  const first = buildAiLogicExperimentRecord(base, { now });
  const second = buildAiLogicExperimentRecord(base, { now });
  assert.equal(first.valid, true);
  assert.equal(first.experimentId, second.experimentId);
  assert.equal(first.promotionEligible, false);
  assert.equal(first.rollbackExecutable, false);
  assert.equal(first.productionRuntimeWiringAllowed, false);
  assert.equal(first.scannerLogicMutationAllowed, false);
  assert.equal(first.thresholdMutationAllowed, false);
  assert.equal(first.orderPlacementAllowed, false);
  assert.equal(first.accountMutationAllowed, false);
});

test("fails closed to HOLD on missing required field", () => {
  const record = buildAiLogicExperimentRecord({ ...base, proposedLogicDelta: "" }, { now });
  assert.equal(record.valid, false);
  assert.equal(record.disposition, "HOLD");
  assert.ok(record.missingRequiredFields.includes("proposedLogicDelta"));
  assert.equal(record.promotionEligible, false);
});

test("fails closed when immutable compatibility is not verified", () => {
  const record = buildAiLogicExperimentRecord({
    ...base,
    immutablePolicyCompatibility: { ok: false, status: "IMMUTABLE_MANIFEST_REJECT" },
  }, { now });
  assert.equal(record.valid, false);
  assert.ok(record.missingRequiredFields.includes("immutablePolicyCompatibility.ok"));
  assert.equal(record.disposition, "HOLD");
});
