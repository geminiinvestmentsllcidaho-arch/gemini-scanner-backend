import assert from "node:assert/strict";
import test from "node:test";

import { rankScannerCandidates } from "../../src/scanner/ranking_engine.mjs";

test("rankScannerCandidates ranks valid candidates by deterministic setup score", () => {
  const candidates = [
    {
      symbol: "AAPL",
      p3GateOk: true,
      confidence: 0.4,
      compositeConfidence: 0.32,
      qualityOverall: 0.8,
      rsi: 55,
    },
    {
      symbol: "SPY",
      p3GateOk: true,
      confidence: 0.5,
      compositeConfidence: 0.45,
      qualityOverall: 0.9,
      rsi: 35,
    },
  ];

  const ranked = rankScannerCandidates(candidates);

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].symbol, "SPY");
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].symbol, "AAPL");
  assert.equal(ranked[1].rank, 2);
  assert.ok(ranked[0].setupScore > ranked[1].setupScore);
});

test("rankScannerCandidates penalizes invalid P3 gate candidates", () => {
  const candidates = [
    {
      symbol: "GOOD",
      p3GateOk: true,
      confidence: 0.4,
      compositeConfidence: 0.32,
      qualityOverall: 0.8,
      rsi: 50,
    },
    {
      symbol: "BAD",
      p3GateOk: false,
      confidence: 0.9,
      compositeConfidence: 0.9,
      qualityOverall: 1,
      rsi: 30,
    },
  ];

  const ranked = rankScannerCandidates(candidates);

  assert.equal(ranked[0].symbol, "GOOD");
  assert.equal(ranked[1].symbol, "BAD");
  assert.ok(ranked[1].reason.includes("invalid P3 gate"));
});

test("rankScannerCandidates is deterministic and stable on ties", () => {
  const candidates = [
    {
      symbol: "MSFT",
      p3GateOk: true,
      confidence: 0.4,
      compositeConfidence: 0.32,
      qualityOverall: 0.8,
      rsi: 50,
    },
    {
      symbol: "AAPL",
      p3GateOk: true,
      confidence: 0.4,
      compositeConfidence: 0.32,
      qualityOverall: 0.8,
      rsi: 50,
    },
  ];

  const ranked = rankScannerCandidates(candidates);

  assert.deepEqual(
    ranked.map((item) => item.symbol),
    ["AAPL", "MSFT"]
  );
});
