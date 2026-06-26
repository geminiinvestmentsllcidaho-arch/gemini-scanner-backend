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
  assert.deepEqual(out.issues, ["SCANNER_LOW_CONFIDENCE"]);
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

test("readScannerRankings exposes healthy scanner health classification", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-health-healthy-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.8, compositeConfidence: 0.8, qualityOverall: 0.9, rsi: 50 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.7, compositeConfidence: 0.7, qualityOverall: 0.8, rsi: 50 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    maxAgeSec: 180,
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.scannerHealth, "healthy");
  assert.equal(out.rankingQuality, 0.85);
  assert.equal(out.rankingConfidence, 0.75);
  assert.equal(out.telemetryCoverage, 1);
  assert.deepEqual(out.issues, []);
});

test("readScannerRankings marks scanner health degraded on low coverage", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-health-coverage-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.8, compositeConfidence: 0.8, qualityOverall: 0.9, rsi: 50 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    maxAgeSec: 180,
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.scannerHealth, "degraded");
  assert.equal(out.telemetryCoverage, 0.5);
  assert.deepEqual(out.issues, ["SCANNER_LOW_COVERAGE"]);
});

test("readScannerRankings marks scanner health degraded on low aggregate confidence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-health-confidence-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.2, compositeConfidence: 0.2, qualityOverall: 0.9, rsi: 50 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.4, compositeConfidence: 0.4, qualityOverall: 0.9, rsi: 50 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    maxAgeSec: 180,
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.scannerHealth, "degraded");
  assert.equal(out.rankingConfidence, 0.3);
  assert.deepEqual(out.issues, ["SCANNER_LOW_CONFIDENCE"]);
});

test("readScannerRankings marks scanner health stale when rankings are stale", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-health-stale-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.8, compositeConfidence: 0.8, qualityOverall: 0.9, rsi: 50 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:10:00.000Z"),
    maxAgeSec: 180,
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.scannerHealth, "stale");
  assert.deepEqual(out.issues, ["SCANNER_TELEMETRY_STALE"]);
});

test("readScannerRankings exposes bullish consensus intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-consensus-bullish-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "buy",
        regime: "bullish",
        confidence: 0.9,
        compositeConfidence: 0.9,
        qualityOverall: 0.9,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "MSFT",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "buy",
        regime: "bullish",
        confidence: 0.8,
        compositeConfidence: 0.8,
        qualityOverall: 0.8,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "SPY",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "hold",
        regime: "bullish",
        confidence: 0.7,
        compositeConfidence: 0.7,
        qualityOverall: 0.8,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT", "SPY"],
  });

  assert.equal(out.marketRegime, "bullish");
  assert.equal(out.riskState, "low");
  assert.equal(out.signalDensity, 0.6667);
  assert.equal(out.marketBreadth, 0.6667);
  assert.equal(out.topSignals.length, 2);
  assert.deepEqual(out.issues, []);
});

test("readScannerRankings exposes fragmented mixed consensus intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-consensus-mixed-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "buy",
        regime: "bullish",
        confidence: 0.9,
        compositeConfidence: 0.9,
        qualityOverall: 0.9,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "TSLA",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "sell",
        regime: "bearish",
        confidence: 0.9,
        compositeConfidence: 0.9,
        qualityOverall: 0.9,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "SPY",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "hold",
        regime: "neutral",
        confidence: 0.5,
        compositeConfidence: 0.5,
        qualityOverall: 0.7,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "TSLA", "SPY"],
  });

  assert.equal(out.marketRegime, "mixed");
  assert.equal(out.riskState, "high");
  assert.equal(out.signalDensity, 0.6667);
  assert.equal(out.marketBreadth, 0);
  assert.ok(out.issues.includes("SCANNER_SIGNAL_FRAGMENTATION"));
});

test("readScannerRankings detects low signal density deterministically", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-signal-density-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "SPY",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "hold",
        regime: "neutral",
        confidence: 0.4,
        compositeConfidence: 0.4,
        qualityOverall: 0.8,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "QQQ",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "hold",
        regime: "neutral",
        confidence: 0.4,
        compositeConfidence: 0.4,
        qualityOverall: 0.8,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["SPY", "QQQ"],
  });

  assert.equal(out.signalDensity, 0);
  assert.equal(out.marketRegime, "neutral");
  assert.equal(out.riskState, "moderate");
  assert.ok(out.issues.includes("SCANNER_LOW_SIGNAL_DENSITY"));
});


test("readScannerRankings exposes strong adaptive consensus metrics", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-adaptive-strong-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        action: "buy",
        regime: "bullish",
        confidence: 0.9,
        compositeConfidence: 0.9,
        qualityOverall: 0.9,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "MSFT",
        ok: true,
        httpStatus: 200,
        action: "buy",
        regime: "bullish",
        confidence: 0.8,
        compositeConfidence: 0.8,
        qualityOverall: 0.8,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "NVDA",
        ok: true,
        httpStatus: 200,
        action: "buy",
        regime: "bullish",
        confidence: 0.85,
        compositeConfidence: 0.85,
        qualityOverall: 0.85,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT", "NVDA"],
  });

  assert.equal(out.consensusStrength, 0.85);
  assert.equal(out.directionalAlignment, 1);
  assert.equal(out.marketInternalQuality, 0.85);
  assert.equal(out.instabilityScore, 0);
  assert.equal(out.adaptiveRiskBias, "low");

  assert.deepEqual(out.issues, []);
});

