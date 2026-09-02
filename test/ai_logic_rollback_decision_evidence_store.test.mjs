import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildAiLogicRollbackDecisionEvidenceRecord as build,
  appendAiLogicRollbackDecisionEvidenceRecord as append,
  listAiLogicRollbackDecisionEvidenceRecords as list,
} from "../src/scanner/ai_logic_rollback_decision_evidence_store.mjs";

const locks = {
  productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,
  promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,
  orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,
  sizingMutationAllowed:false,allocationMutationAllowed:false,
};
const valid = () => ({
  version:"ai_logic_rollback_decision_evidence_gate_v1",
  eligible:true,
  status:"AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_READY",
  disposition:"ROLLBACK_DECISION_EVIDENCE_ONLY",
  immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",
  rollbackTargetIdentified:true,
  rollbackDecisionEvidenceOnly:true,
  binding:{
    promotionDecisionRecordId:"p1",acceptanceRecordId:"a1",candidateId:"c1",
    knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",
  },
  ...locks,
});

test("builds deterministic locked local rollback evidence", () => {
  const a = build(valid(), { now:"2026-09-02T23:00:00Z" });
  const b = build(valid(), { now:"2026-09-02T23:01:00Z" });
  assert.equal(a.recordId,b.recordId);
  assert.equal(a.localJsonlOnly,true);
  assert.equal(a.rollbackTargetIdentified,true);
  assert.equal(a.rollbackDecisionEvidenceOnly,true);
  for (const key of Object.keys(locks)) assert.equal(a[key],false,key);
});

test("appends once, deduplicates, lists newest first, and enforces private modes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),"a54-rb-"));
  const ledgerPath = path.join(root,"evidence.jsonl");
  const a = append(valid(),{ledgerPath,now:"2026-09-02T23:00:00Z"});
  const b = append(valid(),{ledgerPath,now:"2026-09-02T23:01:00Z"});
  assert.equal(a.appended,true);
  assert.equal(b.appended,false);
  assert.equal(b.duplicateSkipped,true);
  assert.equal(list({ledgerPath,limit:10}).length,1);
  assert.equal(fs.statSync(ledgerPath).mode & 0o777,0o600);
  assert.equal(fs.statSync(root).mode & 0o777,0o700);
});

test("fails closed on invalid contract, open lock, missing identity, and malformed ledger", () => {
  assert.throws(() => build({...valid(),eligible:false}),/NOT_PERSISTABLE/);
  assert.throws(() => build({...valid(),rollbackExecutionAllowed:true}),/LOCK_OPEN/);
  const x=valid(); x.binding={...x.binding,replayId:""}; assert.throws(() => build(x),/NOT_PERSISTABLE/);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"a54-rb-bad-"));
  const ledgerPath=path.join(root,"evidence.jsonl");
  fs.writeFileSync(ledgerPath,"bad\n",{mode:0o600});
  assert.throws(() => list({ledgerPath}),/MALFORMED/);
  assert.throws(() => append(valid(),{ledgerPath}),/MALFORMED/);
});
