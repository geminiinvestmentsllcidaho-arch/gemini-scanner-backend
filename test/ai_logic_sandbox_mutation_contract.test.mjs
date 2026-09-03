import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { applyAiLogicSandboxMutation as apply } from "../src/scanner/ai_logic_sandbox_mutation_contract.mjs";

const manifest = Object.freeze({ ok: true, status: "IMMUTABLE_MANIFEST_VERIFIED" });

test("writes only allowlisted candidate sandbox files with all external authority closed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "a56d-"));
  const rel = "src/scanner/ai_logic_candidates/candidate_one.mjs";
  const result = apply({
    topic: "classification_coverage",
    mutationIntents: ["classification_coverage"],
    files: [{ path: rel, content: "export const candidate = true;\n" }],
  }, { rootDir: root, manifestResult: manifest });

  assert.equal(result.eligible, true);
  assert.equal(result.status, "AI_LOGIC_SANDBOX_MUTATION_APPLIED");
  assert.equal(result.sandboxMutationAllowed, true);
  assert.equal(result.persistenceScope, "CANDIDATE_SANDBOX_ONLY");
  assert.equal(fs.readFileSync(path.join(root, rel), "utf8"), "export const candidate = true;\n");
  assert.equal(fs.statSync(path.join(root, rel)).mode & 0o777, 0o600);
  for (const key of [
    "productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed",
    "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
    "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
    "allocationMutationAllowed","gitMutationAllowed",
  ]) assert.equal(result[key], false);
});

test("fails closed before writing on path policy semantic manifest or traversal violations", () => {
  const cases = [
    {
      input: { topic:"classification_coverage", mutationIntents:[], files:[{path:"src/server.js",content:"export const x=1;\n"}] },
      options: { manifestResult: manifest },
    },
    {
      input: { topic:"classification_coverage", mutationIntents:["position_sizing"], files:[{path:"src/scanner/ai_logic_candidates/x.mjs",content:"export const x=1;\n"}] },
      options: { manifestResult: manifest },
    },
    {
      input: { topic:"classification_coverage", mutationIntents:[], files:[{path:"src/scanner/ai_logic_candidates/x.mjs",content:"export const x=1;\n"}] },
      options: { manifestResult: {ok:false,status:"IMMUTABLE_MANIFEST_REJECT"} },
    },
    {
      input: { topic:"classification_coverage", mutationIntents:[], files:[{path:"src/scanner/ai_logic_candidates/../../server.mjs",content:"export const x=1;\n"}] },
      options: { manifestResult: manifest },
    },
  ];

  for (const c of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "a56d-"));
    const result = apply(c.input, { rootDir:root, ...c.options });
    assert.equal(result.eligible, false);
    assert.equal(result.disposition, "NO_FILES_WRITTEN");
    assert.deepEqual(result.filesWritten, []);
    assert.equal(fs.existsSync(path.join(root, "src/server.js")), false);
    assert.equal(fs.existsSync(path.join(root, "src/scanner/ai_logic_candidates/x.mjs")), false);
  }
});

test("blocks symlink escape from candidate sandbox", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "a56d-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "a56d-out-"));
  const dir = path.join(root, "src/scanner");
  fs.mkdirSync(dir, { recursive:true });
  fs.symlinkSync(outside, path.join(dir, "ai_logic_candidates"), "dir");

  const result = apply({
    topic:"classification_coverage",
    mutationIntents:[],
    files:[{path:"src/scanner/ai_logic_candidates/escape.mjs",content:"export const x=1;\n"}],
  }, { rootDir:root, manifestResult:manifest });

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("SYMLINK_PATH_BLOCKED"));
  assert.equal(fs.existsSync(path.join(outside, "escape.mjs")), false);
});