test("readScannerRankings exposes elevated adaptive instability deterministically", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-adaptive-instability-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        action: "buy",
        regime: "bullish",
        confidence: 0.9,
        compositeConfidence: 0.9,
        qualityOverall: 0.9,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "TSLA",
        ok: true,
        httpStatus: 200,
        action: "sell",
        regime: "bearish",
        confidence: 0.3,
        compositeConfidence: 0.3,
        qualityOverall: 0.4,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "SPY",
        ok: true,
        httpStatus: 200,
        action: "hold",
        regime: "neutral",
        confidence: 0.4,
        compositeConfidence: 0.4,
        qualityOverall: 0.5,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "TSLA", "SPY"],
  });

  assert.equal(out.consensusStrength, 0.5333);
  assert.equal(out.directionalAlignment, 0);
  assert.equal(out.marketInternalQuality, 0.5667);

  assert.ok(out.instabilityScore > 0);
  assert.equal(out.adaptiveRiskBias, "severe");

  assert.ok(out.issues.includes("SCANNER_WEAK_CONSENSUS"));
  assert.ok(out.issues.includes("SCANNER_DIRECTIONAL_MISALIGNMENT"));
  assert.ok(out.issues.includes("SCANNER_INTERNAL_QUALITY_WEAK"));
  assert.ok(out.issues.includes("SCANNER_INSTABILITY_ELEVATED"));
});

test("readScannerRankings exposes improving temporal scanner intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-temporal-improving-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, action: "hold", regime: "neutral", confidence: 0.4, compositeConfidence: 0.4, qualityOverall: 0.6 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, action: "hold", regime: "neutral", confidence: 0.5, compositeConfidence: 0.5, qualityOverall: 0.6 }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.8, compositeConfidence: 0.8, qualityOverall: 0.9 }),
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.7, compositeConfidence: 0.7, qualityOverall: 0.8 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.temporalDirection, "improving");
  assert.equal(out.scannerTrend, "strengthening");
  assert.equal(out.consensusDelta, 0.3);
  assert.equal(out.riskDelta, -0.25);
  assert.deepEqual(out.temporalIssues, []);
});

test("readScannerRankings exposes deteriorating temporal scanner intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-temporal-deteriorating-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.8, compositeConfidence: 0.8, qualityOverall: 0.8 }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.3, compositeConfidence: 0.3, qualityOverall: 0.4 }),
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "TSLA", ok: true, httpStatus: 200, action: "sell", regime: "bearish", confidence: 0.3, compositeConfidence: 0.3, qualityOverall: 0.4 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT", "TSLA"],
  });

  assert.equal(out.temporalDirection, "deteriorating");
  assert.equal(out.scannerTrend, "weakening");
  assert.equal(out.consensusDelta, -0.55);
  assert.equal(out.riskDelta, 0.525);
  assert.ok(out.temporalIssues.includes("SCANNER_RISK_ACCELERATING"));
  assert.ok(out.issues.includes("SCANNER_RISK_ACCELERATING"));
});

test("readScannerRankings exposes stable persistence intelligence across rolling dryruns", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-persistence-stable-"));

  for (let i = 0; i < 4; i += 1) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-0${i}-00-000Z.jsonl`),
      [
        JSON.stringify({ ts: `2026-01-01T00:0${i}:00.000Z`, symbol: "AAPL", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.85, compositeConfidence: 0.85, qualityOverall: 0.9 }),
        JSON.stringify({ ts: `2026-01-01T00:0${i}:00.000Z`, symbol: "MSFT", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.8, compositeConfidence: 0.8, qualityOverall: 0.85 }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:04:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.regimePersistenceScore, 1);
  assert.equal(out.consensusStability, 1);
  assert.equal(out.trendPersistence, 1);
  assert.equal(out.regimeFlipRisk, 0);
  assert.equal(out.volatilityExpansionRisk, 0);
  assert.ok(!out.issues.includes("SCANNER_REGIME_UNSTABLE"));
});

test("readScannerRankings detects unstable persistence and volatility expansion", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-persistence-unstable-"));

  const files = [
    { t: "00", regimeA: "bullish", actionA: "buy", confA: 0.9, qA: 0.9, regimeB: "bullish", actionB: "buy", confB: 0.85, qB: 0.85 },
    { t: "01", regimeA: "bearish", actionA: "sell", confA: 0.7, qA: 0.75, regimeB: "bearish", actionB: "sell", confB: 0.65, qB: 0.7 },
    { t: "02", regimeA: "bullish", actionA: "buy", confA: 0.5, qA: 0.55, regimeB: "bearish", actionB: "sell", confB: 0.45, qB: 0.5 },
    { t: "03", regimeA: "bearish", actionA: "sell", confA: 0.35, qA: 0.4, regimeB: "bearish", actionB: "sell", confB: 0.3, qB: 0.35 },
  ];

  for (const file of files) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${file.t}-00-000Z.jsonl`),
      [
        JSON.stringify({ ts: `2026-01-01T00:${file.t}:00.000Z`, symbol: "AAPL", ok: true, httpStatus: 200, action: file.actionA, regime: file.regimeA, confidence: file.confA, compositeConfidence: file.confA, qualityOverall: file.qA }),
        JSON.stringify({ ts: `2026-01-01T00:${file.t}:00.000Z`, symbol: "MSFT", ok: true, httpStatus: 200, action: file.actionB, regime: file.regimeB, confidence: file.confB, compositeConfidence: file.confB, qualityOverall: file.qB }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:04:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.regimePersistenceScore, 0.5);
  assert.equal(out.regimeFlipRisk, 1);
  assert.ok(out.consensusStability < 0.7);
  assert.ok(out.trendPersistence < 0.7);
  assert.ok(out.volatilityExpansionRisk >= 0.25);

  assert.ok(out.persistenceIssues.includes("SCANNER_REGIME_UNSTABLE"));
  assert.ok(out.persistenceIssues.includes("SCANNER_CONSENSUS_DECAY"));
  assert.ok(out.persistenceIssues.includes("SCANNER_TREND_REVERSAL_RISK"));
  assert.ok(out.persistenceIssues.includes("SCANNER_VOLATILITY_EXPANDING"));
});
test("readScannerRankings exposes stable predictive intelligence deterministically", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-predictive-stable-"));

  const files = [
    { t: "00", conf: 0.75, q: 0.8, regime: "bullish", action: "buy" },
    { t: "01", conf: 0.78, q: 0.82, regime: "bullish", action: "buy" },
    { t: "02", conf: 0.8, q: 0.84, regime: "bullish", action: "buy" },
    { t: "03", conf: 0.82, q: 0.86, regime: "bullish", action: "buy" },
  ];

  for (const file of files) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${file.t}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:${file.t}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: file.action,
          regime: file.regime,
          confidence: file.conf,
          compositeConfidence: file.conf,
          qualityOverall: file.q,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:04:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.ok(out.consensusMomentum > 0);
  assert.ok(out.momentumDecayRisk < 0.25);
  assert.ok(out.regimeTransitionProbability < 0.25);
  assert.ok(out.signalExhaustionRisk < 0.25);

  assert.equal(out.predictiveRiskBias, "low");

  assert.ok(!out.issues.includes("SCANNER_CONSENSUS_EXHAUSTION"));
});

