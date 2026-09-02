import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAiLogicCandidateDiff,
  FORBIDDEN_POLICY_PATHS,
 } from "../src/scanner/ai_logic_candidate_diff_allowlist.mjs";

test("allows only explicit candidate sandbox paths for allowlisted topic", () => {
  const result = evaluateAiLogicCandidateDiff({
    topic: "evidence_interpretation",
    changedPaths: [
      "./src/scanner/ai_logic_candidates/evidence_interpretation_v1.mjs",
      "test\\ai_logic_candidates\\evidence_interpretation_v1.test.mjs",
    ],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.status, "AI_LOGIC_CANDIDATE_DIFF_ALLOWLIST_PASS");
  assert.equal(result.productionRuntimeWiringAllowed, false);
  assert.equal(result.persistenceAllowed, false);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});

test("rejects every immutable policy path", () => {
  for (const path of FORBIDDEN_POLICY_PATHS) {
    const result = evaluateAiLogicCandidateDiff({
      topic: "evidence_interpretation",
      changedPaths: [path],
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes(`FORBIDDEN_PATH:${path}`));
  }
});

test("rejects production wiring and non-sandbox scanner paths", () => {
  const result = evaluateAiLogicCandidateDiff({
    topic: "false_positive_classification_logic",
    changedPaths: [
      "src/server.js",
      "src/scanner/scanner_ranking.mjs",
    ],
  });

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("FORBIDDEN_PATH:src/server.js"));
  assert.ok(result.reasons.includes("PATH_NOT_ALLOWLISTED:src/scanner/scanner_ranking.mjs"));
});

test("rejects unknown topic and empty candidate diff", () => {
  const result = evaluateAiLogicCandidateDiff({
    topic: "position_sizing",
    changedPaths: [],
  });

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("TOPIC_NOT_ALLOWLISTED"));
  assert.ok(result.reasons.includes("NO_CHANGED_PATHS"));
  assert.equal(result.disposition, "REJECT");
});

test("normalizes deduplicates and sorts candidate paths deterministically", () => {
  const result = evaluateAiLogicCandidateDiff({
    topic: "classification_coverage",
    changedPaths: [
      "test/ai_logic_candidates/z.test.mjs",
      "./src/scanner/ai_logic_candidates/a.mjs",
      "test\\ai_logic_candidates\\z.test.mjs",
    ],
  });

  assert.deepEqual(result.changedPaths, [
    "src/scanner/ai_logic_candidates/a.mjs",
    "test/ai_logic_candidates/z.test.mjs",
  ]);
  assert.equal(result.eligible, true);
});
