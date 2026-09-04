import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicShadowEntryBinding as gate } from "../src/scanner/ai_logic_shadow_entry_binding.mjs";

function fixture() {
  const binding = {
    knownGoodRecordId: "kg-1",
    candidateId: "cand-1",
    candidateSourceHash: "c".repeat(64),
    replayId: "replay-1",
    sourceCommitBefore: "a".repeat(40),
    sourceCommitAfter: "b".repeat(40),
  };
  return {
    preShadowEvidence: {
      valid: true,
      stage: "OFFLINE_PRE_SHADOW",
      status: "AI_LOGIC_PRE_SHADOW_EXPERIMENT_EVIDENCE_VALID",
      disposition: "OFFLINE_PRE_SHADOW_EVIDENCE_ONLY",
      shadowResultsAllowed: false,
      shadowComplete: false,
      binding: { ...binding },
      productionRuntimeWiringAllowed: false,
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
      gitMutationAllowed: false,
    },
    acceptanceEvidence: {
      eligible: true,
      status: "AI_LOGIC_PRE_SHADOW_ACCEPTANCE_EVIDENCE_BINDING_VALID",
      disposition: "OFFLINE_PRE_SHADOW_ACCEPTANCE_BINDING_EVIDENCE_ONLY",
      binding: { ...binding },
    },
  };
}

test("permits shadow entry evidence only with exact pre-shadow provenance binding", () => {
  const r = gate(fixture());
  assert.equal(r.eligible, true);
  assert.equal(r.status, "AI_LOGIC_SHADOW_ENTRY_BINDING_VALID");
  assert.equal(r.binding.candidateSourceHash, "c".repeat(64));
  for (const [k,v] of Object.entries(r)) if (k.endsWith("Allowed")) assert.equal(v, false);
});

test("fails closed on candidate source hash or replay drift", () => {
  const a = fixture();
  a.acceptanceEvidence.binding.candidateSourceHash = "d".repeat(64);
  assert.equal(gate(a).eligible, false);
  const b = fixture();
  b.acceptanceEvidence.binding.replayId = "other";
  assert.equal(gate(b).eligible, false);
});

test("fails closed if pre-shadow evidence claims shadow completion", () => {
  const a = fixture();
  a.preShadowEvidence.shadowComplete = true;
  assert.equal(gate(a).eligible, false);
});

test("fails closed if any authority lock is open", () => {
  const a = fixture();
  a.preShadowEvidence.productionRuntimeWiringAllowed = true;
  assert.equal(gate(a).eligible, false);
});
