import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLogicRollbackDecisionEvidence as build } from "../src/scanner/ai_logic_rollback_decision_evidence_gate.mjs";

const locks = {
  productionRuntimeWiringAllowed: false,
  persistenceAllowed: false,
  promotionAllowed: false,
  promotionExecutionAllowed: false,
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

function fixture() {
  const binding = {
    acceptanceRecordId: "a1",
    candidateId: "c1",
    knownGoodRecordId: "k1",
    replayId: "r1",
    sourceCommitBefore: "before",
    sourceCommitAfter: "after",
  };

  return {
    promotionDecision: {
      version: "ai_logic_promotion_decision_evidence_store_v1",
      recordId: "p1",
      ...binding,
      binding,
      localJsonlOnly: true,
      immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
      ...locks,
    },
    acceptanceEvidence: {
      version: "ai_logic_acceptance_evidence_store_v1",
      recordId: "a1",
      candidateId: "c1",
      knownGoodRecordId: "k1",
      replayId: "r1",
      sourceCommitBefore: "before",
      sourceCommitAfter: "after",
      localJsonlOnly: true,
      immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
      ...locks,
    },
    knownGood: {
      valid: true,
      status: "KNOWN_GOOD_RECORD_VALID",
      recordId: "k1",
      sourceCommit: "before",
      immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
      rollbackTargetIdentified: true,
      rollbackExecutable: false,
      promotionEligible: false,
      strategySwitchingAllowed: false,
      ...locks,
    },
  };
}

test("permits rollback decision evidence only with complete immutable bindings and every mutation lock closed", () => {
  const result = build(fixture());

  assert.equal(result.eligible, true);
  assert.equal(result.status, "AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_READY");
  assert.equal(result.disposition, "ROLLBACK_DECISION_EVIDENCE_ONLY");
  assert.equal(result.rollbackTargetIdentified, true);
  assert.equal(result.rollbackDecisionEvidenceOnly, true);
  assert.equal(result.rollbackExecutionAllowed, false);
  assert.equal(result.promotionExecutionAllowed, false);
  assert.equal(result.productionRuntimeWiringAllowed, false);
  assert.equal(result.persistenceAllowed, false);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.binding, {
    promotionDecisionRecordId: "p1",
    acceptanceRecordId: "a1",
    candidateId: "c1",
    knownGoodRecordId: "k1",
    replayId: "r1",
    sourceCommitBefore: "before",
    sourceCommitAfter: "after",
  });
});

test("fails closed on candidate, known-good, replay, source-commit, or promotion-decision binding mismatch", () => {
  for (const mutate of [
    (f) => { f.promotionDecision.binding = { ...f.promotionDecision.binding, candidateId: "other" }; },
    (f) => { f.acceptanceEvidence.knownGoodRecordId = "other"; },
    (f) => { f.acceptanceEvidence.replayId = "other"; },
    (f) => { f.acceptanceEvidence.sourceCommitBefore = "other"; },
    (f) => { f.promotionDecision.acceptanceRecordId = "other"; },
  ]) {
    const f = fixture();
    mutate(f);
    const result = build(f);
    assert.equal(result.eligible, false);
    assert.equal(result.status, "AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_HOLD");
    assert.equal(result.rollbackExecutionAllowed, false);
    assert.ok(result.reasons.length > 0);
  }
});

test("fails closed when known-good rollback target is absent or any execution/policy lock opens", () => {
  {
    const f = fixture();
    f.knownGood = { ...f.knownGood, rollbackTargetIdentified: false };
    const result = build(f);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes("KNOWN_GOOD_ROLLBACK_TARGET_REQUIRED"));
  }

  for (const target of ["promotionDecision", "acceptanceEvidence", "knownGood"]) {
    const f = fixture();
    f[target] = { ...f[target], rollbackExecutionAllowed: true };
    const result = build(f);
    assert.equal(result.eligible, false);
    assert.equal(result.rollbackExecutionAllowed, false);
  }
});

test("does not authorize persistence, promotion, runtime wiring, broker contact, orders, live trading, or immutable policy mutation", () => {
  const result = build(fixture());
  for (const key of [
    "productionRuntimeWiringAllowed",
    "persistenceAllowed",
    "promotionAllowed",
    "promotionExecutionAllowed",
    "rollbackExecutionAllowed",
    "brokerContactAllowed",
    "orderPlacementAllowed",
    "liveTradingAllowed",
    "accountMutationAllowed",
    "immutablePolicyMutationAllowed",
    "thresholdMutationAllowed",
    "sizingMutationAllowed",
    "allocationMutationAllowed",
  ]) {
    assert.equal(result[key], false, key);
  }
});
