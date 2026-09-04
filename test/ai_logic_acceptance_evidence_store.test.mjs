import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendAiLogicAcceptanceEvidenceRecord,
  buildAiLogicAcceptanceEvidenceRecord,
  listAiLogicAcceptanceEvidenceRecords,
} from "../src/scanner/ai_logic_acceptance_evidence_store.mjs";

const valid = {
  eligible: true,
  status: "AI_LOGIC_ACCEPTANCE_EVIDENCE_BINDING_VALID",
  disposition: "OFFLINE_ACCEPTANCE_BINDING_EVIDENCE_ONLY",
  binding: {
    candidateId: "candidate-001",
    knownGoodRecordId: "kg-001",
    replayId: "replay-001",
    sourceCommitBefore: "a".repeat(40),
    sourceCommitAfter: "b".repeat(40),
    candidateSourceHash: "c".repeat(64),
  },
};

test("builds deterministic offline acceptance evidence with every mutation lock closed", () => {
  const a = buildAiLogicAcceptanceEvidenceRecord(valid, { now: "2026-09-02T18:00:00.000Z" });
  const b = buildAiLogicAcceptanceEvidenceRecord(valid, { now: "2026-09-02T19:00:00.000Z" });
  assert.equal(a.recordId, b.recordId);
  assert.equal(a.candidateSourceHash, "c".repeat(64));
  const drifted = buildAiLogicAcceptanceEvidenceRecord({
    ...valid,
    binding: { ...valid.binding, candidateSourceHash: "d".repeat(64) },
  }, { now: "2026-09-02T18:00:00.000Z" });
  assert.notEqual(a.recordId, drifted.recordId);
  assert.equal(a.immutableManifestStatus, "IMMUTABLE_MANIFEST_VERIFIED");
  for (const key of [
    "promotionAllowed","rollbackExecutionAllowed","productionRuntimeWiringAllowed",
    "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed",
    "accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed",
    "sizingMutationAllowed","allocationMutationAllowed",
  ]) assert.equal(a[key], false);
});

test("appends once, deduplicates, lists newest first, and enforces private modes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-ai-acceptance-"));
  const ledgerPath = path.join(root, "evidence.jsonl");
  const first = appendAiLogicAcceptanceEvidenceRecord(valid, { ledgerPath, now: "2026-09-02T18:00:00.000Z" });
  const second = appendAiLogicAcceptanceEvidenceRecord(valid, { ledgerPath, now: "2026-09-02T19:00:00.000Z" });
  assert.equal(first.appended, true);
  assert.equal(second.duplicateSkipped, true);
  const rows = listAiLogicAcceptanceEvidenceRecords({ ledgerPath, limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recordId, first.recordId);
  assert.equal(fs.statSync(ledgerPath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(root).mode & 0o777, 0o700);
});

test("fails closed for ineligible binding, missing identity, and malformed ledger", () => {
  assert.throws(
    () => buildAiLogicAcceptanceEvidenceRecord({ ...valid, eligible: false }),
    /not_eligible/,
  );
  assert.throws(
    () => buildAiLogicAcceptanceEvidenceRecord({
      ...valid,
      binding: { ...valid.binding, replayId: "" },
    }),
    /identity_missing/,
  );
  assert.throws(
    () => buildAiLogicAcceptanceEvidenceRecord({
      ...valid,
      binding: { ...valid.binding, candidateSourceHash: "" },
    }),
    /identity_missing/,
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-ai-acceptance-bad-"));
  const ledgerPath = path.join(root, "evidence.jsonl");
  fs.writeFileSync(ledgerPath, "{bad-json}\n", { mode: 0o600 });
  assert.throws(
    () => appendAiLogicAcceptanceEvidenceRecord(valid, { ledgerPath }),
    /ledger_malformed/,
  );
  assert.throws(
    () => listAiLogicAcceptanceEvidenceRecords({ ledgerPath }),
    /ledger_malformed/,
  );
});
