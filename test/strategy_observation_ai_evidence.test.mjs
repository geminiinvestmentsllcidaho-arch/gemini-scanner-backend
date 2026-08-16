import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildBoundedStrategyObservationAiEvidence,
} from "../src/scanner/strategy_observation_ai_evidence.mjs";

test("bounds deduplicates and summarizes latest strategy observations", () => {
  const evidence = buildBoundedStrategyObservationAiEvidence([
    {
      key: "scan-1:AAA",
      originScanId: "scan-1",
      observedAt: "2026-07-20T20:00:00.000Z",
      symbol: "AAA",
      latestReturnPct: 8,
      originObservable: true,
      originSourceStale: false,
      rankingConnected: true,
      rankingP3GateOk: true,
      rankingSetupScore: 82,
      rankingConfidence: 0.8,
      rankingQuality: 0.9,
      readonlyPotentialScore: 84,
      strategyAuthorization: {
        version: "paper_auto_execution_strategy_authorization_v1",
        authorized: true,
        state: "ENTER",
        rankingSetupScore: 82,
        rankingConfidence: 0.8,
        rankingQuality: 0.9,
        minimums: {
          setupScore: 70,
          rankingConfidence: 0.5,
          rankingQuality: 0.65,
        },
        blockers: [],
        symbolLevelOnly: true,
        portfolioRootAuthorizationUsed: false,
        paperOnly: true,
        secret: "must-not-pass",
      },
      secret: "must-not-pass",
    },
    {
      key: "scan-1:AAA",
      originScanId: "scan-1",
      observedAt: "2026-07-20T19:00:00.000Z",
      symbol: "AAA",
      latestReturnPct: 5,
      originObservable: true,
    },
    {
      key: "scan-2:BBB",
      originScanId: "scan-2",
      observedAt: "2026-07-20T20:00:00.000Z",
      symbol: "BBB",
      latestReturnPct: -2,
      originObservable: true,
      originSourceStale: true,
    },
  ]);

  assert.equal(evidence.version, VERSION);
  assert.equal(evidence.sourceRecordCount, 3);
  assert.equal(evidence.uniqueObservationCount, 2);
  assert.equal(evidence.observableCount, 2);
  assert.equal(evidence.staleSourceCount, 1);
  assert.equal(evidence.measuredReturnCount, 2);
  assert.equal(evidence.positiveReturnCount, 1);
  assert.equal(evidence.negativeReturnCount, 1);
  assert.equal(evidence.averageLatestReturnPct, 3);
  assert.equal(evidence.observations[0].latestReturnPct, 8);
  assert.equal(evidence.observations[0].rankingConnected, true);
  assert.equal(evidence.observations[0].rankingP3GateOk, true);
  assert.equal(evidence.observations[0].rankingSetupScore, 82);
  assert.equal(evidence.observations[0].rankingConfidence, 0.8);
  assert.equal(evidence.observations[0].rankingQuality, 0.9);
  assert.equal(evidence.observations[0].readonlyPotentialScore, 84);
  assert.equal(
    evidence.observations[0].strategyAuthorization.version,
    "paper_auto_execution_strategy_authorization_v1",
  );
  assert.equal(evidence.observations[0].strategyAuthorization.authorized, true);
  assert.deepEqual(evidence.observations[0].strategyAuthorization.minimums, {
    setupScore: 70,
    rankingConfidence: 0.5,
    rankingQuality: 0.65,
  });
  assert.equal(
    evidence.observations[0].strategyAuthorization.portfolioRootAuthorizationUsed,
    false,
  );
  assert.equal("secret" in evidence.observations[0], false);
  assert.equal("secret" in evidence.observations[0].strategyAuthorization, false);
});

test("keeps all learning mutation broker and execution locks closed", () => {
  const evidence = buildBoundedStrategyObservationAiEvidence([]);
  assert.equal(evidence.readOnly, true);
  assert.equal(evidence.paperOnly, true);
  assert.equal(evidence.shadowOnly, true);
  assert.equal(evidence.historicalMeasurementOnly, true);
  assert.equal(evidence.localStoreOnly, true);
  assert.equal(evidence.automaticLearningAllowed, false);
  assert.equal(evidence.automaticPatchAllowed, false);
  assert.equal(evidence.scannerLogicMutationAllowed, false);
  assert.equal(evidence.thresholdMutationAllowed, false);
  assert.equal(evidence.orderPlacementAllowed, false);
  assert.equal(evidence.brokerContactAllowed, false);
  assert.equal(evidence.accountMutationAllowed, false);
});