test("readScannerRankings detects predictive exhaustion and transition risk", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-predictive-risk-"));

  const files = [
    { t: "00", conf: 0.9, q: 0.9, regime: "bullish", action: "buy" },
    { t: "01", conf: 0.7, q: 0.7, regime: "bullish", action: "buy" },
    { t: "02", conf: 0.45, q: 0.5, regime: "mixed", action: "hold" },
    { t: "03", conf: 0.25, q: 0.35, regime: "bearish", action: "sell" },
  ];

  for (const file of files) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${file.t}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:${file.t}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: file.action,
          regime: file.regime,
          confidence: file.conf,
          compositeConfidence: file.conf,
          qualityOverall: file.q,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:04:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.ok(out.consensusMomentum < 0);
  assert.ok(out.momentumDecayRisk >= 0.5);
  assert.ok(out.regimeTransitionProbability >= 0.5);
  assert.ok(out.signalExhaustionRisk >= 0.5);

  assert.equal(out.predictiveRiskBias, "elevated");

  assert.ok(out.predictiveIssues.includes("SCANNER_CONSENSUS_EXHAUSTION"));
  assert.ok(out.predictiveIssues.includes("SCANNER_REGIME_TRANSITION_PENDING"));
  assert.ok(out.predictiveIssues.includes("SCANNER_MOMENTUM_COLLAPSE"));
  assert.ok(out.predictiveIssues.includes("SCANNER_SIGNAL_EXHAUSTION"));
});test("readScannerRankings exposes ready offensive scanner readiness state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-readiness-ready-"));

  for (let i = 0; i < 4; i += 1) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-0${i}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:0${i}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: "buy",
          regime: "bullish",
          confidence: 0.9,
          compositeConfidence: 0.9,
          qualityOverall: 0.9,
        }),
        JSON.stringify({
          ts: `2026-01-01T00:0${i}:00.000Z`,
          symbol: "MSFT",
          ok: true,
          httpStatus: 200,
          action: "buy",
          regime: "bullish",
          confidence: 0.85,
          compositeConfidence: 0.85,
          qualityOverall: 0.85,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.scannerReadiness, "ready");
  assert.equal(out.scannerActionBias, "offensive");
  assert.equal(out.scannerBlockReason, null);

  assert.ok(out.readinessScore >= 0.75);
});

test("readScannerRankings exposes blocked defensive scanner readiness state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-readiness-blocked-"));

  const files = [
    { t: "00", regime: "bullish", action: "buy", conf: 0.9, q: 0.9 },
    { t: "01", regime: "mixed", action: "hold", conf: 0.6, q: 0.6 },
    { t: "02", regime: "bearish", action: "sell", conf: 0.35, q: 0.4 },
    { t: "03", regime: "bearish", action: "sell", conf: 0.2, q: 0.3 },
  ];

  for (const file of files) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${file.t}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:${file.t}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: file.action,
          regime: file.regime,
          confidence: file.conf,
          compositeConfidence: file.conf,
          qualityOverall: file.q,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.scannerReadiness, "blocked");
  assert.equal(out.scannerActionBias, "defensive");

  assert.ok(typeof out.scannerBlockReason === "string");
  assert.ok(out.readinessScore <= 0.4);
});
test("readScannerRankings exposes aggressive execution coordination state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-execution-aggressive-"));

  for (let i = 0; i < 4; i += 1) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-0${i}-00-000Z.jsonl`),
      [
        JSON.stringify({ ts: `2026-01-01T00:0${i}:00.000Z`, symbol: "AAPL", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.92, compositeConfidence: 0.92, qualityOverall: 0.9 }),
        JSON.stringify({ ts: `2026-01-01T00:0${i}:00.000Z`, symbol: "MSFT", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.88, compositeConfidence: 0.88, qualityOverall: 0.88 }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.executionCoordinationState, "aggressive");
  assert.equal(out.executionReadiness, "deployable");
  assert.equal(out.executionThrottle, "none");
  assert.equal(out.capitalExposureBias, "expansion");
  assert.ok(out.deploymentPressure >= 0.75);
});

test("readScannerRankings exposes halted execution coordination state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-execution-halted-"));

  const files = [
    { t: "00", regime: "bullish", action: "buy", conf: 0.9, q: 0.9 },
    { t: "01", regime: "mixed", action: "hold", conf: 0.55, q: 0.55 },
    { t: "02", regime: "bearish", action: "sell", conf: 0.3, q: 0.35 },
    { t: "03", regime: "bearish", action: "sell", conf: 0.2, q: 0.25 },
  ];

  for (const file of files) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${file.t}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:${file.t}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: file.action,
          regime: file.regime,
          confidence: file.conf,
          compositeConfidence: file.conf,
          qualityOverall: file.q,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.executionCoordinationState, "halted");
  assert.equal(out.executionReadiness, "blocked");
  assert.equal(out.executionThrottle, "full");
  assert.equal(out.capitalExposureBias, "defensive");
  assert.ok(out.deploymentPressure <= 0.25);

  assert.ok(out.executionIssues.includes("SCANNER_COORDINATION_HALTED"));
});
test("readScannerRankings exposes expansion portfolio orchestration state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-orchestration-expansion-"));

  for (let i = 0; i < 4; i += 1) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-0${i}-00-000Z.jsonl`),
      [
        JSON.stringify({ ts: `2026-01-01T00:0${i}:00.000Z`, symbol: "AAPL", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.92, compositeConfidence: 0.92, qualityOverall: 0.9, p3GateOk: true, rsi: 35 }),
        JSON.stringify({ ts: `2026-01-01T00:0${i}:00.000Z`, symbol: "MSFT", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.88, compositeConfidence: 0.88, qualityOverall: 0.88, p3GateOk: true, rsi: 42 }),
        JSON.stringify({ ts: `2026-01-01T00:0${i}:00.000Z`, symbol: "NVDA", ok: true, httpStatus: 200, action: "buy", regime: "bullish", confidence: 0.86, compositeConfidence: 0.86, qualityOverall: 0.87, p3GateOk: true, rsi: 45 }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT", "NVDA"],
  });

  assert.equal(out.orchestrationState, "expansion");
  assert.ok(out.portfolioHeat >= 0.75);
  assert.ok(out.portfolioAggression >= 0.75);
  assert.ok(out.exposureSynchronization >= 0.75);
  assert.ok(out.signalConcentrationRisk < 0.6);
  assert.equal(out.capitalPreservationBias, "low");
});

