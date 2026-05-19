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
