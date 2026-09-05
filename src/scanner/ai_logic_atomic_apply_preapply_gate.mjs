import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

export const VERSION = "ai_logic_atomic_apply_preapply_gate_v1";

const LOCK_FIELDS = Object.freeze([
  "productionRuntimeWiringAllowed",
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
  "gitMutationAllowed",
]);

const ALLOWED_TARGET_PREFIX = "src/scanner/ai_logic_candidates/";

const sha256 = (value) =>
  crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8")).digest("hex");

const present = (value) => typeof value === "string" && value.trim().length > 0;

const normalizeRepoPath = (value) =>
  String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");

export function buildAiLogicAtomicApplyPreapplyGate({
  boundaryEvidence,
  candidateBytes,
  targetPath,
  expectedPreimageHash,
  currentTargetBytes,
  immutableManifest,
  repositoryRoot,
  targetLstat,
} = {}) {
  const reasons = [];

  if (
    boundaryEvidence?.version !== "ai_logic_execution_boundary_gate_v1"
    || boundaryEvidence?.eligible !== true
    || boundaryEvidence?.applyEligibilityOnly !== true
    || boundaryEvidence?.readOnly !== true
    || boundaryEvidence?.evidenceOnly !== true
    || boundaryEvidence?.paperOnly !== true
  ) reasons.push("BOUNDARY_EVIDENCE_INVALID");

  for (const field of LOCK_FIELDS) {
    if (boundaryEvidence?.[field] !== false) reasons.push(`BOUNDARY_${field}_MUST_BE_FALSE`);
  }

  const candidateSourceHash = boundaryEvidence?.candidateSourceHash;
  if (!present(candidateSourceHash) || sha256(candidateBytes) !== candidateSourceHash) {
    reasons.push("CANDIDATE_SOURCE_HASH_MISMATCH");
  }

  const normalizedTargetPath = normalizeRepoPath(targetPath);
  if (!normalizedTargetPath.startsWith(ALLOWED_TARGET_PREFIX)) reasons.push("TARGET_PATH_NOT_ALLOWLISTED");

  if (!present(expectedPreimageHash) || sha256(currentTargetBytes) !== expectedPreimageHash) {
    reasons.push("PREIMAGE_HASH_MISMATCH");
  }

  if (immutableManifest?.ok !== true || immutableManifest?.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("IMMUTABLE_MANIFEST_INVALID");
  }

  if (!present(repositoryRoot)) {
    reasons.push("REPOSITORY_ROOT_REQUIRED");
  } else {
    const root = path.resolve(repositoryRoot);
    const resolvedTarget = path.resolve(root, normalizedTargetPath);
    if (resolvedTarget !== root && !resolvedTarget.startsWith(`${root}${path.sep}`)) {
      reasons.push("TARGET_PATH_ESCAPES_REPOSITORY_ROOT");
    }
  }

  if (targetLstat?.isSymbolicLink?.() === true) reasons.push("TARGET_SYMLINK_FORBIDDEN");

  const eligible = reasons.length === 0;
  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible
      ? "AI_LOGIC_ATOMIC_APPLY_PREAPPLY_ELIGIBLE"
      : "AI_LOGIC_ATOMIC_APPLY_PREAPPLY_BLOCKED",
    disposition: eligible
      ? "ATOMIC_APPLY_ELIGIBILITY_EVIDENCE_ONLY"
      : "EXECUTOR_BLOCKED_FAIL_CLOSED",
    reasons: Object.freeze(reasons),
    targetPath: normalizedTargetPath || null,
    candidateSourceHash: present(candidateSourceHash) ? candidateSourceHash : null,
    candidateBytesHash: sha256(candidateBytes),
    expectedPreimageHash: present(expectedPreimageHash) ? expectedPreimageHash : null,
    currentTargetHash: sha256(currentTargetBytes),
    readOnly: true,
    evidenceOnly: true,
    paperOnly: true,
    atomicApplyEligibilityOnly: true,
    mutationAuthority: "NONE",
    runtimeActivationAuthority: "NONE",
    gitMutationAuthority: "NONE",
    brokerOrderAccountAuthority: "NONE",
    executionSideEffects: "NONE",
    filesystemMutationAllowed: false,
  });
}

export default Object.freeze({
  VERSION,
  buildAiLogicAtomicApplyPreapplyGate,
});
