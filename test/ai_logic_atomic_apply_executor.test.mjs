import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeAiLogicAtomicApply as execute } from "../src/scanner/ai_logic_atomic_apply_executor.mjs";

const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-atomic-"));
  const dir = path.join(root, "src/scanner/ai_logic_candidates");
  fs.mkdirSync(dir, { recursive:true });
  const target = path.join(dir, "example.mjs");
  const preimage = Buffer.from("export default 'old';\n");
  const candidate = Buffer.from("export default 'new';\n");
  fs.writeFileSync(target, preimage, { mode: 0o644 });
  fs.chmodSync(target, 0o644);
  return {
    root, target, preimage, candidate,
    input: {
      repositoryRoot: root,
      boundaryEvidence: {
        version:"ai_logic_execution_boundary_gate_v1",
        eligible:true,
        applyEligibilityOnly:true,
        readOnly:true,
        evidenceOnly:true,
        paperOnly:true,
        candidateSourceHash:hash(candidate),
        currentSourceCommit:"commit-12345678",
        ...LOCKS,
      },
      candidateBytes:candidate,
      targetPath:"src/scanner/ai_logic_candidates/example.mjs",
      expectedPreimageHash:hash(preimage),
      immutableManifestBefore:{ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"},
      verifyImmutableManifestAfter:()=>({ok:true,status:"IMMUTABLE_MANIFEST_VERIFIED"}),
      validators:{syntax:()=>true,focusedTests:()=>true,fullRegression:()=>true},
      operationId:"op-12345678",
      currentHeadProvider:()=> "commit-12345678",
    },
  };
}

test("applies exact candidate locally while runtime git and broker authority stay closed", () => {
  const f = fixture();
  try {
    const r = execute(f.input);
    assert.equal(r.applied, true);
    assert.equal(r.rolledBack, false);
    assert.equal(r.status, "LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED");
    assert.equal(hash(fs.readFileSync(f.target)), hash(f.candidate));
    assert.equal(r.runtimeActivated, false);
    assert.equal(r.pm2RestartPerformed, false);
    assert.equal(r.gitMutationPerformed, false);
    assert.equal(r.brokerOrderAccountEffects, "NONE");
  } finally {
    fs.rmSync(f.root, {recursive:true,force:true});
  }
});

test("restores exact preimage when post-apply validation fails", () => {
  const f = fixture();
  try {
    f.input.validators.focusedTests = () => false;
    const r = execute(f.input);
    assert.equal(r.applied, false);
    assert.equal(r.rolledBack, true);
    assert.equal(r.status, "ATOMIC_APPLY_FAILED_ROLLED_BACK");
    assert.equal(hash(fs.readFileSync(f.target)), hash(f.preimage));
    assert.match(r.errorCode, /POST_APPLY_VALIDATION_FAILED_focusedTests/);
  } finally {
    fs.rmSync(f.root, {recursive:true,force:true});
  }
});

test("fails closed before target mutation on preimage or authority drift", () => {
  for (const mutate of [
    (x)=>{x.expectedPreimageHash=hash(Buffer.from("wrong"));},
    (x)=>{x.boundaryEvidence.gitMutationAllowed=true;},
  ]) {
    const f = fixture();
    try {
      mutate(f.input);
      const before = fs.readFileSync(f.target);
      const r = execute(f.input);
      assert.equal(r.applied, false);
      assert.equal(r.rolledBack, false);
      assert.equal(r.status, "ATOMIC_APPLY_BLOCKED_PRECONDITION");
      assert.equal(hash(fs.readFileSync(f.target)), hash(before));
    } finally {
      fs.rmSync(f.root, {recursive:true,force:true});
    }
  }
});