test("readScannerRankings exposes permissive governance state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-governance-permissive-"));

  for (let i = 0; i < 4; i += 1) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-0${i}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:0${i}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: "buy",
          regime: "bullish",
          confidence: 0.92,
          compositeConfidence: 0.92,
          qualityOverall: 0.9,
          p3GateOk: true,
        }),
        JSON.stringify({
          ts: `2026-01-01T00:0${i}:00.000Z`,
          symbol: "MSFT",
          ok: true,
          httpStatus: 200,
          action: "buy",
          regime: "bullish",
          confidence: 0.88,
          compositeConfidence: 0.88,
          qualityOverall: 0.88,
          p3GateOk: true,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.governanceState, "permissive");
  assert.equal(out.portfolioPermission, "expanded");
  assert.equal(out.maxDeploymentBias, "high");
  assert.equal(out.riskBudgetBias, "expansion");

  assert.ok(out.governanceScore >= 0.75);

  assert.ok(
    !out.governanceIssues.includes("SCANNER_GOVERNANCE_LOCKED")
  );
});

test("readScannerRankings exposes position sizing intelligence per ranking", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-position-sizing-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T12-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.95, compositeConfidence: 0.95, qualityOverall: 0.95, rsi: 35 }),
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.65, compositeConfidence: 0.65, qualityOverall: 0.75, rsi: 50 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T12:05:00.000Z"),
    maxAgeSec: 15 * 60,
  });

  assert.equal(out.rankings[0].positionSizingModel, "deterministic_score_weighted_v1");
  assert.equal(out.rankings[0].deploymentPriority, "high");
  assert.ok(out.rankings[0].targetPositionPct > 0);
  assert.ok(out.rankings[0].maxPositionPct >= out.rankings[0].targetPositionPct);
  assert.ok(out.rankings[0].volatilityAdjustedSize > 0);
  assert.equal(out.rankings[0].correlationPenalty, 0);
  assert.ok(out.rankings[0].portfolioCapacityImpact > 0);
  assert.equal(out.rankings[0].riskAdjustedExposure, out.rankings[0].volatilityAdjustedSize);
});


test("readScannerRankings exposes capital allocation intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-capital-allocation-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T12-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "AAPL", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.95, compositeConfidence: 0.95, qualityOverall: 0.95, rsi: 50, context_v3: { regime: "bullish", volatility: "normal", quality: { overall: 0.95 } } }),
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "MSFT", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, rsi: 50, context_v3: { regime: "bullish", volatility: "normal", quality: { overall: 0.9 } } }),
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "NVDA", action: "hold", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.85, compositeConfidence: 0.85, qualityOverall: 0.85, rsi: 50, context_v3: { regime: "bullish", volatility: "normal", quality: { overall: 0.85 } } }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T12:05:00.000Z"),
    maxAgeSec: 15 * 60,
  });

  assert.equal(out.capitalProfile, "expansion");
  assert.equal(out.allocationTier, "aggressive");
  assert.equal(out.suggestedRiskPct, 0.02);
  assert.equal(out.exposureClass, "offensive");
  assert.ok(out.deploymentWeight > 0);
  assert.ok(out.capitalEfficiency >= 0.7);
});


test("readScannerRankings exposes locked governance state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-governance-locked-"));

  const files = [
    { t: "00", regime: "bullish", action: "buy", conf: 0.9, q: 0.9 },
    { t: "01", regime: "mixed", action: "hold", conf: 0.55, q: 0.55 },
    { t: "02", regime: "bearish", action: "sell", conf: 0.3, q: 0.35 },
    { t: "03", regime: "bearish", action: "sell", conf: 0.2, q: 0.25 },
  ];

  for (const file of files) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${file.t}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:${file.t}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: file.action,
          regime: file.regime,
          confidence: file.conf,
          compositeConfidence: file.conf,
          qualityOverall: file.q,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.governanceState, "locked");
  assert.equal(out.portfolioPermission, "denied");
  assert.equal(out.maxDeploymentBias, "minimal");
  assert.equal(out.riskBudgetBias, "conservative");

  assert.ok(out.governanceScore < 0.5);

  assert.ok(
    out.governanceIssues.includes("SCANNER_GOVERNANCE_LOCKED")
  );

  assert.ok(
    out.governanceIssues.includes("SCANNER_RISK_BUDGET_CONSTRAINED")
  );

  assert.ok(
    out.governanceIssues.includes("SCANNER_PORTFOLIO_PERMISSION_RESTRICTED")
  );
});


