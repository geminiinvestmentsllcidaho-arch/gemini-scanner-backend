import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLogicShadowProbationEvidence } from "../src/scanner/ai_logic_shadow_probation_evidence.mjs";

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
      immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
      ...locks,
    },
    shadowEntryEvidence: {
      version: "ai_logic_shadow_entry_binding_v1",
      eligible: true,
      status: "AI_LOGIC_SHADOW_ENTRY_BINDING_VALID",
      disposition: "SHADOW_ENTRY_EVIDENCE_ONLY",
      binding: {
        candidateId: "candidate-001",
        knownGoodRecordId: "known-good-001",
        replayId: "replay-001",
        sourceCommitBefore: "a".repeat(40),
        sourceCommitAfter: "b".repeat(40),
        candidateSourceHash: "c".repeat(64),
      },
      ...locks,
    },
    observations: [
      { sampleId: "s1", baseline: "WAIT", candidate: "ENTER", changed: true },
      { sampleId: "s2", baseline: "WAIT", candidate: "WAIT", changed: false },
    ],
  };
}

test("builds complete shadow probation evidence with all mutation locks closed", () => {
  const r = buildAiLogicShadowProbationEvidence(validInput());
  assert.equal(r.complete, true);
  assert.equal(r.status, "SHADOW_PROBATION_EVIDENCE_COMPLETE");
  assert.equal(r.disposition, "SHADOW_PROBATION_EVIDENCE_ONLY");
  assert.equal(r.sampleCount, 2);
  assert.equal(r.candidateId, "candidate-001");
  assert.equal(r.knownGoodRecordId, "known-good-001");
  for (const [key, value] of Object.entries(locks)) assert.equal(r[key], value);
})

test("fails closed for missing observations and identity binding mismatch", () => {
  const missing = validInput();
  missing.observations = [];
  const r1 = buildAiLogicShadowProbationEvidence(missing);
  assert.equal(r1.complete, false);
  assert.ok(r1.reasons.includes("PROBATION_OBSERVATIONS_REQUIRED"));

  const mismatch = validInput();
  mismatch.knownGood.recordId = "known-good-other";
  const r2 = buildAiLogicShadowProbationEvidence(mismatch);
  assert.equal(r2.complete, false);
  assert.ok(r2.reasons.includes("KNOWN_GOOD_RECORD_BINDING_MISMATCH"));
});

test("fails closed for source commit mismatch and forbidden permission", () => {
  const commitMismatch = validInput();
  commitMismatch.knownGood.sourceCommit = "c".repeat(40);
  const r1 = buildAiLogicShadowProbationEvidence(commitMismatch);
  assert.equal(r1.complete, false);
  assert.ok(r1.reasons.includes("KNOWN_GOOD_SOURCE_COMMIT_BINDING_MISMATCH"));

  const forbidden = validInput();
  forbidden.orderPlacementAllowed = true;
  const r2 = buildAiLogicShadowProbationEvidence(forbidden);
  assert.equal(r2.complete, false);
  assert.ok(r2.reasons.some((reason) => reason.includes("ORDERPLACEMENTALLOWED")));
  assert.equal(r2.orderPlacementAllowed, false);
});

test("fails closed for incomplete acceptance identity and invalid immutable status", () => {
  const input = validInput();
  input.acceptanceEvidence.replayId = "";
  input.acceptanceEvidence.immutableManifestStatus = "INVALID";
  const r = buildAiLogicShadowProbationEvidence(input);
  assert.equal(r.complete, false);
  assert.ok(r.reasons.includes("REPLAY_ID_REQUIRED"));
  assert.ok(r.reasons.includes("ACCEPTANCE_IMMUTABLE_MANIFEST_INVALID"));
});

test("candidate source hash provenance is required and preserved", () => {
  const a = validInput();
  a.acceptanceEvidence.candidateSourceHash = "";
  assert.equal(buildAiLogicShadowProbationEvidence(a).complete, false);
  const b = buildAiLogicShadowProbationEvidence(validInput());
  assert.equal(b.candidateSourceHash, "c".repeat(64));
});


test("fails closed without valid shadow-entry evidence or on shadow-entry provenance drift", () => {
  const missing = validInput();
  delete missing.shadowEntryEvidence;
  const r1 = buildAiLogicShadowProbationEvidence(missing);
  assert.equal(r1.complete, false);
  assert.ok(r1.reasons.includes("SHADOW_ENTRY_EVIDENCE_INVALID"));

  const drift = validInput();
  drift.shadowEntryEvidence.binding.candidateSourceHash = "d".repeat(64);
  const r2 = buildAiLogicShadowProbationEvidence(drift);
  assert.equal(r2.complete, false);
  assert.ok(r2.reasons.includes("SHADOW_ENTRY_CANDIDATESOURCEHASH_BINDING_MISMATCH"));
});

test("fails closed if shadow-entry evidence opens authority", () => {
  const input = validInput();
  input.shadowEntryEvidence.orderPlacementAllowed = true;
  const r = buildAiLogicShadowProbationEvidence(input);
  assert.equal(r.complete, false);
  assert.ok(r.reasons.some((reason) => reason.includes("ORDERPLACEMENTALLOWED")));
  assert.equal(r.orderPlacementAllowed, false);
});