test("rejects traversal and absolute target paths before target access", () => {
  for (const badTarget of [
    "../outside.mjs",
    "src/scanner/ai_logic_candidates/../../outside.mjs",
    "/tmp/outside.mjs",
  ]) {
    const f = fixture();
    try {
      f.input.targetPath = badTarget;
      assert.throws(() => execute(f.input), /TARGET_PATH_(INVALID|NOT_ALLOWLISTED|OUTSIDE_CANDIDATE_ROOT)/);
      assert.equal(hash(fs.readFileSync(f.target)), hash(f.preimage));
    } finally {
      fs.rmSync(f.root, {recursive:true,force:true});
    }
  }
});

test("rejects symlinked candidate parent chain before target access", () => {
  const f = fixture();
  try {
    const realDir = path.join(f.root, "real-candidates");
    fs.mkdirSync(realDir);
    const linkedDir = path.join(f.root, "src/scanner/ai_logic_candidates");
    fs.rmSync(linkedDir, {recursive:true,force:true});
    fs.symlinkSync(realDir, linkedDir, "dir");
    const outsideTarget = path.join(realDir, "example.mjs");
    fs.writeFileSync(outsideTarget, f.preimage, {mode:0o644});
    assert.throws(() => execute(f.input), /TARGET_PARENT_CHAIN_INVALID/);
    assert.equal(hash(fs.readFileSync(outsideTarget)), hash(f.preimage));
  } finally {
    fs.rmSync(f.root, {recursive:true,force:true});
  }
});

test("rejects group or other writable target mode", () => {
  for (const mode of [0o664, 0o646, 0o666]) {
    const f = fixture();
    try {
      fs.chmodSync(f.target, mode);
      assert.throws(() => execute(f.input), /TARGET_MODE_UNSAFE/);
      assert.equal(hash(fs.readFileSync(f.target)), hash(f.preimage));
    } finally {
      fs.rmSync(f.root, {recursive:true,force:true});
    }
  }
});

test("preserves safe original target mode on apply and rollback", () => {
  for (const mode of [0o600, 0o640, 0o644]) {
    const f = fixture();
    try {
      fs.chmodSync(f.target, mode);
      const r = execute(f.input);
      assert.equal(r.applied, true);
      assert.equal(fs.statSync(f.target).mode & 0o777, mode);
    } finally {
      fs.rmSync(f.root, {recursive:true,force:true});
    }

    const g = fixture();
    try {
      fs.chmodSync(g.target, mode);
      g.input.validators.fullRegression = () => false;
      const r = execute(g.input);
      assert.equal(r.rolledBack, true);
      assert.equal(fs.statSync(g.target).mode & 0o777, mode);
      assert.equal(hash(fs.readFileSync(g.target)), hash(g.preimage));
    } finally {
      fs.rmSync(g.root, {recursive:true,force:true});
    }
  }
});

test("fails closed before source mutation when fresh current HEAD drifts", () => {
  const f = fixture();
  try {
    f.input.currentHeadProvider = () => "different-commit";
    const before = fs.readFileSync(f.target);
    const r = execute(f.input);
    assert.equal(r.applied, false);
    assert.equal(r.rolledBack, false);
    assert.equal(r.status, "ATOMIC_APPLY_FAILED_BEFORE_RENAME");
    assert.match(r.errorCode, /CURRENT_HEAD_FRESHNESS_MISMATCH/);
    assert.equal(hash(fs.readFileSync(f.target)), hash(before));
  } finally {
    fs.rmSync(f.root, {recursive:true,force:true});
  }
});

test("fails closed before source mutation without fresh current HEAD provider", () => {
  const f = fixture();
  try {
    delete f.input.currentHeadProvider;
    const before = fs.readFileSync(f.target);
    const r = execute(f.input);
    assert.equal(r.applied, false);
    assert.equal(r.rolledBack, false);
    assert.equal(r.status, "ATOMIC_APPLY_FAILED_BEFORE_RENAME");
    assert.match(r.errorCode, /CURRENT_HEAD_PROVIDER_REQUIRED/);
    assert.equal(hash(fs.readFileSync(f.target)), hash(before));
  } finally {
    fs.rmSync(f.root, {recursive:true,force:true});
  }
});
