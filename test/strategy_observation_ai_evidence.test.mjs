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
  assert.equal("secret" in evidence.observations[0], false);
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
