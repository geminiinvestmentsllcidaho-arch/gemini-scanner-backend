export const VERSION = "time_based_strategy_observation_builder_v1";

const TIME_ZONE = "America/New_York";
const DEFAULT_INTRADAY_MINUTES = 30;
const DEFAULT_SWING_MIN_SESSIONS = 3;
const DEFAULT_SWING_MAX_SESSIONS = 5;

function clean(value, maxLength = 128) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function timestamp(value) {
  const milliseconds = Date.parse(String(value ?? ""));
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function sessionKey(value) {
  const milliseconds = timestamp(value);
  if (milliseconds === null) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(milliseconds));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function candidateKey(scanId, symbol) {
  return `${clean(scanId, 128)}:${clean(symbol, 20).toUpperCase()}`;
}

function strategyTypeFor(record = {}) {
  const explicit = clean(record.strategyType ?? record.strategy ?? record.tradeStyle, 64).toLowerCase();
  if (explicit) return explicit;
  const scanType = clean(record.scanType ?? record.scanner, 64).toLowerCase();
  if (scanType.includes("swing")) return "swing";
  if (scanType.includes("premarket") || scanType.includes("intraday") || scanType.includes("under_five")) {
    return "intraday";
  }
  return "unclassified";
}

function metrics(entryPrice, rows = []) {
  if (!rows.length) {
    return Object.freeze({
      observations: 0,
      latestPrice: null,
      latestEventAt: null,
      returnPct: null,
      maxFavorablePct: null,
      maxAdversePct: null,
    });
  }

  const latest = rows[rows.length - 1];
  const prices = rows.map((row) => row.price);
  return Object.freeze({
    observations: rows.length,
    latestPrice: latest.price,
    latestEventAt: latest.eventAt,
    returnPct: round(((latest.price - entryPrice) / entryPrice) * 100),
    maxFavorablePct: round(((Math.max(...prices) - entryPrice) / entryPrice) * 100),
    maxAdversePct: round(((Math.min(...prices) - entryPrice) / entryPrice) * 100),
  });
}

export function buildTimeBasedStrategyObservationReport(records = [], options = {}) {
  const ordered = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === "object")
    .map((record) => ({ ...record, eventMs: timestamp(record.eventAt) }))
    .filter((record) => record.eventMs !== null)
    .sort((a, b) => a.eventMs - b.eventMs);

  const intradayMinutes = Math.max(
    1,
    Math.min(390, Number(options.intradayMinutes) || DEFAULT_INTRADAY_MINUTES),
  );
  const swingMinSessions = Math.max(
    1,
    Math.min(20, Number(options.swingMinSessions) || DEFAULT_SWING_MIN_SESSIONS),
  );
  const swingMaxSessions = Math.max(
    swingMinSessions,
    Math.min(30, Number(options.swingMaxSessions) || DEFAULT_SWING_MAX_SESSIONS),
  );
  const minDecision = clean(options.minDecision, 32).toUpperCase();
  const indexedRecords = ordered.map((record) => {
    const recordSessionKey = sessionKey(record.eventAt);
    const candidatesBySymbol = new Map();
    for (const candidate of Array.isArray(record.candidates) ? record.candidates : []) {
      const symbol = clean(candidate?.symbol, 20).toUpperCase();
      if (symbol && !candidatesBySymbol.has(symbol)) candidatesBySymbol.set(symbol, candidate);
    }
    return Object.freeze({ record, recordSessionKey, candidatesBySymbol });
  });
  const sessionKeys = [...new Set(
    indexedRecords
      .filter(({ record }) => record.marketOpen === true)
      .map(({ recordSessionKey }) => recordSessionKey)
      .filter(Boolean),
  )];
  const sessionIndex = new Map(sessionKeys.map((key, index) => [key, index]));
  const outcomes = [];

  for (let originIndex = 0; originIndex < indexedRecords.length; originIndex += 1) {
    const originMeta = indexedRecords[originIndex];
    const origin = originMeta.record;
    const originSessionKey = originMeta.recordSessionKey;
    const originSessionIndex = sessionIndex.get(originSessionKey);
    const candidates = Array.isArray(origin.candidates) ? origin.candidates : [];

    for (const candidate of candidates) {
      const symbol = clean(candidate?.symbol, 20).toUpperCase();
      const decision = clean(candidate?.decision, 32).toUpperCase() || "UNKNOWN";
      const entryPrice = finite(candidate?.price);
      if (!symbol || entryPrice === null || entryPrice <= 0) continue;
      if (minDecision && decision !== minDecision) continue;

      const originMarketOpen = origin.marketOpen === true;
      const originSourceStale = candidate?.sourceStale === true;
      const originObservable =
        originMarketOpen
        && !originSourceStale
        && originSessionKey !== null
        && Number.isInteger(originSessionIndex);

      const future = [];
      if (originObservable) {
        for (let futureIndex = originIndex + 1; futureIndex < indexedRecords.length; futureIndex += 1) {
          const futureMeta = indexedRecords[futureIndex];
          const futureRecord = futureMeta.record;
          if (futureRecord.marketOpen !== true) continue;
          const futureCandidate = futureMeta.candidatesBySymbol.get(symbol);
          if (!futureCandidate || futureCandidate.sourceStale === true) continue;
          const price = finite(futureCandidate.price);
          if (price === null || price <= 0) continue;
          const futureSessionKey = futureMeta.recordSessionKey;
          const futureSessionIndex = sessionIndex.get(futureSessionKey);
          if (!Number.isInteger(futureSessionIndex)) continue;
          future.push(Object.freeze({
            eventAt: clean(futureRecord.eventAt, 64),
            eventMs: futureRecord.eventMs,
            price,
            sessionKey: futureSessionKey,
            sessionOffset: futureSessionIndex - originSessionIndex,
          }));
        }
      }

      const intradayCutoffMs = origin.eventMs + intradayMinutes * 60 * 1000;
      const intradayRows = future.filter(
        (row) => row.sessionOffset === 0 && row.eventMs >= intradayCutoffMs,
      );
      const nextDayRows = future.filter((row) => row.sessionOffset === 1);
      const swingRows = future.filter(
        (row) => row.sessionOffset >= swingMinSessions && row.sessionOffset <= swingMaxSessions,
      );

      const intraday = metrics(entryPrice, intradayRows);
      const nextDay = metrics(entryPrice, nextDayRows);
      const swing = metrics(entryPrice, swingRows);
      const latest = future.length ? future[future.length - 1] : null;
      const allMetrics = metrics(entryPrice, future);

      outcomes.push(Object.freeze({
        key: candidateKey(origin.scanId, symbol),
        originScanId: clean(origin.scanId, 128) || null,
        originEventAt: clean(origin.eventAt, 64) || null,
        originSessionKey,
        originMarketOpen,
        originSourceStale,
        originObservable,
        symbol,
        scanner: clean(origin.scanner, 64) || null,
        scanType: clean(origin.scanType, 64) || null,
        strategyType: strategyTypeFor(origin),
        decision,
        resultState: clean(candidate?.resultState, 32).toUpperCase() || null,
        entryPrice,
        latestPrice: latest?.price ?? null,
        observations: future.length,
        latestEventAt: latest?.eventAt ?? null,
        latestReturnPct: allMetrics.returnPct,
        maxFavorablePct: allMetrics.maxFavorablePct,
        maxAdversePct: allMetrics.maxAdversePct,
        horizonObservations: Object.freeze({
          intraday: intraday.observations,
          next_day: nextDay.observations,
          swing_3_5_day: swing.observations,
        }),
        horizonReturnsPct: Object.freeze({
          intraday: intraday.returnPct,
          next_day: nextDay.returnPct,
          swing_3_5_day: swing.returnPct,
        }),
        horizonMaxFavorablePct: Object.freeze({
          intraday: intraday.maxFavorablePct,
          next_day: nextDay.maxFavorablePct,
          swing_3_5_day: swing.maxFavorablePct,
        }),
        horizonMaxAdversePct: Object.freeze({
          intraday: intraday.maxAdversePct,
          next_day: nextDay.maxAdversePct,
          swing_3_5_day: swing.maxAdversePct,
        }),
        horizonLatestEventAt: Object.freeze({
          intraday: intraday.latestEventAt,
          next_day: nextDay.latestEventAt,
          swing_3_5_day: swing.latestEventAt,
        }),
        readonlyPotentialScore: finite(candidate?.readonlyPotentialScore),
        rankingConfidence: finite(candidate?.rankingConfidence),
        readOnly: true,
        paperOnly: true,
        shadowOnly: true,
        historicalMeasurementOnly: true,
        automaticLearningAllowed: false,
        automaticPatchAllowed: false,
        scannerLogicMutationAllowed: false,
        thresholdMutationAllowed: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        liveTradingAllowed: false,
        accountMutationAllowed: false,
      }));
    }
  }

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    timeZone: TIME_ZONE,
    intradayMinutes,
    swingMinSessions,
    swingMaxSessions,
    sourceRecordCount: ordered.length,
    sessionCount: sessionKeys.length,
    outcomeCount: outcomes.length,
    observableOutcomeCount: outcomes.filter((row) => row.originObservable).length,
    outcomes: Object.freeze(outcomes),
    readOnly: true,
    paperOnly: true,
    shadowOnly: true,
    historicalMeasurementOnly: true,
    elapsedTimeHorizons: true,
    marketSessionHorizons: true,
    freshSourceObservationsOnly: true,
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

export default Object.freeze({
  VERSION,
  buildTimeBasedStrategyObservationReport,
});
