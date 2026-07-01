import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendMarketClosedSnapshotRecord,
  buildMarketClosedSnapshotStoreRecord
} from "../../src/scanner/market_closed_scanner_snapshot_store.mjs";

const fixture = {
  ok: true,
  version: "fixture_v1",
  displayState: "CAUTION",
  issues: ["scanner_degraded"],
  scanner: {
    scannerHealth: "degraded",
    rankingConfidence: 0.25,
    totalRankings: 2,
    top: [{ symbol: "MSFT" }, { symbol: "NVDA" }]
  }
};

test("market closed snapshot store record stays safe and local-only", () => {
  const record = buildMarketClosedSnapshotStoreRecord(fixture, {
    nowIso : "2026-07-01T00:00:00.000Z"
  });

  assert.equal(record.ok, true);
  assert.equal(record.monitorOnly, true);
  assert.equal(record.diagnosticsOnly, true);
  assert.equal(record.localStoreOnly, true);
  assert.equal(record.brokerContactAllowed, false);
  assert.equal(record.orderPlacementAllowed, false);
  assert.equal(record.liveTradingAllowed, false);
  assert.equal(record.accountMutationAllowed, false);
  assert.deepEqual(record.topSymbols, ["MSFT", "NVDA"]);
});

test("market closed snapshot store appends jsonl locally", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-mcss-store-"));
  const ledgerPath = path.join(dir, "ledger.jsonl");

  const result = appendMarketClosedSnapshotRecord(fixture, {
    ledgerPath,
    nowIso: "2026-07-01T00:00:00.000Z"
  });

  const lines = fs.readFileSync(ledgerPath, "utf8").trim().split("\n");
  assert.equal(result.appended, true);
  assert.equal(lines.length, 1);
  const saved = JSON.parse(lines[0]);
  assert.equal(saved.orderPlacementAllowed, false);
  assert.equal(saved.localStoreOnly, true);
});