test("readScannerRankings exposes exposure balancing intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-exposure-balancing-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T12-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "AAPL", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.95, compositeConfidence: 0.95, qualityOverall: 0.95, rsi: 35, regime: "bullish" }),
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "MSFT", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, rsi: 50, regime: "bullish" }),
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "NVDA", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.88, compositeConfidence: 0.88, qualityOverall: 0.88, rsi: 72, regime: "bullish" }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T12:05:00.000Z"),
    maxAgeSec: 15 * 60,
    configuredSymbols: ["AAPL", "MSFT", "NVDA"],
  });

  assert.ok(["growth_accumulation", "momentum_extended", "balanced"].includes(out.sectorExposureBias));
  assert.ok(["long_dominant", "balanced", "neutral"].includes(out.directionalExposureBalance));
  assert.ok(["compressed", "mixed", "expanded"].includes(out.volatilityBucketExposure));
  assert.ok(out.correlationClusterRisk >= 0);
  assert.ok(out.portfolioSaturationScore >= 0);
  assert.ok(["stable", "elevated", "accelerated"].includes(out.exposureDecayRate));
  assert.ok(["balanced", "progressive", "staggered"].includes(out.deploymentSequencing));
  assert.ok(["stable", "adaptive", "required", "restricted"].includes(out.exposureRebalancingState));

  assert.ok(out.rankings[0].exposureWeight >= 0);
  assert.ok(out.rankings[0].balancingPenalty >= 0);
  assert.ok(["critical", "elevated", "standard", "low"].includes(out.rankings[0].exposurePriority));
  assert.ok(out.rankings[0].concentrationAdjustment <= 1);
});

test("readScannerRankings exposes exposure rotation intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-exposure-rotation-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T12-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "AAPL", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.95, compositeConfidence: 0.95, qualityOverall: 0.95, rsi: 35, regime: "bullish" }),
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "MSFT", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, rsi: 50, regime: "bullish" }),
      JSON.stringify({ ts: "2026-01-01T12:00:00.000Z", symbol: "NVDA", action: "buy", ok: true, httpStatus: 200, p3GateOk: true, confidence: 0.88, compositeConfidence: 0.88, qualityOverall: 0.88, rsi: 72, regime: "bullish" }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T12:05:00.000Z"),
    maxAgeSec: 15 * 60,
    configuredSymbols: ["AAPL", "MSFT", "NVDA"],
  });

  assert.ok(out.rotationPressure >= 0);
  assert.ok(out.rotationPressure <= 1);
  assert.ok(["stable", "watching", "rotating", "frozen"].includes(out.capitalRotationState));
  assert.ok(["growth_accumulation", "momentum_extended", "balanced"].includes(out.sectorRotationBias));
  assert.ok(["contained", "moderate", "fast", "paused"].includes(out.rotationVelocity));
  assert.ok(["balanced", "advance", "reduce", "defer"].includes(out.deploymentRotationPriority));
  assert.ok(out.exposureMigrationRisk >= 0);
  assert.ok(out.exposureMigrationRisk <= 1);
});

test("readScannerRankings exposes capital preservation intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-capital-preservation-"));

  const files = [
    { t: "00", regime: "bullish", action: "buy", conf: 0.92, q: 0.9 },
    { t: "01", regime: "mixed", action: "hold", conf: 0.5, q: 0.5 },
    { t: "02", regime: "bearish", action: "sell", conf: 0.28, q: 0.3 },
    { t: "03", regime: "bearish", action: "sell", conf: 0.18, q: 0.22 },
  ];

  for (const file of files) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${file.t}-00-000Z.jsonl`),
      [
        JSON.stringify({
          ts: `2026-01-01T00:${file.t}:00.000Z`,
          symbol: "AAPL",
          ok: true,
          httpStatus: 200,
          action: file.action,
          regime: file.regime,
          confidence: file.conf,
          compositeConfidence: file.conf,
          qualityOverall: file.q,
        }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:05:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.ok(out.preservationPressure >= 0);
  assert.ok(out.preservationPressure <= 1);

  assert.ok(
    ["normal", "guarded", "defensive", "locked"].includes(
      out.capitalPreservationState
    )
  );

  assert.ok(
    ["neutral", "moderate", "high", "maximum"].includes(
      out.defensiveCapitalBias
    )
  );

  assert.ok(out.drawdownSensitivity >= 0);
  assert.ok(out.drawdownSensitivity <= 1);

  assert.ok(
    ["standard", "elevated", "high", "critical"].includes(
      out.preservationPriority
    )
  );

  assert.ok(
    ["open", "guarded", "restricted", "protected"].includes(
      out.liquidityProtectionState
    )
  );

  assert.ok(
    ["relaxed", "moderate", "elevated", "maximum"].includes(
      out.riskCompressionState
    )
  );

  assert.ok(out.rankings[0].defensivePenalty >= 0);
  assert.ok(out.rankings[0].defensivePenalty <= 1);
  assert.ok(out.rankings[0].preservationWeight >= 0);
  assert.ok(out.rankings[0].preservationWeight <= 1);
  assert.ok(["low", "moderate", "high"].includes(out.rankings[0].liquidityBias));
  assert.ok(out.rankings[0].capitalRetentionScore >= 0);
  assert.ok(out.rankings[0].capitalRetentionScore <= 1);
});


test("readScannerRankings exposes recovering capital recovery intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-recovery-recovering-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "buy",
        regime: "bullish",
        confidence: 0.85,
        compositeConfidence: 0.85,
        qualityOverall: 0.9,
        setupScore: 0.9,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "MSFT",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "buy",
        regime: "bullish",
        confidence: 0.8,
        compositeConfidence: 0.8,
        qualityOverall: 0.85,
        setupScore: 0.85,
      }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:01:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "buy",
        regime: "bullish",
        confidence: 0.9,
        compositeConfidence: 0.9,
        qualityOverall: 0.95,
        setupScore: 0.95,
      }),
      JSON.stringify({
        ts: "2026-01-01T00:01:00.000Z",
        symbol: "MSFT",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "buy",
        regime: "bullish",
        confidence: 0.88,
        compositeConfidence: 0.88,
        qualityOverall: 0.9,
        setupScore: 0.9,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.recoveryState, "recovered");
  assert.ok(out.recoveryReadiness >= 0.75);
  assert.ok(out.drawdownRecoveryProbability >= 0.75);
  assert.deepEqual(out.recoveryIssues, []);
});

test("readScannerRankings exposes impaired capital recovery intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-recovery-impaired-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:00:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "sell",
        regime: "bearish",
        confidence: 0.9,
        compositeConfidence: 0.9,
        qualityOverall: 0.9,
        setupScore: 0.9,
      }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({
        ts: "2026-01-01T00:01:00.000Z",
        symbol: "AAPL",
        ok: true,
        httpStatus: 200,
        p3GateOk: true,
        action: "hold",
        regime: "neutral",
        confidence: 0.2,
        compositeConfidence: 0.2,
        qualityOverall: 0.3,
        setupScore: 0.2,
      }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.recoveryState, "stabilizing");
  assert.ok(out.drawdownRecoveryProbability < 0.5);
  assert.ok(Array.isArray(out.recoveryIssues));
});


test("readScannerRankings exposes reinforced capital resilience intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-resilience-reinforced-"));

  for (const minute of ["00", "01", "02", "03"]) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${minute}-00-000Z.jsonl`),
      [
        JSON.stringify({ ts: `2026-01-01T00:${minute}:00.000Z`, symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.95, setupScore: 0.95 }),
        JSON.stringify({ ts: `2026-01-01T00:${minute}:00.000Z`, symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.88, compositeConfidence: 0.88, qualityOverall: 0.9, setupScore: 0.9 }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:04:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.resilienceState, "reinforced");
  assert.equal(out.resilienceMomentum, "strengthening");
  assert.ok(out.resilienceScore >= 0.75);
  assert.ok(out.resilienceRecoveryCapacity >= 0.8);
  assert.deepEqual(out.resilienceIssues, []);
});

