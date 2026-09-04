import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicProbationEligibility } from "../src/scanner/ai_logic_probation_eligibility_gate.mjs";

const locks = {
  productionRuntimeWiringAllowed: false,
  persistenceAllowed: false,
  promotionAllowed: false,
  rollbackExecutionAllowed: false,
  brokerContactAllowed: false,
  orderPlacementAllowed: false,
  liveTradingAllowed: false,
  accountMutationAllowed: false,
  immutablePolicyMutationAllowed: false,
  thresholdMutationAllowed: false,
  sizingMutationAllowed: false,
  allocationMutationAllowed: false,
};

function validInput() {
  return {
    acceptanceEvidence: {
      version: "ai_logic_acceptance_evidence_store_v1",
      recordId: "acceptance-001",
      candidateId: "candidate-001",
      knownGoodRecordId: "known-good-001",
      replayId: "replay-001",
      sourceCommitBefore: "a".repeat(40),
      sourceCommitAfter: "b".repeat(40),
      candidateSourceHash: "c".repeat(64),
      immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
      ...locks,
    },
    knownGood: {
      valid: true,
      status: "KNOWN_GOOD_RECORD_VALID",
      recordId: "known-good-001",
      sourceCommit: "a".repeat(40),
      rollbackTargetIdentified: true,
      immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
      rollbackExecutionAllowed: false,
      promotionAllowed: false,
      productionRuntimeWiringAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      accountMutationAllowed: false,
    },
    probationEvidence: {
      status: "SHADOW_PROBATION_EVIDENCE_COMPLETE",
      sampleCount: 10,
      candidateId: "candidate-001",
      candidateSourceHash: "c".repeat(64),
      knownGoodRecordId: "known-good-001",
      immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
      ...locks,
    },
  };
}

test("permits probation eligibility evidence only with every mutation lock closed", () => {
  const r = evaluateAiLogicProbationEligibility(validInput());
  assert.equal(r.eligible, true);
  assert.equal(r.status, "AI_LOGIC_PROBATION_ELIGIBILITY_EVIDENCE");
  assert.equal(r.disposition, "PROBATION_ELIGIBILITY_EVIDENCE_ONLY");
  assert.equal(r.binding.candidateId, "candidate-001");
  assert.equal(r.binding.knownGoodRecordId, "known-good-001");
  assert.equal(r.probationEvidence.sampleCount, 10);
  for (const [key, value] of Object.entries(locks)) assert.equal(r[key], value);
});

test("fails closed on known-good or probation identity mismatch", () => {
  const a = validInput();
  a.knownGood.recordId = "known-good-other";
  const r1 = evaluateAiLogicProbationEligibility(a);
  assert.equal(r1.eligible, false);
  assert.ok(r1.reasons.includes("KNOWN_GOOD_RECORD_BINDING_MISMATCH"));

  const b = validInput();
  b.probationEvidence.candidateId = "candidate-other";
  const r2 = evaluateAiLogicProbationEligibility(b);
  assert.equal(r2.eligible, false);
  assert.ok(r2.reasons.includes("PROBATION_CANDIDATE_BINDING_MISMATCH"));
});

test("fails closed if any forbidden permission is open", () => {
  const input = validInput();
  input.probationEvidence.orderPlacementAllowed = true;
  const r = evaluateAiLogicProbationEligibility(input);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((reason) => reason.includes("ORDERPLACEMENTALLOWED")));
  assert.equal(r.orderPlacementAllowed, false);
});

test("fails closed for incomplete probation evidence", () => {
  const input = validInput();
  input.probationEvidence.status = "NOT_COMPLETE";
  input.probationEvidence.sampleCount = 0;
  const r = evaluateAiLogicProbationEligibility(input);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes("PROBATION_EVIDENCE_NOT_COMPLETE"));
  assert.ok(r.reasons.includes("PROBATION_SAMPLE_COUNT_REQUIRED"));
});

test("candidate source hash provenance is required and exact", () => {
  const a = validInput();
  a.acceptanceEvidence.candidateSourceHash = "";
  assert.equal(evaluateAiLogicProbationEligibility(a).eligible, false);
  const b = validInput();
  b.probationEvidence.candidateSourceHash = "d".repeat(64);
  assert.equal(evaluateAiLogicProbationEligibility(b).eligible, false);
  const c = evaluateAiLogicProbationEligibility(validInput());
  assert.equal(c.binding.candidateSourceHash, "c".repeat(64));
});
