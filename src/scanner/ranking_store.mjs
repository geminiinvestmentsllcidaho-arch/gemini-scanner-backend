import fs from "node:fs";
import path from "node:path";

import { rankScannerCandidates } from "./ranking_engine.mjs";

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function getLatestDryrunFile(dir) {
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".jsonl"))
    .sort();

  if (files.length === 0) return null;

  return path.join(dir, files[files.length - 1]);
}

function latestBySymbol(rows) {
  const bySymbol = new Map();

  for (const row of rows) {
    const symbol = String(row?.symbol || "").trim().toUpperCase();
    if (!symbol) continue;

    const previous = bySymbol.get(symbol);
    const rowTs = Date.parse(row?.ts || "");
    const previousTs = Date.parse(previous?.ts || "");

    if (!previous || (Number.isFinite(rowTs) && rowTs >= previousTs)) {
      bySymbol.set(symbol, { ...row, symbol });
    }
  }

  return Array.from(bySymbol.values());
}

function computeFreshness(rows, opts = {}) {
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const maxAgeSec = Number.isFinite(opts.maxAgeSec)
    ? opts.maxAgeSec
    : Number(process.env.SCANNER_RANKINGS_MAX_AGE_SEC || 180);

  const latestTsMs = rows.reduce((latest, row) => {
    const tsMs = Date.parse(row?.ts || "");
    return Number.isFinite(tsMs) ? Math.max(latest, tsMs) : latest;
  }, -Infinity);

  const sourceTs = Number.isFinite(latestTsMs)
    ? new Date(latestTsMs).toISOString()
    : null;

  const sourceAgeSec = Number.isFinite(latestTsMs)
    ? Math.max(0, Math.floor((nowMs - latestTsMs) / 1000))
    : null;

  const stale =
    sourceAgeSec === null ||
    !Number.isFinite(maxAgeSec) ||
    sourceAgeSec > maxAgeSec;

  const issues = stale ? ["SCANNER_TELEMETRY_STALE"] : [];

  return {
    sourceTs,
    sourceAgeSec,
    maxAgeSec,
    stale,
    issues,
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function roundN(value, places = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function avg(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function computeScannerHealth(rows, freshness, opts = {}) {
  const configuredSymbols = Array.isArray(opts.configuredSymbols)
    ? opts.configuredSymbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean)
    : String(process.env.ALPACA_SYMBOLS || "")
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);

  const rankedSymbols = new Set(
    rows.map((row) => String(row?.symbol || "").trim().toUpperCase()).filter(Boolean)
  );

  const telemetryCoverage =
    configuredSymbols.length > 0
      ? roundN(clamp01(rankedSymbols.size / configuredSymbols.length), 4)
      : rows.length > 0
        ? 1
        : 0;

  const rankingQuality = roundN(
    clamp01(avg(rows.map((row) => Number(row?.qualityOverall)))),
    4
  );

  const rankingConfidence = roundN(
    clamp01(avg(rows.map((row) => Number.isFinite(Number(row?.compositeConfidence))
      ? Number(row.compositeConfidence)
      : Number(row?.confidence)
    ))),
    4
  );

  const minCoverage = Number.isFinite(opts.minCoverage) ? opts.minCoverage : 0.8;
  const minQuality = Number.isFinite(opts.minQuality) ? opts.minQuality : 0.6;
  const minConfidence = Number.isFinite(opts.minConfidence) ? opts.minConfidence : 0.6;

  const issues = [...freshness.issues];

  if (!freshness.stale) {
    if (telemetryCoverage < minCoverage) issues.push("SCANNER_LOW_COVERAGE");
    if (rankingQuality !== null && rankingQuality < minQuality) issues.push("SCANNER_LOW_QUALITY");
    if (rankingConfidence !== null && rankingConfidence < minConfidence) issues.push("SCANNER_LOW_CONFIDENCE");
  }

  const scannerHealth = freshness.stale
    ? "stale"
    : issues.length > 0
      ? "degraded"
      : "healthy";

  return {
    scannerHealth,
    rankingQuality,
    rankingConfidence,
    telemetryCoverage,
    issues,
  };
}

export function readScannerRankings(opts = {}) {
  const dryrunsDir = opts.dryrunsDir || path.resolve(process.cwd(), "dryruns");
  const latestFile = getLatestDryrunFile(dryrunsDir);

  if (!latestFile) {
    const freshness = computeFreshness([], opts);
    const health = computeScannerHealth([], freshness, opts);
    return {
      ok: true,
      source: null,
      ...freshness,
      ...health,
      count: 0,
      rankings: [],
    };
  }

  const content = fs.readFileSync(latestFile, "utf8");
  const rows = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(safeJsonParse)
    .filter(Boolean)
    .filter((row) => row?.ok === true && row?.httpStatus === 200);

  const latestRows = latestBySymbol(rows);
  const freshness = computeFreshness(latestRows, opts);
  const health = computeScannerHealth(latestRows, freshness, opts);

  return {
    ok: true,
    source: latestFile,
    ...freshness,
    ...health,
    count: latestRows.length,
    rankings: rankScannerCandidates(latestRows),
  };
}
