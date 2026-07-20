import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  VERSION,
  runStrategyObservationPersistence,
} from "../src/scanner/strategy_observation_persistence_runner.mjs";
import {
  listStrategyObservationRecords,
} from "../src/scanner/strategy_observation_store.mjs";

function auditRecord(eventAt, scanId, price, extras = {}) {
  return Object.freeze({
    eventAt,
    scanId,
    scanner: "alpaca_under_five_shared",
    scanType: "under_five",
    marketOpen: true,
    candidates: Object.freeze([
      Object.freeze({
        symbol: "ABC",
        price,
        decision: "ENTER",
        resultState: "ENTER",
        sourceStale: false,
        rankingConfidence: 0.8,
        readonlyPotentialScore: 82,
      }),
    ]),
    ...extras,
  });
}

test("builds and persists time-based strategy observations from newest-first audit history", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-strategy-persist-"));
  const observationPath = path.join(dir, "strategy.jsonl");
  const newestFirst = [
    auditRecord("2026-07-20T14:35:00.000Z", "scan-3", 10.8),
    auditRecord("2026-07-20T14:05:00.000Z", "scan-2", 10.5),
    auditRecord("2026-07-20T13:30:00.000Z", "scan-1", 10),
  ];

  const result = runStrategyObservationPersistence({
    auditRecords: newestFirst,
    observationPath,
    now: new Date("2026-07-20T15:00:00.000Z"),
    intradayMinutes: 30,
  });

  assert.equal(result.version, VERSION);
  assert.equal(result.auditRecordCount, 3);
  assert.equal(result.outcomeCount, 3);
  assert.equal(result.appendedCount, 3);

  const stored = listStrategyObservationRecords({ observationPath, maxRecords: 10 });
  assert.equal(stored.length, 3);
  const origin = stored.find((row) => row.originScanId === "scan-1");
  assert.equal(origin.horizonObservations.intraday, 2);
  assert.equal(origin.latestReturnPct, 8);
  assert.equal(origin.readOnly, true);
  assert.equal(origin.orderPlacementAllowed, false);
});


test("suppresses identical reruns and appends only materially changed outcomes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-strategy-change-aware-"));
  const observationPath = path.join(dir, "strategy.jsonl");
  const firstHistory = [
    auditRecord("2026-07-20T14:05:00.000Z", "scan-2", 10.5),
    auditRecord("2026-07-20T13:30:00.000Z", "scan-1", 10),
  ];

  const first = runStrategyObservationPersistence({
    auditRecords: firstHistory,
    observationPath,
    now: new Date("2026-07-20T15:00:00.000Z"),
    intradayMinutes: 30,
  });
  assert.equal(first.changedOutcomeCount, 2);
  assert.equal(first.skippedUnchangedCount, 0);
  assert.equal(first.appendedCount, 2);

  const identical = runStrategyObservationPersistence({
    auditRecords: firstHistory,
    observationPath,
    now: new Date("2026-07-20T15:15:00.000Z"),
    intradayMinutes: 30,
  });
  assert.equal(identical.outcomeCount, 2);
  assert.equal(identical.changedOutcomeCount, 0);
  assert.equal(identical.skippedUnchangedCount, 2);
  assert.equal(identical.appendedCount, 0);
  assert.equal(listStrategyObservationRecords({ observationPath, maxRecords: 20 }).length, 2);

  const updated = runStrategyObservationPersistence({
    auditRecords: [
      auditRecord("2026-07-20T14:35:00.000Z", "scan-3", 10.8),
      ...firstHistory,
    ],
    observationPath,
    now: new Date("2026-07-20T15:30:00.000Z"),
    intradayMinutes: 30,
  });

  assert.equal(updated.outcomeCount, 3);
  assert.equal(updated.changedOutcomeCount, 3);
  assert.equal(updated.skippedUnchangedCount, 0);
  assert.equal(updated.appendedCount, 3);

  const stored = listStrategyObservationRecords({ observationPath, maxRecords: 20 });
  assert.equal(stored.length, 5);
  const scan1Snapshots = stored.filter((row) => row.originScanId === "scan-1");
  assert.equal(scan1Snapshots.length, 2);
  assert.equal(scan1Snapshots[0].horizonObservations.intraday, 2);
  assert.equal(scan1Snapshots[0].latestReturnPct, 8);
});

test("supports preview-only persistence without writing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-strategy-preview-"));
  const observationPath = path.join(dir, "strategy.jsonl");

  const result = runStrategyObservationPersistence({
    auditRecords: [
      auditRecord("2026-07-20T14:05:00.000Z", "scan-2", 10.5),
      auditRecord("2026-07-20T13:30:00.000Z", "scan-1", 10),
    ],
    observationPath,
    now: new Date("2026-07-20T15:00:00.000Z"),
    persist: false,
  });

  assert.equal(result.outcomeCount, 2);
  assert.equal(result.changedOutcomeCount, 2);
  assert.equal(result.skippedUnchangedCount, 0);
  assert.equal(result.appendedCount, 0);
  assert.equal(result.persistence.previewOnly, true);
  assert.equal(fs.existsSync(observationPath), false);
});

test("keeps learning mutation broker and execution locks closed", () => {
  const result = runStrategyObservationPersistence({
    auditRecords: [],
    now: new Date("2026-07-20T15:00:00.000Z"),
    persist: false,
  });

  assert.equal(result.readOnly, true);
  assert.equal(result.paperOnly, true);
  assert.equal(result.shadowOnly, true);
  assert.equal(result.historicalMeasurementOnly, true);
  assert.equal(result.localStoreOnly, true);
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.automaticPatchAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.liveTradingAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});
