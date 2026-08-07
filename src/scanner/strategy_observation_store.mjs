import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

export const VERSION = "strategy_observation_store_v1";
export const DEFAULT_STRATEGY_OBSERVATION_PATH =
  path.resolve("runs/strategy_observations.jsonl");

function clean(value, maxLength = 256) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integer(value, fallback = 0, min = 0, max = 1000000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function freezeMap(value = {}) {
  return Object.freeze({ ...value });
}

function strategyTypeFor(row = {}) {
  const explicit = clean(row.strategyType ?? row.strategy ?? row.tradeStyle, 64).toLowerCase();
  if (explicit) return explicit;
  const scanType = clean(row.scanType ?? row.scanner, 64).toLowerCase();
  if (scanType.includes("swing")) return "swing";
  if (scanType.includes("premarket") || scanType.includes("intraday") || scanType.includes("under_five")) {
    return "intraday";
  }
  return "unclassified";
}

export function buildStrategyObservationRecord(input = {}, options = {}) {
  const now = options.now instanceof Date
    ? options.now
    : new Date(options.now ?? Date.now());

  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  const symbol = clean(input.symbol, 20).toUpperCase();
  const originScanId = clean(input.originScanId ?? input.scanId, 128);
  const originEventAt = clean(input.originEventAt ?? input.eventAt, 64) || null;
  const key = clean(input.key, 180)
    || (originScanId && symbol ? `${originScanId}:${symbol}` : `observation-${now.getTime()}`);

  return Object.freeze({
    version: VERSION,
    observedAt: now.toISOString(),
    key,
    originScanId: originScanId || null,
    originEventAt,
    symbol: symbol || null,
    scanner: clean(input.scanner, 64) || null,
    scanType: clean(input.scanType, 64) || null,
    strategyType: strategyTypeFor(input),
    decision: clean(input.decision, 32).toUpperCase() || "UNKNOWN",
    resultState: clean(input.resultState, 32).toUpperCase() || null,
    entryPrice: finite(input.entryPrice),
    latestPrice: finite(input.latestPrice),
    observations: integer(input.observations),
    latestEventAt: clean(input.latestEventAt, 64) || null,
    latestReturnPct: finite(input.latestReturnPct),
    maxFavorablePct: finite(input.maxFavorablePct),
    maxAdversePct: finite(input.maxAdversePct),
    horizonObservations: freezeMap(input.horizonObservations ?? input.observationsByHorizon),
    horizonReturnsPct: freezeMap(input.horizonReturnsPct ?? input.returnsByHorizon),
    horizonMaxFavorablePct: freezeMap(
      input.horizonMaxFavorablePct ?? input.maxFavorableByHorizon,
    ),
    horizonMaxAdversePct: freezeMap(
      input.horizonMaxAdversePct ?? input.maxAdverseByHorizon,
    ),
    originObservable: input.originObservable === true,
    originSourceStale: input.originSourceStale === true || input.sourceStale === true,
    rankingConfidence: finite(input.rankingConfidence),
    readonlyPotentialScore: finite(input.readonlyPotentialScore),
    readOnly: true,
    paperOnly: true,
    shadowOnly: true,
    historicalMeasurementOnly: true,
    localStoreOnly: true,
    automaticLearningAllowed: false,
    automaticPatchAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

export function appendStrategyObservationRecord(input = {}, options = {}) {
  const observationPath =
    clean(options.observationPath, 4096) || DEFAULT_STRATEGY_OBSERVATION_PATH;
  const record = buildStrategyObservationRecord(input, options);

  fs.mkdirSync(path.dirname(observationPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(observationPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(observationPath, 0o600);

  return Object.freeze({
    ok: true,
    appended: true,
    record,
    observationPath,
  });
}

export function appendStrategyObservationReport(report = {}, options = {}) {
  const sourceRows = Array.isArray(report)
    ? report
    : Array.isArray(report?.outcomes)
      ? report.outcomes
      : Array.isArray(report?.evaluations)
        ? report.evaluations
        : [];

  const appended = sourceRows.slice(0, 5000).map((row, index) =>
    appendStrategyObservationRecord(row, {
      ...options,
      now: options.now ?? report.generatedAt ?? Date.now() + index,
    }).record
  );

  return Object.freeze({
    ok: true,
    appendedCount: appended.length,
    records: Object.freeze(appended),
    observationPath:
      clean(options.observationPath, 4096) || DEFAULT_STRATEGY_OBSERVATION_PATH,
    readOnly: true,
    paperOnly: true,
    localStoreOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

function readNewestJsonlLines(observationPath, maxRecords, options = {}) {
  const chunkSize = Math.max(
    4096,
    Math.min(1024 * 1024, Number(options.readChunkBytes) || 64 * 1024),
  );
  const handle = fs.openSync(observationPath, "r");
  try {
    const size = fs.fstatSync(handle).size;
    let position = size;
    let pending = "";
    const newest = [];

    while (position > 0 && newest.length < maxRecords) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      const buffer = Buffer.allocUnsafe(readSize);
      const bytesRead = fs.readSync(handle, buffer, 0, readSize, position);
      if (bytesRead <= 0) break;

      const decoder = new StringDecoder("utf8");
      const chunk = decoder.write(buffer.subarray(0, bytesRead)) + decoder.end();
      const parts = `${chunk}${pending}`.split(/\r?\n/);
      pending = parts.shift() ?? "";

      for (let index = parts.length - 1; index >= 0 && newest.length < maxRecords; index -= 1) {
        const line = parts[index].trim();
        if (line) newest.push(line);
      }
    }

    if (newest.length < maxRecords && pending.trim()) newest.push(pending.trim());
    return newest.slice(0, maxRecords);
  } finally {
    fs.closeSync(handle);
  }
}

export function listStrategyObservationRecords(options = {}) {
  const observationPath =
    clean(options.observationPath, 4096) || DEFAULT_STRATEGY_OBSERVATION_PATH;
  if (!fs.existsSync(observationPath)) return Object.freeze([]);

  const maxRecords = Math.max(1, Math.min(5000, Number(options.maxRecords) || 500));
  const records = readNewestJsonlLines(observationPath, maxRecords, options)
    .map((line) => JSON.parse(line))
    .map((record) => Object.freeze(record));

  return Object.freeze(records);
}

export default Object.freeze({
  VERSION,
  DEFAULT_STRATEGY_OBSERVATION_PATH,
  buildStrategyObservationRecord,
  appendStrategyObservationRecord,
  appendStrategyObservationReport,
  listStrategyObservationRecords,
});
