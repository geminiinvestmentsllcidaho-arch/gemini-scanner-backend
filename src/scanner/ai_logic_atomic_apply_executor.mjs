import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildAiLogicAtomicApplyPreapplyGate } from "./ai_logic_atomic_apply_preapply_gate.mjs";

export const VERSION = "ai_logic_atomic_apply_executor_v1";

const sha256 = (value) =>
  crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8")).digest("hex");

function removeIfPresent(filePath) {
  try { fs.unlinkSync(filePath); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function fsyncDir(dir) {
  const fd = fs.openSync(dir, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function writeExclusive0600(filePath, bytes) {
  const fd = fs.openSync(filePath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function atomicReplace(targetPath, bytes, tempPath, mode) {
  writeExclusive0600(tempPath, bytes);
  fs.chmodSync(tempPath, mode);
  const fd = fs.openSync(tempPath, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tempPath, targetPath);
  fsyncDir(path.dirname(targetPath));
}

function validateContainedTarget(root, targetPath) {
  const raw = String(targetPath ?? "").trim().replaceAll("\\", "/");
  if (!raw || path.posix.isAbsolute(raw) || raw.split("/").includes("..")) throw new Error("TARGET_PATH_INVALID");
  const normalized = raw.replace(/^\.\//, "").replace(/\/+/g, "/");
  if (!normalized.startsWith("src/scanner/ai_logic_candidates/")) throw new Error("TARGET_PATH_NOT_ALLOWLISTED");
  const candidateRoot = path.resolve(root, "src/scanner/ai_logic_candidates");
  const absoluteTarget = path.resolve(root, normalized);
  if (absoluteTarget === candidateRoot || !absoluteTarget.startsWith(`${candidateRoot}${path.sep}`)) throw new Error("TARGET_PATH_OUTSIDE_CANDIDATE_ROOT");
  let current = candidateRoot;
  const parent = path.dirname(absoluteTarget);
  const rel = path.relative(candidateRoot, parent);
  for (const part of rel.split(path.sep).filter(Boolean)) {
    const st = fs.lstatSync(current);
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Error("TARGET_PARENT_CHAIN_INVALID");
    current = path.join(current, part);
  }
  const parentStat = fs.lstatSync(parent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error("TARGET_PARENT_CHAIN_INVALID");
  const targetLstat = fs.lstatSync(absoluteTarget);
  if (targetLstat.isSymbolicLink() || !targetLstat.isFile()) throw new Error("TARGET_TYPE_INVALID");
  return { normalized, absoluteTarget, targetLstat };
}

export function executeAiLogicAtomicApply(input = {}) {
  const {
    repositoryRoot,
    boundaryEvidence,
    candidateBytes,
    targetPath,
    expectedPreimageHash,
    immutableManifestBefore,
    verifyImmutableManifestAfter,
    validators = {},
    operationId,
    currentHeadProvider,
  } = input;

  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) throw new Error("REPOSITORY_ROOT_REQUIRED");
  if (typeof operationId !== "string" || !/^[A-Za-z0-9._-]{8,128}$/.test(operationId)) throw new Error("OPERATION_ID_INVALID");

  const root = path.resolve(repositoryRoot);
  const targetValidation = validateContainedTarget(root, targetPath);
  const normalizedTarget = targetValidation.normalized;
  const absoluteTarget = targetValidation.absoluteTarget;
  const targetLstat = targetValidation.targetLstat;
  const preimageBytes = fs.readFileSync(absoluteTarget);
  if (!targetLstat.isFile() || targetLstat.isSymbolicLink()) throw new Error("TARGET_TYPE_INVALID");
  const targetMode = targetLstat.mode & 0o777;
  if ((targetMode & 0o022) !== 0) throw new Error("TARGET_MODE_UNSAFE");

  const preapply = buildAiLogicAtomicApplyPreapplyGate({
    boundaryEvidence,
    candidateBytes,
    targetPath: normalizedTarget,
    expectedPreimageHash,
    currentTargetBytes: preimageBytes,
    immutableManifest: immutableManifestBefore,
    repositoryRoot: root,
    targetLstat,
  });

  if (!preapply.eligible) {
    return Object.freeze({
      version: VERSION,
      applied: false,
      rolledBack: false,
      status: "ATOMIC_APPLY_BLOCKED_PRECONDITION",
      reasons: preapply.reasons,
      runtimeActivated: false,
      pm2RestartPerformed: false,
      gitMutationPerformed: false,
      brokerOrderAccountEffects: "NONE",
    });
  }

  const parent = path.dirname(absoluteTarget);
  const lockPath = path.join(parent, `.ai-apply-lock-${sha256(normalizedTarget).slice(0,24)}`);
  const backupPath = path.join(parent, `.ai-apply-backup-${operationId}`);
  const tempPath = path.join(parent, `.ai-apply-temp-${operationId}`);
  const restoreTempPath = path.join(parent, `.ai-apply-restore-${operationId}`);
  let renamed = false;
  let lockHeld = false;
  try {
    writeExclusive0600(lockPath, Buffer.from(`${operationId}\n`, "utf8"));
    lockHeld = true;
    if (typeof currentHeadProvider !== "function") throw new Error("CURRENT_HEAD_PROVIDER_REQUIRED");
    const freshCurrentHead = String(currentHeadProvider() ?? "").trim();
    if (!freshCurrentHead || freshCurrentHead !== boundaryEvidence?.currentSourceCommit) throw new Error("CURRENT_HEAD_FRESHNESS_MISMATCH");
    writeExclusive0600(backupPath, preimageBytes);
    const immediate = validateContainedTarget(root, normalizedTarget);
    const immediateMode = immediate.targetLstat.mode & 0o777;
    if (immediateMode !== targetMode) throw new Error("PRE_RENAME_TARGET_MODE_DRIFT");
    if (immediate.targetLstat.dev !== targetLstat.dev || immediate.targetLstat.ino !== targetLstat.ino) throw new Error("PRE_RENAME_TARGET_IDENTITY_DRIFT");
    if (sha256(fs.readFileSync(absoluteTarget)) !== expectedPreimageHash) throw new Error("PRE_RENAME_PREIMAGE_HASH_DRIFT");
    atomicReplace(absoluteTarget, candidateBytes, tempPath, targetMode);
    renamed = true;

    if (sha256(fs.readFileSync(absoluteTarget)) !== boundaryEvidence.candidateSourceHash) {
      throw new Error("POST_APPLY_HASH_MISMATCH");
    }
    if (typeof verifyImmutableManifestAfter !== "function") {
      throw new Error("POST_APPLY_MANIFEST_VERIFIER_REQUIRED");
    }
    const manifestAfter = verifyImmutableManifestAfter();
    if (manifestAfter?.ok !== true || manifestAfter?.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
      throw new Error("POST_APPLY_IMMUTABLE_MANIFEST_INVALID");
    }
    for (const name of ["syntax", "focusedTests", "fullRegression"]) {
      if (typeof validators[name] !== "function")
throw new Error(`POST_APPLY_VALIDATOR_REQUIRED_${name}`);
      if (validators[name]() !== true) throw new Error(`POST_APPLY_VALIDATION_FAILED_${name}`);
    }

    removeIfPresent(backupPath);
    return Object.freeze({
      version: VERSION,
      applied: true,
      rolledBack: false,
      status: "LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",
      candidateSourceHash: boundaryEvidence.candidateSourceHash,
      preimageHash: expectedPreimageHash,
      runtimeActivated: false,
      pm2RestartPerformed: false,
      gitMutationPerformed: false,
      brokerOrderAccountEffects: "NONE",
      liveTradingAuthority: "NONE",
      immutablePolicyMutationAuthority: "NONE",
    });
  } catch (error) {
    removeIfPresent(tempPath);
    if (renamed) {
      atomicReplace(absoluteTarget, preimageBytes, restoreTempPath, targetMode);
      if (sha256(fs.readFileSync(absoluteTarget)) !== expectedPreimageHash) {
        throw new Error(`ATOMIC_APPLY_RESTORE_FAILED:${String(error?.message ?? error).slice(0,160)}`);
      }
    }
    removeIfPresent(backupPath);
    return Object.freeze({
      version: VERSION,
      applied: false,
      rolledBack: renamed,
      status: renamed ? "ATOMIC_APPLY_FAILED_ROLLED_BACK" : "ATOMIC_APPLY_FAILED_BEFORE_RENAME",
      errorCode: String(error?.message ?? error).slice(0,200),
      targetPath: normalizedTarget,
      runtimeActivated: false,
      pm2RestartPerformed: false,
      gitMutationPerformed: false,
      brokerOrderAccountEffects: "NONE",
      liveTradingAuthority: "NONE",
      immutablePolicyMutationAuthority: "NONE",
    });
  } finally {
    removeIfPresent(tempPath);
    removeIfPresent(restoreTempPath);
    if (lockHeld) removeIfPresent(lockPath);
  }
}

export default Object.freeze({ VERSION, executeAiLogicAtomicApply });
