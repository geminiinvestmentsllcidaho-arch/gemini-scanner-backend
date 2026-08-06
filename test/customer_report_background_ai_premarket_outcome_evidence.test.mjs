import test from "node:test";
import assert from "node:assert/strict";
import { buildBoundedPremarketOutcomeAiEvidence } from "../src/scanner/customer_report_background_ai_review_runner.mjs";

test("bounds premarket outcome evidence for AI review without mutation permissions", () => {
  const evidence = buildBoundedPremarketOutcomeAiEvidence({
    generatedAt: "2026-08-06T04:00:00.000Z",
    evidenceState: "POSITIVE_PREMARKET_SIGNAL",
    sufficientSample: true,
    minimumObservedSample: 20,
    confirmedSummary: { candidateCount: 30, observedCount: 25, favorableRatePct: 72, averageLatestReturnPct: 1.4 },
    baselineSummary: { candidateCount: 40, observedCount: 30, favorableRatePct: 50, averageLatestReturnPct: 0.3 },
    comparison: { returnLiftPctPoints: 1.1, favorableRateLiftPctPoints: 22 },
    linkedCandidates: Array.from({ length: 30 }, (_, index) => ({
      symbol: `SYM${index}`,
      consolidationStatus: "confirmed_watch_candidate",
      confirmed: true,
      observations: 12,
      spanMinutes: 35,
      latestScore: 80,
      outcomeClassification: "FAVORABLE_FOLLOW_THROUGH",
      sessionObservation: { latestReturnPct: 1.5, maxFavorablePct: 2.5, maxAdversePct: -0.4, sourceFresh: true },
    })),
  });

  assert.equal(evidence.evidenceState, "POSITIVE_PREMARKET_SIGNAL");
  assert.equal(evidence.confirmedSummary.observedCount, 25);
  assert.equal(evidence.baselineSummary.observedCount, 30);
  assert.equal(evidence.comparison.returnLiftPctPoints, 1.1);
  assert.equal(evidence.candidates.length, 25);
  assert.equal(evidence.readOnly, true);
  assert.equal(evidence.automaticLearningAllowed, false);
  assert.equal(evidence.scannerLogicMutationAllowed, false);
  assert.equal(evidence.thresholdMutationAllowed, false);
  assert.equal(evidence.orderPlacementAllowed, false);
  assert.equal(evidence.brokerContactAllowed, false);
  assert.equal(evidence.accountMutationAllowed, false);
});

test("preserves unavailable bounded premarket metrics as null instead of synthetic zero", () => {
  const evidence = buildBoundedPremarketOutcomeAiEvidence({
    confirmedSummary: { favorableRatePct: null, averageLatestReturnPct: null },
    baselineSummary: { favorableRatePct: undefined, averageLatestReturnPct: "" },
    comparison: { returnLiftPctPoints: null, favorableRateLiftPctPoints: undefined },
    linkedCandidates: [{
      symbol: "EQNR",
      spanMinutes: null,
      latestScore: undefined,
      sessionObservation: { latestReturnPct: null, maxFavorablePct: undefined, maxAdversePct: "" },
    }],
  });

  assert.equal(evidence.confirmedSummary.favorableRatePct, null);
  assert.equal(evidence.confirmedSummary.averageLatestReturnPct, null);
  assert.equal(evidence.baselineSummary.favorableRatePct, null);
  assert.equal(evidence.baselineSummary.averageLatestReturnPct, null);
  assert.equal(evidence.comparison.returnLiftPctPoints, null);
  assert.equal(evidence.comparison.favorableRateLiftPctPoints, null);
  assert.equal(evidence.candidates[0].spanMinutes, null);
  assert.equal(evidence.candidates[0].latestScore, null);
  assert.equal(evidence.candidates[0].latestReturnPct, null);
  assert.equal(evidence.candidates[0].maxFavorablePct, null);
  assert.equal(evidence.candidates[0].maxAdversePct, null);
});
