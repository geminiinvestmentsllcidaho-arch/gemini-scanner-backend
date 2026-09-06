import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_candidate_artifact_resolver_v1";
const PREFIX = "src/scanner/ai_logic_candidates/";
const LOCKS = Object.freeze({
  productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,localSandboxMutationAllowed:false,filesystemMutationAllowed:false,runtimeActivationAllowed:false,
});
const clean = (v) => String(v ?? "").trim().replaceAll("\\","/").replace(/^\.\//,"").replace(/\/+/g,"/");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const reject = (reasons,candidatePath=null) => Object.freeze({
  version:VERSION,eligible:false,status:"AI_LOGIC_CANDIDATE_ARTIFACT_RESOLUTION_REJECT",
  disposition:"NO_AUTHORITATIVE_BYTES_RESOLVED",reasons:Object.freeze([...new Set(reasons)].sort()),
  candidatePath,candidateBytes:null,sourceText:null,sourceHash:null,readOnly:true,evidenceOnly:true,...LOCKS,
});

function hasSymlinkComponent(root, rel) {
  let current = root;
  for (const part of rel.split("/").filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) return true;
  }
  return false;
}

export function resolveAiLogicCandidateArtifact(input={}, options={}) {
  const root = path.resolve(options.rootDir ?? process.cwd());
  const candidatePath = clean(input.candidatePath);
  const expectedSourceHash = String(input.expectedSourceHash ?? "").trim().toLowerCase();
  const manifest = options.manifestResult ?? verifyImmutablePolicyManifest({rootDir:root});
  const reasons = [];

  if (manifest?.ok !== true || manifest?.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
    reasons.push("IMMUTABLE_MANIFEST_INVALID");
  }
  if (!candidatePath.startsWith(PREFIX) || candidatePath.length <= PREFIX.length) {
    reasons.push("CANDIDATE_SANDBOX_PATH_REQUIRED");
  }
  if (path.isAbsolute(candidatePath) || candidatePath.split("/").includes("..")) {
    reasons.push("PATH_TRAVERSAL_BLOCKED");
  }
  if (!candidatePath.endsWith(".mjs")) reasons.push("MJS_ONLY");
  if (!/^[a-f0-9]{64}$/.test(expectedSourceHash)) reasons.push("EXPECTED_SOURCE_HASH_REQUIRED");

  const target = path.resolve(root, candidatePath);
  const relative = path.relative(root, target).replaceAll("\\", "/");
  if (relative !== candidatePath || !relative.startsWith(PREFIX)) {
    reasons.push("PATH_ESCAPE_BLOCKED");
  }
  if (reasons.length) return reject(reasons, candidatePath || null);

  if (!fs.existsSync(target)) return reject(["CANDIDATE_FILE_REQUIRED"], candidatePath);
  if (hasSymlinkComponent(root, candidatePath)) return reject(["SYMLINK_PATH_BLOCKED"], candidatePath);

  const stat = fs.lstatSync(target);
  if (!stat.isFile()) return reject(["REGULAR_FILE_REQUIRED"], candidatePath);
  if ((stat.mode & 0o022) !== 0) return reject(["CANDIDATE_MODE_UNSAFE"], candidatePath);
  let fd;
  let candidateBytes;
  try {
    fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const fdStat = fs.fstatSync(fd);
    if (!fdStat.isFile()) return reject(["REGULAR_FILE_REQUIRED"], candidatePath);
    if ((fdStat.mode & 0o022) !== 0) return reject(["CANDIDATE_MODE_UNSAFE",], candidatePath);
    candidateBytes = fs.readFileSync(fd);
  } catch {
    return reject(["CANDIDATE_SECURE_READ_FAILED"], candidatePath);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  const sourceHash = sha(candidateBytes);
  if (sourceHash !== expectedSourceHash) return reject(["SOURCE_HASH_MISMATCH"], candidatePath);

  const sourceText = candidateBytes.toString("utf8");
  if (!sourceText.trim() || !Buffer.from(sourceText, "utf8").equals(candidateBytes)) {
    return reject(["UTF8_EXACT_BYTES_REQUIRED"], candidatePath);
  }

  return Object.freeze({
    version:VERSION,
    eligible:true,
    status:"AI_LOGIC_CANDIDATE_ARTIFACT_RESOLVED",
    disposition:"READONLY_AUTHORITATIVE_CANDIDATE_BYTES",
    reasons:Object.freeze([]),
    candidatePath,
    candidateBytes:Buffer.from(candidateBytes),
    sourceText,
    sourceHash,
    readOnly:true,
    evidenceOnly:true,
    sourceExecutionAllowed:false,
    dynamicImportAllowed:false,
    ...LOCKS,
  });
}
export default Object.freeze({ VERSION, resolveAiLogicCandidateArtifact });
