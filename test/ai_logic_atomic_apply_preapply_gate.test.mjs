import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { buildAiLogicAtomicApplyPreapplyGate as build } from "../src/scanner/ai_logic_atomic_apply_preapply_gate.mjs";

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const LOCKS = {
  productionRuntimeWiringAllowed:false,
  promotionExecutionAllowed:false,
  rollbackExecutionAllowed:false,
  brokerContactAllowed:false,
  orderPlacementAllowed:false,
  liveTradingAllowed:false,
  accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,
  sizingMutationAllowed:false,
  allocationMutationAllowed:false,
  gitMutationAllowed:false,
};

function fixture() {
  const candidateBytes = Buffer.from("candidate-v2");
  const currentTargetBytes = Buffer.from("preimage-v1");
  return {
    boundaryEvidence: {
      version:"ai_logic_execution_boundary_gate_v1",
      eligible:true,
      applyEligibilityOnly:true,
      readOnly:true,
      evidenceOnly:true,
      paperOnly:true,
      candidateSourceHash:hash(candidateBytes),
      ...LOCKS,
    },
    candidateBytes,
    targetPath:"src/scanner/ai_logic_candidates/example.mjs",
    expectedPreimageHash:hash(currentTargetBytes),
    currentTargetBytes,
    immutableManifest:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"},
    repositoryRoot:"/repo",
    targetLstat:{isSymbolicLink:()=>false},
  };
}

test("emits atomic apply eligibility evidence only with every authority closed", () => {
  const result = build(fixture());
  assert.equal(result.eligible, true);
  assert.equal(result.atomicApplyEligibilityOnly, true);
  assert.equal(result.filesystemMutationAllowed, false);
  assert.equal(result.mutationAuthority, "NONE");
  assert.equal(result.candidateBytesHash, result.candidateSourceHash);
  assert.equal(result.currentTargetHash, result.expectedPreimageHash);
});

test("fails closed on boundary hash preimage manifest path symlink or authority drift", () => {
  const cases = [
    (x) => { x.boundaryEvidence.eligible = false; },
    (x) => { x.candidateBytes = Buffer.from("tampered"); },
    (x) => { x.expectedPreimageHash = hash("wrong"); },
    (x) => { x.immutableManifest = {ok:false,status:"BAD"}; },
    (x) => { x.targetPath = "src/server.js"; },
    (x) => { x.targetLstat = {isSymbolicLink:()=>true}; },
    (x) => { x.boundaryEvidence.gitMutationAllowed = true; },
  ];
  for (const mutate of cases) {
    const input = fixture();
    mutate(input);
    assert.equal(build(input).eligible, false);
  }
});

test("fails closed when target escapes repository root or root is missing", () => {
  let input = fixture();
  input.targetPath = "../escape.mjs";
  assert.equal(build(input).eligible, false);
  input = fixture();
  input.repositoryRoot = "";
  assert.equal(build(input).eligible, false);
});
