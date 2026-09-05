import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiLogicShadowProbationEvidence } from "../src/scanner/ai_logic_shadow_probation_consumer.mjs";

const locks = {
  productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,
  rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,
  liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,
};

function fixture() {
  const acceptanceEvidence = {
    version:"ai_logic_acceptance_evidence_store_v1",recordId:"a1",candidateId:"c1",candidateSourceHash:"c".repeat(64),
    knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",
    immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",localJsonlOnly:true,...locks,
  };
  const knownGood = {
    valid:true,status:"KNOWN_GOOD_RECORD_VALID",recordId:"k1",sourceCommit:"before",
    immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",...locks,
  };
  const shadowEntryEvidence = {
    version:"ai_logic_shadow_entry_binding_v1",eligible:true,status:"AI_LOGIC_SHADOW_ENTRY_BINDING_VALID",
    disposition:"SHADOW_ENTRY_EVIDENCE_ONLY",binding:{candidateId:"c1",knownGoodRecordId:"k1",replayId:"r1",sourceCommitBefore:"before",sourceCommitAfter:"after",candidateSourceHash:"c".repeat(64)},...locks,
  };
  const shadowProbationEvidence = {
    status:"SHADOW_PROBATION_EVIDENCE_COMPLETE",sampleCount:3,candidateId:"c1",candidateSourceHash:"c".repeat(64),
    knownGoodRecordId:"k1",acceptanceRecordId:"a1",replayId:"r1",
    sourceCommitBefore:"before",sourceCommitAfter:"after",
    immutableManifestStatus:"IMMUTABLE_MANIFEST_VERIFIED",...locks,
  };
  return { acceptanceEvidence, shadowEntryEvidence, knownGood, shadowProbationEvidence };
}

test("accepts complete isolated shadow probation evidence", () => {
  const r = evaluateAiLogicShadowProbationEvidence(fixture());
  assert.equal(r.accepted, true);
  assert.equal(r.status, "AI_LOGIC_SHADOW_PROBATION_ASSESSMENT_EVIDENCE");
  assert.equal(r.disposition, "ISOLATED_PROBATION_ASSESSMENT_EVIDENCE_ONLY");
  assert.deepEqual(r.reasons, []);
});

test("fails closed on identity mismatch and invalid sample count", () => {
  const f = fixture();
  f.shadowProbationEvidence = { ...f.shadowProbationEvidence, candidateId:"other", sampleCount:0 };
  const r = evaluateAiLogicShadowProbationEvidence(f);
  assert.equal(r.accepted, false);
  assert.equal(r.disposition, "REJECT_OR_HOLD");
  assert.ok(r.reasons.includes("SHADOW_CANDIDATE_BINDING_MISMATCH"));
  assert.ok(r.reasons.includes("SHADOW_PROBATION_SAMPLE_COUNT_REQUIRED"));
});

test("fails closed when acceptance provenance or a mutation lock is open", () => {
  const f = fixture();
  f.acceptanceEvidence = { ...f.acceptanceEvidence, localJsonlOnly:false };
  f.shadowProbationEvidence = { ...f.shadowProbationEvidence, promotionAllowed:true };
  const r = evaluateAiLogicShadowProbationEvidence(f);
  assert.equal(r.accepted, false);
  assert.equal(r.disposition, "REJECT_OR_HOLD");
  assert.ok(r.reasons.includes("ACCEPTANCE_LOCAL_JSONL_ONLY_REQUIRED"));
  assert.ok(r.reasons.includes("MUTATION_LOCK_NOT_CLOSED_PROMOTIONALLOWED"));
});

test("candidate source hash provenance is required and exact",()=>{
  const a=fixture();
  a.acceptanceEvidence={...a.acceptanceEvidence,candidateSourceHash:""};
  assert.equal(evaluateAiLogicShadowProbationEvidence(a).accepted,false);
  const b=fixture();
  b.shadowProbationEvidence={...b.shadowProbationEvidence,candidateSourceHash:"d".repeat(64)};
  assert.equal(evaluateAiLogicShadowProbationEvidence(b).accepted,false);
  const c=evaluateAiLogicShadowProbationEvidence(fixture());
  assert.equal(c.binding.candidateSourceHash,"c".repeat(64));
});


test("fails closed without valid shadow-entry evidence or on shadow-entry binding drift",()=>{
  const a=fixture(); delete a.shadowEntryEvidence;
  const r1=evaluateAiLogicShadowProbationEvidence(a);
  assert.equal(r1.accepted,false);
  assert.ok(r1.reasons.includes("SHADOW_ENTRY_EVIDENCE_INVALID"));
  const b=fixture(); b.shadowEntryEvidence={...b.shadowEntryEvidence,binding:{...b.shadowEntryEvidence.binding,candidateSourceHash:"d".repeat(64)}};
  const r2=evaluateAiLogicShadowProbationEvidence(b);
  assert.equal(r2.accepted,false);
  assert.ok(r2.reasons.includes("SHADOW_ENTRY_CANDIDATESOURCEHASH_BINDING_MISMATCH"));
});

test("fails closed if shadow-entry evidence opens authority",()=>{
  const f=fixture(); f.shadowEntryEvidence={...f.shadowEntryEvidence,orderPlacementAllowed:true};
  const r=evaluateAiLogicShadowProbationEvidence(f);
  assert.equal(r.accepted,false);
  assert.ok(r.reasons.includes("MUTATION_LOCK_NOT_CLOSED_ORDERPLACEMENTALLOWED"));
});
