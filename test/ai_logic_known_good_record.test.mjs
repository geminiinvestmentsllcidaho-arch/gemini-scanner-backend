import assert from "node:assert/strict";
import test from "node:test";
import { buildAiLogicKnownGoodRecord } from "../src/scanner/ai_logic_known_good_record.mjs";

const now = new Date("2026-09-02T08:50:00.000Z");
const base = {
  versionId: "known-good-001",
  sourceCommit: "a".repeat(40),
  immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
  logicScope: "decision_quality_classification",
  activeForProduction: true,
};

test("builds deterministic known-good identity without enabling rollback", () => {
  const first = buildAiLogicKnownGoodRecord(base, { now });
  const second = buildAiLogicKnownGoodRecord(base, { now });
  assert.equal(first.valid, true);
  assert.equal(first.recordId, second.recordId);
  assert.equal(first.rollbackTargetIdentified, true);
  assert.equal(first.rollbackExecutable, false);
  assert.equal(first.promotionEligible, false);
  assert.equal(first.productionRuntimeWiringAllowed, false);
  assert.equal(first.orderPlacementAllowed, false);
  assert.equal(first.accountMutationAllowed, false);
});

test("fails closed when immutable manifest is not verified", () => {
  const record = buildAiLogicKnownGoodRecord({
    ...base,
    immutableManifestStatus: "IMMUTABLE_MANIFEST_REJECT",
  }, { now });
  assert.equal(record.valid, false);
  assert.equal(record.rollbackTargetIdentified, false);
  assert.ok(record.missingRequiredFields.includes("immutableManifestStatus"));
});