test("readScannerRankings exposes fragile capital resilience intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-resilience-fragile-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "hold", regime: "neutral", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.resilienceState, "fragile");
  assert.equal(out.resilienceMomentum, "deteriorating");
  assert.ok(out.resilienceScore < 0.55);
  assert.ok(Array.isArray(out.resilienceIssues));
});

test("readScannerRankings exposes fortified capital stability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-stability-fortified-"));

  for (const minute of ["00", "01", "02", "03"]) {
    fs.writeFileSync(
      path.join(dir, `dry-scanner-2026-01-01T00-${minute}-00-000Z.jsonl`),
      [
        JSON.stringify({ ts: `2026-01-01T00:${minute}:00.000Z`, symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 1, compositeConfidence: 1, qualityOverall: 1, setupScore: 1 }),
        JSON.stringify({ ts: `2026-01-01T00:${minute}:00.000Z`, symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 1, compositeConfidence: 1, qualityOverall: 1, setupScore: 1 }),
      ].join("\n")
    );
  }

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:04:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.equal(out.stabilityState, "fortified");
  assert.ok(out.capitalStabilityScore >= 0.75);
  assert.ok(out.stabilityConfidence >= 0.65);
  assert.ok(out.capitalFragilityRisk <= 0.45);
  assert.ok(out.stabilityPressure <= 0.3);
  assert.deepEqual(out.stabilityIssues, []);
});

test("readScannerRankings exposes critical capital stability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-stability-critical-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.stabilityState, "critical");
  assert.ok(out.capitalStabilityScore <= 0.62 || out.stabilityPressure >= 0.33 || out.capitalFragilityRisk >= 0.3);
  assert.ok(Array.isArray(out.stabilityIssues));
  assert.ok(Array.isArray(out.stabilityIssues));
});


test("readScannerRankings exposes durable capital continuity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-continuity-durable-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.86, compositeConfidence: 0.86, qualityOverall: 0.86, setupScore: 0.86 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.continuityScore >= 0.62);
  assert.ok(["steady", "durable"].includes(out.continuityState));
  assert.ok(["maintain", "compound"].includes(out.continuityBias));
  assert.deepEqual(out.continuityIssues, []);
});

test("readScannerRankings exposes disrupted capital continuity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-continuity-disrupted-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.continuityState, "disrupted");
  assert.equal(out.continuityBias, "protect");
  assert.ok(Array.isArray(out.continuityIssues));
});


test("readScannerRankings exposes hardened capital durability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-durability-hardened-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.92, compositeConfidence: 0.92, qualityOverall: 0.92, setupScore: 0.92 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.88, compositeConfidence: 0.88, qualityOverall: 0.88, setupScore: 0.88 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.durabilityScore >= 0.62);
  assert.ok(["durable", "hardened"].includes(out.durabilityState));
  assert.ok(["sustain", "compound"].includes(out.durabilityBias));
  assert.deepEqual(out.durabilityIssues, []);
});

test("readScannerRankings exposes vulnerable capital durability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-durability-vulnerable-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.durabilityState, "vulnerable");
  assert.equal(out.durabilityBias, "defend");
  assert.ok(Array.isArray(out.durabilityIssues));
});


test("readScannerRankings exposes extended capital endurance intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-endurance-extended-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.93, compositeConfidence: 0.93, qualityOverall: 0.93, setupScore: 0.93 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.89, compositeConfidence: 0.89, qualityOverall: 0.89, setupScore: 0.89 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.enduranceScore >= 0.62);
  assert.ok(["sustained", "extended"].includes(out.enduranceState));
  assert.ok(["hold", "compound"].includes(out.enduranceBias));
  assert.deepEqual(out.enduranceIssues, []);
});

test("readScannerRankings exposes limited capital endurance intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-endurance-limited-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.enduranceState, "limited");
  assert.equal(out.enduranceBias, "conserve");
  assert.ok(Array.isArray(out.enduranceIssues));
});


test("readScannerRankings exposes sustainable capital sustainability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-sustainability-sustainable-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.93, compositeConfidence: 0.93, qualityOverall: 0.93, setupScore: 0.93 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.89, compositeConfidence: 0.89, qualityOverall: 0.89, setupScore: 0.89 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.sustainabilityScore >= 0.62);
  assert.ok(["sustainable", "self_sustaining"].includes(out.sustainabilityState));
  assert.ok(["maintain", "compound"].includes(out.sustainabilityBias));
  assert.deepEqual(out.sustainabilityIssues, []);
});

