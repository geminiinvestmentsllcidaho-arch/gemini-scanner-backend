import test from "node:test";
import assert from "node:assert/strict";
import { VERSION, buildPremarketOutcomeValidationReadonly } from "../src/scanner/premarket_outcome_validation_readonly.mjs";

test("links confirmed premarket candidates to regular-session outcomes and baseline evidence", () => {
  const report = buildPremarketOutcomeValidationReadonly({
    generatedAt: "2026-08-06T04:00:00.000Z",
    minimumObservedSample: 1,
    premarketCandidates: [
      { symbol: "EQNR", consolidationStatus: "confirmed_watch_candidate", observations: 100, spanMinutes: 48.97, latestScore: 84 },
      { symbol: "TSDD", consolidationStatus: "improving_watch_candidate", observations: 91, spanMinutes: 44.48, latestScore: 72 },
    ],
    regularSessionObservations: [
      { symbol: "EQNR", referencePrice: 10, latestPrice: 10.2, sessionHigh: 10.4, sessionLow: 9.95, sourceFresh: true, regularDecisionState: "WATCH" },
      { symbol: "TSDD", referencePrice: 20, latestPrice: 19.7, sessionHigh: 20.1, sessionLow: 19.6, sourceFresh: true, regularDecisionState: "DO_NOT_ENTER" },
    ],
    baselineObservations: [
      { symbol: "BASE", referencePrice: 10, latestPrice: 10.05, sessionHigh: 10.1, sessionLow: 9.9, sourceFresh: true },
    ],
  });
  assert.equal(report.version, VERSION);
  assert.equal(report.linkedCandidates.length, 2);
  assert.equal(report.linkedCandidates[0].symbol, "EQNR");
  assert.equal(report.linkedCandidates[0].outcomeClassification, "FAVORABLE_FOLLOW_THROUGH");
  assert.equal(report.linkedCandidates[0].sessionObservation.maxFavorablePct, 4);
  assert.equal(report.linkedCandidates[0].sessionObservation.maxAdversePct, -0.5);
  assert.equal(report.confirmedSummary.observedCount, 1);
  assert.equal(report.improvingSummary.observedCount, 1);
  assert.equal(report.baselineSummary.observedCount, 1);
  assert.equal(report.comparison.returnLiftPctPoints, 1.5);
  assert.equal(report.evidenceState, "POSITIVE_PREMARKET_SIGNAL");
});

test("fails closed when confirmed and baseline samples are too small", () => {
  const report = buildPremarketOutcomeValidationReadonly({
    minimumObservedSample: 20,
    premarketCandidates: [{ symbol: "SKHX", consolidationStatus: "confirmed_watch_candidate" }],
    regularSessionObservations: [{ symbol: "SKHX", referencePrice: 5, latestPrice: 5.2, sessionHigh: 5.3, sessionLow: 4.9, sourceFresh: true }],
  });
  assert.equal(report.sufficientSample, false);
  assert.equal(report.evidenceState, "INSUFFICIENT_SAMPLE");
  assert.equal(report.comparison.returnLiftPctPoints, null);
});

test("keeps stale, missing, and incomplete outcomes out of observed metrics", () => {
  const report = buildPremarketOutcomeValidationReadonly({
    minimumObservedSample: 1,
    premarketCandidates: [
      { symbol: "AAA", consolidationStatus: "confirmed_watch_candidate" },
      { symbol: "BBB", consolidationStatus: "confirmed_watch_candidate" },
      { symbol: "CCC", consolidationStatus: "confirmed_watch_candidate" },
    ],
    regularSessionObservations: [
      { symbol: "AAA", referencePrice: 10, latestPrice: 11, sessionHigh: 11, sessionLow: 9.8, sourceFresh: false },
      { symbol: "BBB", latestPrice: 11, sourceFresh: true },
    ],
  });
  assert.equal(report.confirmedSummary.observedCount, 0);
  assert.equal(report.linkedCandidates[0].outcomeClassification, "STALE_REGULAR_SESSION_EVIDENCE");
  assert.equal(report.linkedCandidates[1].outcomeClassification, "INCOMPLETE_REGULAR_SESSION_EVIDENCE");
  assert.equal(report.linkedCandidates[2].outcomeClassification, "PENDING_REGULAR_SESSION_EVIDENCE");
});

test("keeps AI review and execution or mutation permissions locked", () => {
  const report = buildPremarketOutcomeValidationReadonly();
  assert.equal(report.readOnly, true);
  assert.equal(report.paperOnly, true);
  assert.equal(report.decisionAssistOnly, true);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.automaticThresholdChangeAllowed, false);
  assert.deepEqual(report.aiEvidence.safeguards, {
    readOnly: true,
    mayRecommendManualReview: true,
    mayChangeScannerLogic: false,
    mayApproveProposal: false,
    mayPlaceTrade: false,
  });
});

test("retains legacy improving_watch compatibility", () => {
  const report = buildPremarketOutcomeValidationReadonly({
    premarketCandidates: [{ symbol: "LEGACY", consolidationStatus: "improving_watch" }],
  });
  assert.equal(report.linkedCandidates.length, 1);
  assert.equal(report.linkedCandidates[0].confirmed, false);
});
