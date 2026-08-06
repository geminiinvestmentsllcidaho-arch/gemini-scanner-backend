import test from "node:test";
import assert from "node:assert/strict";
import { VERSION, buildPremarketOutcomeValidationFromHistoryReadonly } from "../src/scanner/premarket_outcome_validation_adapter_readonly.mjs";

const scan = (at, score) => ({
  scanId: `pre-${at}`,
  generatedAt: at,
  candidates: [{ symbol: "EQNR", decision: "WATCH", premarketPotentialScore: score, spreadPct: 0.4, dollarVolume: 2_000_000, sourceStale: false }],
});

test("adapts persisted premarket scans and regular-session outcomes into validation evidence", () => {
  const report = buildPremarketOutcomeValidationFromHistoryReadonly({
    generatedAt: "2026-08-06T20:00:00.000Z",
    minimumObservedSample: 1,
    premarketScans: [scan("2026-08-06T12:00:00.000Z", 70), scan("2026-08-06T12:10:00.000Z", 72), scan("2026-08-06T12:20:00.000Z", 74)],
    opportunityOutcomeReport: {
      outcomes: [
        { symbol: "EQNR", decision: "WATCH", entryPrice: 10, latestPrice: 10.2, latestReturnPct: 2, maxFavorablePct: 3, maxAdversePct: -0.5, observations: 4, originObservable: true, originSourceStale: false },
        { symbol: "BAPE", decision: "WAIT", entryPrice: 10, latestPrice: 10.05, latestReturnPct: 0.5, maxFavorablePct: 0.8, maxAdversePct: -0.4, observations: 4, originObservable: true, originSourceStale: false },
      ],
    },
  });
  assert.equal(report.adapterVersion, VERSION);
  assert.equal(report.sourcePremarketScanCount, 3);
  assert.equal(report.matchedTrackedOutcomeCount, 1);
  assert.equal(report.baselineOutcomeCount, 1);
  assert.equal(report.confirmedSummary.observedCount, 1);
  assert.equal(report.baselineSummary.observedCount, 1);
  assert.equal(report.comparison.returnLiftPctPoints, 1.5);
  assert.equal(report.evidenceState, "POSITIVE_PREMARKET_SIGNAL");
});

test("fails closed for unobserved outcomes and preserves all mutation locks", () => {
  const report = buildPremarketOutcomeValidationFromHistoryReadonly({
    minimumObservedSample: 1,
    premarketScans: [scan("2026-08-06T12:00:00.000Z", 70), scan("2026-08-06T12:10:00.000Z", 72), scan("2026-08-06T12:20:00.000Z", 74)],
    opportunityOutcomeReport: {outcomes: [{ symbol: "EQNR", decision: "WATCH", entryPrice: 10, latestPrice: 11, observations: 0, originObservable: true, originSourceStale: false }]},
  });
  assert.equal(report.confirmedSummary.observedCount, 0);
  assert.equal(report.sufficientSample, false);
  assert.equal(report.evidenceState, "INSUFFICIENT_SAMPLE");
  assert.equal(report.automaticLearningAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test("prefers complete fresh outcomes over later pending rows for the same symbol", () => {
  const report = buildPremarketOutcomeValidationFromHistoryReadonly({
    generatedAt: "2026-08-06T21:00:00.000Z",
    minimumObservedSample: 1,
    premarketScans: [
      scan("2026-08-06T12:00:00.000Z", 72),
      scan("2026-08-06T12:10:00.000Z", 74),
      scan("2026-08-06T12:20:00.000Z", 76),
    ],
    opportunityOutcomeReport: {
      outcomes: [
        { symbol: "EQNR", decision: "WATCH", entryPrice: 10, latestPrice: 10.2, latestReturnPct: 2, maxFavorablePct: 2, maxAdversePct: 0, observations: 1, originObservable: true, originSourceStale: false, latestEventAt: "2026-08-06T14:00:00.000Z" },
        { symbol: "EQNR", decision: "WATCH", entryPrice: 10.2, latestPrice: null, latestReturnPct: null, maxFavorablePct: 0, maxAdversePct: 0, observations: 0, originObservable: true, originSourceStale: false, originEventAt: "2026-08-06T14:00:00.000Z" },
        { symbol: "BAPE", decision: "WATCH", entryPrice: 10, latestPrice: 10.05, latestReturnPct: 0.5, maxFavorablePct: 0.5, maxAdversePct: 0, observations: 1, originObservable: true, originSourceStale: false, latestEventAt: "2026-08-06T14:00:00.000Z" },
        { symbol: "BAPE", decision: "WATCH", entryPrice: 10.05, latestPrice: null, latestReturnPct: null, maxFavorablePct: 0, maxAdversePct: 0, observations: 0, originObservable: true, originSourceStale: false, originEventAt: "2026-08-06T14:00:00.000Z" },
      ],
    },
  });

  assert.equal(report.matchedTrackedOutcomeCount, 1);
  assert.equal(report.baselineOutcomeCount, 1);
  assert.equal(report.confirmedSummary.observedCount, 1);
  assert.equal(report.baselineSummary.observedCount, 1);
  assert.equal(report.linkedCandidates[0].spanMinutes, 20);
  assert.equal(report.linkedCandidates[0].sessionObservation.latestPrice, 10.2);
  assert.equal(report.linkedCandidates[0].sessionObservation.latestReturnPct, 2);
  assert.equal(report.linkedCandidates[0].sessionObservation.sourceFresh, true);
  assert.equal(report.sufficientSample, true);
});
