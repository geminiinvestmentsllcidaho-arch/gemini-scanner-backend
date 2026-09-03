import fs from "node:fs";
import path from "node:path";

import { evaluateAiLogicCandidateDiff } from "./ai_logic_candidate_diff_allowlist.mjs";
import { evaluateAiLogicCandidateSemanticGuard } from "./ai_logic_candidate_semantic_guard.mjs";
import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_sandbox_mutation_contract_v1";

const ALLOWED_PREFIXES = Object.freeze([
  "src/scanner/ai_logic_candidates/",
  "test/ai_logic_candidates/",
]);

const LOCKS = Object.freeze({
  productionRuntimeWiringAllowed: false,
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
  gitMutationAllowed: false,
});

const cleanPath = (value) =>
  String(value ?? "").trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/");

const insideAllowedPrefix = (relativePath) =>
  ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix) && relativePath.length > prefix.length);

function hasSymlinkComponent(rootDir, relativePath) {
  const parts = relativePath.split("/").filter(Boolean);
  let current = rootDir;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) return true;
  }
  const target = path.join(rootDir, ...parts);
  return fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink();
}

function writeAtomic(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.writeFileSync(tempPath, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(tempPath, targetPath);
    fs.chmodSync(targetPath, 0o600);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

export function applyAiLogicSandboxMutation(input = {}, options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const topic = String(input.topic ?? "").trim();
  const mutationIntents = Array.isArray(input.mutationIntents) ? input.mutationIntents : [];
  const files = Array.isArray(input.files) ? input.files : [];
  const normalized = files.map((entry) => ({
    path: cleanPath(entry?.path),
    content: String(entry?.content ?? ""),
  }));

  const reasons = [];
  if (!normalized.length) reasons.push("FILES_REQUIRED");
  if (normalized.some((entry) => !entry.path || !insideAllowedPrefix(entry.path))) reasons.push("SANDBOX_PATH_REQUIRED");
  if (normalized.some((entry) => path.isAbsolute(entry.path) || entry.path.split("/").includes(".."))) reasons.push("PATH_TRAVERSAL_BLOCKED");
  if (new Set(normalized.map((entry) => entry.path)).size !== normalized.length) reasons.push("DUPLICATE_PATH");
  if (normalized.some((entry) => !entry.path.endsWith(".mjs"))) reasons.push("MJS_ONLY");
  if (normalized.some((entry) => !entry.content.trim())) reasons.push("NONEMPTY_SOURCE_REQUIRED");
  if (normalized.some((entry) => hasSymlinkComponent(rootDir, entry.path))) reasons.push("SYMLINK_PATH_BLOCKED");

  const changedPaths = normalized.map((entry) => entry.path);
  const manifest = options.manifestResult ?? verifyImmutablePolicyManifest();
  const diff = evaluateAiLogicCandidateDiff({ topic, changedPaths });
  const semantic = evaluateAiLogicCandidateSemanticGuard({
    mutationIntents,
    sourceText: normalized.map((entry) => entry.content).join("\n"),
  });

  if (manifest.ok !== true) reasons.push(`IMMUTABLE:${manifest.status ?? "REJECT"}`);
  if (diff.eligible !== true) reasons.push(...diff.reasons.map((reason) => `DIFF:${reason}`));
  if (semantic.eligible !== true) reasons.push(...semantic.reasons.map((reason) => `SEMANTIC:${reason}`));

  const eligible = reasons.length === 0;
  if (!eligible) {
    return Object.freeze({
      version: VERSION,
      eligible: false,
      status: "AI_LOGIC_SANDBOX_MUTATION_REJECT",
      disposition: "NO_FILES_WRITTEN",
      reasons: Object.freeze([...new Set(reasons)].sort()),
      changedPaths: Object.freeze(changedPaths),
      filesWritten: Object.freeze([]),
      sandboxMutationAllowed: false,
      persistenceScope: "NONE",
      ...LOCKS,
    });
  }

  const filesWritten = [];
  for (const entry of normalized) {
    const targetPath = path.resolve(rootDir, entry.path);
    const relative = path.relative(rootDir, targetPath).replaceAll("\\", "/");
    if (relative.startsWith("../") || relative === ".." || !insideAllowedPrefix(relative)) {
      throw new Error("sandbox_mutation_path_escape");
    }
    writeAtomic(targetPath, entry.content);
    filesWritten.push(entry.path);
  }

  return Object.freeze({
    version: VERSION,
    eligible: true,
    status: "AI_LOGIC_SANDBOX_MUTATION_APPLIED",
    disposition: "LOCAL_CANDIDATE_SANDBOX_ONLY",
    reasons: Object.freeze([]),
    changedPaths: Object.freeze(changedPaths),
    filesWritten: Object.freeze(filesWritten),
    sandboxMutationAllowed: true,
    persistenceScope: "CANDIDATE_SANDBOX_ONLY",
    ...LOCKS,
  });
}

export default Object.freeze({ VERSION, applyAiLogicSandboxMutation });
