import assert from "node:assert/strict";
import test from "node:test";

import { buildScannerCandidate } from "../../src/scanner/build_candidate.mjs";

test("buildScannerCandidate extracts normalized ranking fields from ops/run style output", () => {
  const candidate = buildScannerCandidate({
    result: { symbol: "spy", action: "hold" },
    coaching: { rsi: 35.5 },
    p3_gate: { ok: true },
    context_v3: {
      quality: { overall: 0.86 },
      integrity: {
        quality: {
          confidence: 0.4349,
          structuralQuality: 0.86,
          compositeConfidence: 0.374,
        },
      },
    },
  });

  assert.deepEqual(candidate, {
    symbol: "spy",
    p3GateOk: true,
    confidence: 0.4349,
    structuralQuality: 0.86,
    compositeConfidence: 0.374,
    qualityOverall: 0.86,
    rsi: 35.5,
  });
});

test("buildScannerCandidate clamps invalid numeric fields safely", () => {
  const candidate = buildScannerCandidate({
    result: { symbol: "BAD" },
    coaching: { rsi: "not-a-number" },
    p3_gate: { ok: false },
    context_v3: {
      quality: { overall: 2 },
      integrity: {
        quality: {
          confidence: -1,
          structuralQuality: 5,
          compositeConfidence: "nope",
        },
      },
    },
  });

  assert.deepEqual(candidate, {
    symbol: "BAD",
    p3GateOk: false,
    confidence: 0,
    structuralQuality: 1,
    compositeConfidence: 0,
    qualityOverall: 1,
    rsi: null,
  });
});
