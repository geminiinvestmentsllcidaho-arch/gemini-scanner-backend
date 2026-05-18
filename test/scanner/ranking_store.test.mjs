import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readScannerRankings } from "../../src/scanner/ranking_store.mjs";

test("readScannerRankings reads latest dryrun file and ranks latest row per symbol", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.1, compositeConfidence: 0.1, qualityOverall: 0.8, rsi: 50 }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.1, compositeConfidence: 0.1, qualityOverall: 0.8, rsi: 50 }),
      JSON.stringify({ ts: "2026-01-01T00:02:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.5, compositeConfidence: 0.5, qualityOverall: 0.9, rsi: 30 }),
      JSON.stringify({ ts: "2026-01-01T00:02:00.000Z", symbol: "SPY", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.4, compositeConfidence: 0.4, qualityOverall: 0.8, rsi: 45 }),
      JSON.stringify({ ts: "2026-01-01T00:02:00.000Z", symbol: "BAD", ok: false, httpStatus: 500, p3GateOk: false }),
    ].join("\n")
  );

  const out = readScannerRankings({ dryrunsDir: dir });

  assert.equal(out.ok, true);
  assert.equal(out.count, 2);
  assert.deepEqual(
    out.rankings.map((item) => item.symbol),
    ["AAPL", "SPY"]
  );
  assert.equal(out.rankings[0].rank, 1);
});

test("readScannerRankings returns empty rankings when no dryrun file exists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-empty-"));
  const out = readScannerRankings({ dryrunsDir: dir });

  assert.equal(out.ok, true);
  assert.equal(out.source, null);
  assert.equal(out.sourceTs, null);
  assert.equal(out.sourceAgeSec, null);
  assert.equal(out.maxAgeSec, 180);
  assert.equal(out.stale, true);
  assert.deepEqual(out.issues, ["SCANNER_TELEMETRY_STALE"]);
  assert.equal(out.count, 0);
  assert.deepEqual(out.rankings, []);
});

test("readScannerRankings exposes freshness metadata", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-freshness-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "SPY",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        confidence: 0.5,
        compositeConfidence: 0.5,
        qualityOverall: 0.9,
        rsi: 50,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    maxAgeSec: 180,
  });

  assert.equal(out.stale, false);
  assert.equal(out.sourceAgeSec, 60);
  assert.equal(out.maxAgeSec, 180);
  assert.deepEqual(out.issues, []);
});

test("readScannerRankings marks stale rankings deterministically", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-stale-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "SPY",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        confidence: 0.5,
        compositeConfidence: 0.5,
        qualityOverall: 0.9,
        rsi: 50,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:10:00.000Z"),
    maxAgeSec: 180,
  });

  assert.equal(out.stale, true);
  assert.equal(out.sourceAgeSec, 600);
  assert.deepEqual(out.issues, ["SCANNER_TELEMETRY_STALE"]);
});
