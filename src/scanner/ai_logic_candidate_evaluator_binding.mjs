import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_candidate_evaluator_binding_v1";
const PREFIX = "src/scanner/ai_logic_candidates/";
const LOCKS = Object.freeze({
  productionRuntimeWiringAllowed:false, promotionExecutionAllowed:false,
  rollbackExecutionAllowed:false, brokerContactAllowed:false,
  orderPlacementAllowed:false, liveTradingAllowed:false,
  accountMutationAllowed:false, immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false, sizingMutationAllowed:false,
  allocationMutationAllowed:false, gitMutationAllowed:false,
});
const clean = (v) => String(v ?? "").trim().replaceAll("\\","/").replace(/^\.\//,"").replace(/\/+/g,"/");
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
function reject(reasons, candidatePath=null) {
  return Object.freeze({version:VERSION,eligible:false,status:"AI_LOGIC_CANDIDATE_EVALUATOR_BINDING_REJECT",
    disposition:"NO_EVALUATOR_BOUND",reasons:Object.freeze([...new Set(reasons)].sort()),
    candidatePath,evaluator:null,sourceHash:null,...LOCKS});
}
export async function bindAiLogicCandidateEvaluator(input={}, options={}) {
  const root = path.resolve(options.rootDir ?? process.cwd());
  const candidatePath = clean(input.candidatePath);
  const expectedSourceHash = String(input.expectedSourceHash ?? "").trim();
  const manifest = options.manifestResult ?? verifyImmutablePolicyManifest();
  const reasons = [];
  if (manifest.ok !== true) reasons.push(`IMMUTABLE:${manifest.status ?? "REJECT"}`);
  if (!candidatePath.startsWith(PREFIX) || candidatePath.length <= PREFIX.length) reasons.push("CANDIDATE_SANDBOX_PATH_REQUIRED");
  if (path.isAbsolute(candidatePath) || candidatePath.split("/").includes("..")) reasons.push("PATH_TRAVERSAL_BLOCKED");
  if (!candidatePath.endsWith(".mjs")) reasons.push("MJS_ONLY");
  const target = path.resolve(root, candidatePath);
  const relative = path.relative(root,target).replaceAll("\\","/");
  if (relative !== candidatePath || !relative.startsWith(PREFIX)) reasons.push("PATH_ESCAPE_BLOCKED");
  if (reasons.length) return reject(reasons,candidatePath||null);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return reject(["CANDIDATE_FILE_REQUIRED"],candidatePath);
  if (fs.lstatSync(target).isSymbolicLink()) return reject(["SYMLINK_PATH_BLOCKED"],candidatePath);
  const source = fs.readFileSync(target,"utf8");
  const sourceHash = hash(source);
  if (expectedSourceHash && expectedSourceHash !== sourceHash) return reject(["SOURCE_HASH_MISMATCH"],candidatePath);
  if (/(^|\n)\s*import\s|import\s*\(|\brequire\s*\(/m.test(source)) return reject(["DEPENDENCY_IMPORT_FORBIDDEN"],candidatePath);
  let mod;
  try {
    mod = await import(`${pathToFileURL(target).href}?aih=${sourceHash}`);
  } catch {
    return reject(["CANDIDATE_IMPORT_FAILED"],candidatePath);
  }
  const exports = Object.keys(mod).sort();
  if (exports.length !== 1 || exports[0] !== "evaluateCandidate" || typeof mod.evaluateCandidate !== "function") {
    return reject(["SINGLE_EVALUATOR_EXPORT_REQUIRED"],candidatePath);
  }
  return Object.freeze({version:VERSION,eligible:true,status:"AI_LOGIC_CANDIDATE_EVALUATOR_BOUND",
    disposition:"OFFLINE_EVALUATOR_ONLY",reasons:Object.freeze([]),candidatePath,
    evaluator:mod.evaluateCandidate,sourceHash,dependencyAuthority:"NONE",
    importScope:"CANDIDATE_SANDBOX_ONLY",...LOCKS});
}
export default Object.freeze({VERSION,bindAiLogicCandidateEvaluator});
