import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildMultiHorizonStrategyEvaluationReport,
} from "../src/scanner/multi_horizon_strategy_evaluator.mjs";

test("evaluates intraday next-day and swing horizons without enabling execution", () => {
  const report = buildMultiHorizonStrategyEvaluationReport({
    outcomes: [{
      key: "scan-1:ABC",
      symbol: "ABC",
      scanner: "alpaca_under_five_shared",
      decision: "ENTER",
      originObservable: true,
      rankingConfidence: 0.82,
      horizonObservations: {
        intraday: 4,
        next_day: 1,
        swing_3_5_day: 3,
      },
      horizonReturnsPct: {
        intraday: 0.8,
        next_day: 1.4,
        swing_3_5_day: 2.5,
      },
      horizonMaxFavorablePct: {
        intraday: 1,
        next_day: 1.8,
        swing_3_5_day: 3,
      },
      horizonMaxAdversePct: {
        intraday: -0.3,
        next_day: -0.8,
        swing_3_5_day: -1.5,
      },
    }],
  }, {
    now: "2026-07-19T21:00:00.000Z",
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.candidateCount, 1);
  assert.equal(report.horizonCount, 3);
  assert.deepEqual(
    report.evaluations[0].horizons.map((row) => row.status),
    ["TARGET_MET", "TARGET_MET", "TARGET_MET"],
  );
  assert.equal(report.strategySummaries[0].strategyType, "intraday");
  assert.equal(report.strategySummaries[0].promotionEligible, false);
  assert.equal(report.profitabilityGuaranteed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.liveTradingAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test("detects risk breaches exit timing review and pending evidence", () => {
  const report = buildMultiHorizonStrategyEvaluationReport([{
    key: "scan-2:XYZ",
    symbol: "XYZ",
    strategyType: "swing",
    decision: "ENTER",
    horizonObservations: {
      intraday: 4,
      next_day: 1,
      swing_3_5_day: 1,
    },
    horizonReturnsPct: {
      intraday: -0.2,
      next_day: 0.3,
      swing_3_5_day: 4,
    },
    horizonMaxFavorablePct: {
      intraday: 0.9,
      next_day: 0.6,
      swing_3_5_day: 4,
    },
    horizonMaxAdversePct: {
      intraday: -1.2,
      next_day: -0.4,
      swing_3_5_day: -0.5,
    },
  }]);

  assert.deepEqual(
    report.evaluations[0].horizons.map((row) => row.status),
    ["RISK_LIMIT_BREACH", "TARGET_NOT_MET", "PENDING"],
  );
  assert.equal(report.horizonStatusCounts.RISK_LIMIT_BREACH, 1);
  assert.equal(report.horizonStatusCounts.TARGET_NOT_MET, 1);
  assert.equal(report.horizonStatusCounts.PENDING, 1);
  assert.equal(report.readinessState, "OBSERVATION_AND_SHADOW_VALIDATION");
});

test("keeps all learning mutation and broker locks closed", () => {
  const report = buildMultiHorizonStrategyEvaluationReport([]);

  assert.equal(report.automaticLearningAllowed, false);
  assert.equal(report.automaticPatchAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.promotionEligible, false);
});
