import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  VERSION,
  appendStrategyObservationRecord,
  appendStrategyObservationReport,
  buildStrategyObservationRecord,
  listStrategyObservationRecords,
} from "../src/scanner/strategy_observation_store.mjs";

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-strategy-observation-"));
  return {
    dir,
    observationPath: path.join(dir, "observations.jsonl"),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("builds stable read-only strategy observation records", () => {
  const record = buildStrategyObservationRecord({
    originScanId: "scan-1",
    originEventAt: "2026-07-19T14:00:00.000Z",
    symbol: "abc",
    scanner: "alpaca_under_five_shared",
    decision: "ENTER",
    entryPrice: 10,
    latestPrice: 10.5,
    observations: 4,
    latestReturnPct: 5,
    maxFavorablePct: 7,
    maxAdversePct: -2,
    originObservable: true,
  }, {
    now: "2026-07-19T22:00:00.000Z",
  });

  assert.equal(record.version, VERSION);
  assert.equal(record.key, "scan-1:ABC");
  assert.equal(record.strategyType, "intraday");
  assert.equal(record.symbol, "ABC");
  assert.equal(record.readOnly, true);
  assert.equal(record.paperOnly, true);
  assert.equal(record.shadowOnly, true);
  assert.equal(record.orderPlacementAllowed, false);
  assert.equal(record.accountMutationAllowed, false);
  assert.equal(Object.isFrozen(record), true);
});

test("persists private local jsonl records and reads newest first", () => {
  const f = fixture();
  try {
    appendStrategyObservationRecord({
      key: "scan-1:ABC",
      symbol: "ABC",
      decision: "ENTER",
    }, {
      observationPath: f.observationPath,
      now: "2026-07-19T22:00:00.000Z",
    });
    appendStrategyObservationRecord({
      key: "scan-2:XYZ",
      symbol: "XYZ",
      strategyType: "swing",
      decision: "WAIT",
    }, {
      observationPath: f.observationPath,
      now: "2026-07-19T22:01:00.000Z",
    });

    const records = listStrategyObservationRecords({
      observationPath: f.observationPath,
    });

    assert.equal(records.length, 2);
    assert.equal(records[0].key, "scan-2:XYZ");
    assert.equal(records[1].key, "scan-1:ABC");
    assert.equal(fs.statSync(f.observationPath).mode & 0o777, 0o600);
  } finally {
    f.cleanup();
  }
});

test("appends bounded outcome reports without enabling learning or execution", () => {
  const f = fixture();
  try {
    const result = appendStrategyObservationReport({
      generatedAt: "2026-07-19T22:02:00.000Z",
      outcomes: [
        {
          key: "scan-3:AAA",
          symbol: "AAA",
          scanner: "premarket",
          decision: "ENTER",
          latestReturnPct: 1.2,
        },
        {
          key: "scan-3:BBB",
          symbol: "BBB",
          strategyType: "swing",
          decision: "WAIT",
          horizonObservations: { swing_3_5_day: 2 },
        },
      ],
    }, {
      observationPath: f.observationPath,
    });

    assert.equal(result.appendedCount, 2);
    assert.equal(result.records[0].strategyType, "intraday");
    assert.equal(result.records[1].strategyType, "swing");
    assert.equal(result.records[1].horizonObservations.swing_3_5_day, 2);
    assert.equal(result.brokerContactAllowed, false);
    assert.equal(result.orderPlacementAllowed, false);
    assert.equal(result.accountMutationAllowed, false);
  } finally {
    f.cleanup();
  }
});

test("returns immutable empty history when observation file is missing", () => {
  const f = fixture();
  try {
    const records = listStrategyObservationRecords({
      observationPath: f.observationPath,
    });
    assert.deepEqual(records, []);
    assert.equal(Object.isFrozen(records), true);
  } finally {
    f.cleanup();
  }
});