test("readScannerRankings exposes unsustainable capital sustainability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-sustainability-unsustainable-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.sustainabilityState, "unsustainable");
  assert.equal(out.sustainabilityBias, "reduce");
  assert.ok(Array.isArray(out.sustainabilityIssues));
});


test("readScannerRankings exposes scalable capital scalability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-scalability-scalable-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.93, compositeConfidence: 0.93, qualityOverall: 0.93, setupScore: 0.93 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.89, compositeConfidence: 0.89, qualityOverall: 0.89, setupScore: 0.89 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.scalabilityScore >= 0.62);
  assert.ok(["scalable", "expandable"].includes(out.scalabilityState));
  assert.ok(["scale", "expand"].includes(out.scalabilityBias));
  assert.deepEqual(out.scalabilityIssues, []);
});

test("readScannerRankings exposes restricted capital scalability intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-scalability-restricted-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.scalabilityState, "restricted");
  assert.equal(out.scalabilityBias, "cap");
  assert.ok(Array.isArray(out.scalabilityIssues));
});


test("readScannerRankings exposes compounding capital compounding intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-compounding-positive-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.compoundingScore >= 0.62);
  assert.ok(["compounding", "accelerating"].includes(out.compoundingState));
  assert.ok(["compound", "increase"].includes(out.compoundingBias));
  assert.deepEqual(out.compoundingIssues, []);
});

test("readScannerRankings exposes blocked capital compounding intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-compounding-blocked-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.compoundingState, "blocked");
  assert.equal(out.compoundingBias, "pause");
  assert.ok(Array.isArray(out.compoundingIssues));
});


test("readScannerRankings exposes efficient capital efficiency intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-efficiency-efficient-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.efficiencyScore >= 0.62);
  assert.ok(["efficient", "optimized"].includes(out.efficiencyState));
  assert.ok(["optimize", "maximize"].includes(out.efficiencyBias));
  assert.deepEqual(out.efficiencyIssues, []);
});

test("readScannerRankings exposes inefficient capital efficiency intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-efficiency-inefficient-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.efficiencyState, "inefficient");
  assert.equal(out.efficiencyBias, "tighten");
  assert.ok(Array.isArray(out.efficiencyIssues));
});


test("readScannerRankings exposes optimized capital optimization intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-optimization-optimized-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.optimizationScore >= 0.62);
  assert.ok(["improving", "optimized"].includes(out.optimizationState));
  assert.ok(["rebalance", "maximize"].includes(out.optimizationBias));
  assert.deepEqual(out.optimizationIssues, []);
});

test("readScannerRankings exposes constrained capital optimization intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-optimization-constrained-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.optimizationState, "constrained");
  assert.equal(out.optimizationBias, "reduce");
  assert.ok(Array.isArray(out.optimizationIssues));
});


test("readScannerRankings exposes productive capital productivity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-productivity-productive-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.productivityScore >= 0.62);
  assert.ok(["productive", "high_yield"].includes(out.productivityState));
  assert.ok(["allocate", "harvest"].includes(out.productivityBias));
  assert.deepEqual(out.productivityIssues, []);
});

test("readScannerRankings exposes wasteful capital productivity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-productivity-wasteful-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.productivityState, "wasteful");
  assert.equal(out.productivityBias, "cut");
  assert.ok(Array.isArray(out.productivityIssues));
});


test("readScannerRankings exposes leveraged capital leverage intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-leverage-leveraged-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.leverageScore >= 0.62);
  assert.ok(["leveraged", "amplified"].includes(out.leverageState));
  assert.ok(["deploy", "amplify"].includes(out.leverageBias));
  assert.deepEqual(out.leverageIssues, []);
});

test("readScannerRankings exposes overextended capital leverage intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-leverage-overextended-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.leverageState, "overextended");
  assert.equal(out.leverageBias, "delever");
  assert.ok(Array.isArray(out.leverageIssues));
});


test("readScannerRankings exposes controlled capital velocity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-velocity-controlled-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.velocityScore >= 0.62);
  assert.ok(["controlled", "accelerating"].includes(out.velocityState));
  assert.ok(["pace", "press"].includes(out.velocityBias));
  assert.deepEqual(out.velocityIssues, []);
});

test("readScannerRankings exposes stalled capital velocity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-velocity-stalled-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.velocityState, "stalled");
  assert.equal(out.velocityBias, "slow");
  assert.ok(Array.isArray(out.velocityIssues));
});


test("readScannerRankings exposes building capital acceleration intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-acceleration-building-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.accelerationScore >= 0.62);
  assert.ok(["building", "accelerating"].includes(out.accelerationState));
  assert.ok(["build", "press"].includes(out.accelerationBias));
  assert.deepEqual(out.accelerationIssues, []);
});

test("readScannerRankings exposes decelerating capital acceleration intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-acceleration-decelerating-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.accelerationState, "decelerating");
  assert.equal(out.accelerationBias, "brake");
  assert.ok(Array.isArray(out.accelerationIssues));
});


test("readScannerRankings exposes building capital momentum intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-momentum-building-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.momentumScore >= 0.62);
  assert.ok(["building", "surging"].includes(out.momentumState));
  assert.ok(["follow", "press"].includes(out.momentumBias));
  assert.deepEqual(out.momentumIssues, []);
});

test("readScannerRankings exposes fading capital momentum intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-momentum-fading-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.momentumState, "fading");
  assert.equal(out.momentumBias, "fade");
  assert.ok(Array.isArray(out.momentumIssues));
});


test("readScannerRankings exposes aligned capital trajectory intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-trajectory-aligned-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.trajectoryScore >= 0.62);
  assert.ok(["aligned", "advancing"].includes(out.trajectoryState));
  assert.ok(["track", "press"].includes(out.trajectoryBias));
  assert.deepEqual(out.trajectoryIssues, []);
});

test("readScannerRankings exposes reversing capital trajectory intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-trajectory-reversing-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.trajectoryState, "reversing");
  assert.equal(out.trajectoryBias, "reverse");
  assert.ok(Array.isArray(out.trajectoryIssues));
});


