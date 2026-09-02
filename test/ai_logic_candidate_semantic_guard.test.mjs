import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAiLogicCandidateSemanticGuard,
  FORBIDDEN_MUTATION_INTENTS,
} from "../src/scanner/ai_logic_candidate_semantic_guard.mjs";

test("allows benign classification and evidence interpretation candidate semantics", () => {
  const result = evaluateAiLogicCandidateSemanticGuard({
    mutationIntents: ["classification_coverage"],
    sourceText: `
      export function classifyEvidence(input) {
        return input.confirmed ? "CONFIRMED" : "UNCONFIRMED";
      }
    `,
  });

  assert.equal(result.eligible, true);
  assert.equal(result.status, "AI_LOGIC_CANDIDATE_SEMANTIC_GUARD_PASS");
  assert.equal(result.productionRuntimeWiringAllowed, false);
  assert.equal(result.persistenceAllowed, false);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});

test("rejects every explicit immutable mutation intent", () => {
  for (const intent of FORBIDDEN_MUTATION_INTENTS) {
    const result = evaluateAiLogicCandidateSemanticGuard({
      mutationIntents: [intent],
      sourceText: "",
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes(`FORBIDDEN_MUTATION_INTENT:${intent}`));
  }
});

test("rejects source semantics that attempt fixed strategy or governance mutation", () => {
  const cases = [
    ["UNDER_FIVE_MAX_PRICE", "adjust the maximum entry price ceiling for under-five candidates"],
    ["DAY_CHANGE_CEILING", "increase the previous-close day-change maximum threshold"],
    ["POSITION_SIZING", "change the position sizing percentage"],
    ["SCALE_PERCENTAGE", "adjust scale-in percentage trigger"],
    ["AUTHORIZATION_MINIMUM", "lower the setup score minimum requirement"],
    ["HARD_LOSS_COOLDOWN", "change same-symbol hard-loss cooldown from 30 minutes"],
    ["WIND_DOWN_GOVERNANCE", "allow buys while portfolio wind-down is active"],
    ["CAPITAL_GOVERNANCE", "increase buying power limit percentage"],
    ["LIVE_TRADING_CONTROL", "enable live trading authorization switch"],
    ["BROKER_ACCOUNT_CONTROL", "bypass broker account permission control"],
  ];

  for (const [id, sourceText] of cases) {
    const result = evaluateAiLogicCandidateSemanticGuard({ sourceText });
    assert.equal(result.eligible, false, id);
    assert.ok(result.reasons.includes(`FORBIDDEN_SOURCE_PATTERN:${id}`), id);
  }
});

test("does not reject benign evidence text that merely mentions policy context", () => {
  const result = evaluateAiLogicCandidateSemanticGuard({
    mutationIntents: ["evidence_interpretation"],
    sourceText: `
      const context = {
        note: "Candidate was blocked by existing policy.",
        evidence: "ranking quality improved after confirmation"
      };
    `,
  });

  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

test("normalizes deduplicates and sorts mutation intents deterministically", () => {
  const result = evaluateAiLogicCandidateSemanticGuard({
    mutationIntents: [
      "classification_coverage",
      " evidence_interpretation ",
      "classification_coverage",
    ],
  });

  assert.deepEqual(result.mutationIntents, [
    "classification_coverage",
    "evidence_interpretation",
  ]);
  assert.equal(result.eligible, true);
});