test("readScannerRankings exposes aligned capital alignment intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-alignment-aligned-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.alignmentScore >= 0.62);
  assert.ok(["aligned", "coherent"].includes(out.alignmentState));
  assert.ok(["focus", "confirm"].includes(out.alignmentBias));
  assert.deepEqual(out.alignmentIssues, []);
});

test("readScannerRankings exposes divergent capital alignment intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-alignment-divergent-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.alignmentState, "divergent");
  assert.equal(out.alignmentBias, "stand_down");
  assert.ok(Array.isArray(out.alignmentIssues));
});


test("readScannerRankings exposes confirmed capital conviction intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-conviction-confirmed-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.convictionScore >= 0.62);
  assert.ok(["confirmed", "high_conviction"].includes(out.convictionState));
  assert.ok(["hold", "add"].includes(out.convictionBias));
  assert.deepEqual(out.convictionIssues, []);
});

test("readScannerRankings exposes weak capital conviction intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-conviction-weak-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.convictionState, "weak");
  assert.equal(out.convictionBias, "wait");
  assert.ok(Array.isArray(out.convictionIssues));
});


test("readScannerRankings exposes controlled capital discipline intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-discipline-controlled-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.disciplineScore >= 0.62);
  assert.ok(["controlled", "disciplined"].includes(out.disciplineState));
  assert.ok(["manage", "enforce"].includes(out.disciplineBias));
  assert.deepEqual(out.disciplineIssues, []);
});

test("readScannerRankings exposes undisciplined capital discipline intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-discipline-undisciplined-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.disciplineState, "undisciplined");
  assert.equal(out.disciplineBias, "restrict");
  assert.ok(Array.isArray(out.disciplineIssues));
});


test("readScannerRankings exposes filtered capital selectivity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-selectivity-filtered-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.selectivityScore >= 0.62);
  assert.ok(["filtered", "selective"].includes(out.selectivityState));
  assert.ok(["filter", "select"].includes(out.selectivityBias));
  assert.deepEqual(out.selectivityIssues, []);
});

test("readScannerRankings exposes unselective capital selectivity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-selectivity-unselective-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.selectivityState, "unselective");
  assert.equal(out.selectivityBias, "skip");
  assert.ok(Array.isArray(out.selectivityIssues));
});


test("readScannerRankings exposes neutral capital timing intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-timing-neutral-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.timingScore >= 0.62);
  assert.ok(["neutral", "timely"].includes(out.timingState));
  assert.ok(["wait", "act"].includes(out.timingBias));
  assert.deepEqual(out.timingIssues, []);
});

test("readScannerRankings exposes poor capital timing intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-timing-poor-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.timingState, "poor");
  assert.equal(out.timingBias, "delay");
  assert.ok(Array.isArray(out.timingIssues));
});


test("readScannerRankings exposes guarded capital capacity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-capacity-guarded-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.capacityScore >= 0.62);
  assert.ok(["guarded", "available"].includes(out.capacityState));
  assert.ok(["hold", "deploy"].includes(out.capacityBias));
  assert.deepEqual(out.capacityIssues, []);
});

test("readScannerRankings exposes capped capital capacity intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-capacity-capped-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.capacityState, "capped");
  assert.equal(out.capacityBias, "cap");
  assert.ok(Array.isArray(out.capacityIssues));
});


test("readScannerRankings exposes managed capital utilization intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-utilization-managed-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.utilizationScore >= 0.62);
  assert.ok(["managed", "productive"].includes(out.utilizationState));
  assert.ok(["manage", "use"].includes(out.utilizationBias));
  assert.deepEqual(out.utilizationIssues, []);
});

test("readScannerRankings exposes underutilized capital utilization intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-utilization-underutilized-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.utilizationState, "underutilized");
  assert.equal(out.utilizationBias, "idle");
  assert.ok(Array.isArray(out.utilizationIssues));
});


test("readScannerRankings exposes queued capital priority intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-priority-queued-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.priorityScore >= 0.62);
  assert.ok(["queued", "high_priority"].includes(out.priorityState));
  assert.ok(["queue", "prioritize"].includes(out.priorityBias));
  assert.deepEqual(out.priorityIssues, []);
});

test("readScannerRankings exposes low_priority capital priority intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-priority-low_priority-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.priorityState, "low_priority");
  assert.equal(out.priorityBias, "deprioritize");
  assert.ok(Array.isArray(out.priorityIssues));
});


test("readScannerRankings exposes conditional capital command intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-command-conditional-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.94, compositeConfidence: 0.94, qualityOverall: 0.94, setupScore: 0.94 }),
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "MSFT", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:01:00.000Z"),
    configuredSymbols: ["AAPL", "MSFT"],
  });

  assert.ok(out.commandScore >= 0.62);
  assert.ok(["conditional", "authorized"].includes(out.commandState));
  assert.ok(["condition", "authorize"].includes(out.commandBias));
  assert.deepEqual(out.commandIssues, []);
});

test("readScannerRankings exposes denied capital command intelligence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ranking-store-command-denied-"));

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-00-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "buy", regime: "bullish", confidence: 0.9, compositeConfidence: 0.9, qualityOverall: 0.9, setupScore: 0.9 }),
    ].join("\\n")
  );

  fs.writeFileSync(
    path.join(dir, "dry-scanner-2026-01-01T00-01-00-000Z.jsonl"),
    [
      JSON.stringify({ ts: "2026-01-01T00:01:00.000Z", symbol: "AAPL", ok: true, httpStatus: 200, p3GateOk: true, action: "sell", regime: "bearish", confidence: 0, compositeConfidence: 0, qualityOverall: 0, setupScore: 0 }),
    ].join("\\n")
  );

  const out = readScannerRankings({
    dryrunsDir: dir,
    nowMs: Date.parse("2026-01-01T00:02:00.000Z"),
    configuredSymbols: ["AAPL"],
  });

  assert.equal(out.commandState, "denied");
  assert.equal(out.commandBias, "deny");
  assert.ok(Array.isArray(out.commandIssues));
});
