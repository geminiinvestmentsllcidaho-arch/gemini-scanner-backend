import {
  listOpportunityFunnelAuditRecords,
} from "./opportunity_funnel_audit_store.mjs";

export const VERSION = "opportunity_outcome_tracking_v1";

function clean(value, maxLength = 128) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function candidateKey(scanId, symbol) {
  return `${clean(scanId, 128)}:${clean(symbol, 20).toUpperCase()}`;
}

export function buildOpportunityOutcomeTrackingReport(records = [], options = {}) {
  const ordered = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === "object")
    .slice()
    .sort((a, b) => String(a.eventAt ?? "").localeCompare(String(b.eventAt ?? "")));

  const horizonScans = Math.max(1, Math.min(240, Number(options.horizonScans) || 4));
  const minDecision = clean(options.minDecision, 32).toUpperCase();
  const outcomes = [];

  for (let scanIndex = 0; scanIndex < ordered.length; scanIndex += 1) {
    const origin = ordered[scanIndex];
    const candidates = Array.isArray(origin.candidates) ? origin.candidates : [];

    for (const candidate of candidates) {
      const symbol = clean(candidate?.symbol, 20).toUpperCase();
      const decision = clean(candidate?.decision, 32).toUpperCase() || "UNKNOWN";
      const entryPrice = finite(candidate?.price);

      if (!symbol || entryPrice === null || entryPrice <= 0) continue;
      if (minDecision && decision !== minDecision) continue;

      const originMarketOpen = origin?.marketOpen === true;
      const originSourceStale = candidate?.sourceStale === true;
      const originObservable = originMarketOpen && !originSourceStale;
      let observations = 0;
      let latestPrice = null;
      let maxPrice = entryPrice;
      let minPrice = entryPrice;
      let latestEventAt = null;

      let futureOpenScans = 0;
      for (let futureIndex = scanIndex + 1; futureIndex < ordered.length; futureIndex += 1) {
        const futureRecord = ordered[futureIndex];
        if (!originObservable || futureRecord?.marketOpen !== true) continue;
        const futureCandidate = (Array.isArray(futureRecord.candidates)
          ? futureRecord.candidates
          : []).find((row) => clean(row?.symbol, 20).toUpperCase() === symbol);

        if (!futureCandidate || futureCandidate?.sourceStale === true) continue;
        const futurePrice = finite(futureCandidate?.price);
        if (futurePrice === null || futurePrice <= 0) continue;

        futureOpenScans += 1;
        if (futureOpenScans > horizonScans) break;
        observations += 1;
        latestPrice = futurePrice;
        latestEventAt = clean(futureRecord.eventAt, 64) || null;
        maxPrice = Math.max(maxPrice, futurePrice);
        minPrice = Math.min(minPrice, futurePrice);
      }

      const latestReturnPct = latestPrice === null
        ? null
        : round(((latestPrice - entryPrice) / entryPrice) * 100);
      const maxFavorablePct = round(((maxPrice - entryPrice) / entryPrice) * 100);
      const maxAdversePct = round(((minPrice - entryPrice) / entryPrice) * 100);

      outcomes.push(Object.freeze({
        key: candidateKey(origin.scanId, symbol),
        originScanId: clean(origin.scanId, 128),
        originEventAt: clean(origin.eventAt, 64) || null,
        originMarketOpen,
        originSourceStale,
        originObservable,
        symbol,
        decision,
        resultState: clean(candidate?.resultState, 32).toUpperCase() || null,
        entryPrice,
        latestPrice,
        observations,
        horizonScans,
        latestEventAt,
        latestReturnPct,
        maxFavorablePct,
        maxAdversePct,
        readonlyPotentialScore: finite(candidate?.readonlyPotentialScore),
        rankingConfidence: finite(candidate?.rankingConfidence),
        blockingFlags: Object.freeze(
          (Array.isArray(candidate?.blockingFlags) ? candidate.blockingFlags : [])
            .slice(0, 20)
            .map((flag) => clean(flag, 128))
            .filter(Boolean),
        ),
        readOnly: true,
        paperOnly: true,
        decisionAssistOnly: true,
        scannerLogicMutationAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
      }));
    }
  }

  const observed = outcomes.filter((row) => row.observations > 0);
  const positive = observed.filter((row) => Number(row.latestReturnPct) > 0);
  const negative = observed.filter((row) => Number(row.latestReturnPct) < 0);
  const flat = observed.filter((row) => Number(row.latestReturnPct) === 0);
  const averageLatestReturnPct = observed.length
    ? round(observed.reduce((sum, row) => sum + Number(row.latestReturnPct), 0) / observed.length)
    : null;

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    horizonScans,
    sourceRecordCount: ordered.length,
    outcomeCount: outcomes.length,
    observedOutcomeCount: observed.length,
    pendingOutcomeCount: outcomes.length - observed.length,
    positiveOutcomeCount: positive.length,
    negativeOutcomeCount: negative.length,
    flatOutcomeCount: flat.length,
    positiveRatePct: observed.length
      ? round((positive.length / observed.length) * 100, 2)
      : null,
    averageLatestReturnPct,
    outcomes: Object.freeze(outcomes),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    historicalMeasurementOnly: true,
    marketOpenObservationsOnly: true,
    freshSourceObservationsOnly: true,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

export function readOpportunityOutcomeTrackingReport(options = {}) {
  const maxRecords = Math.max(
    2,
    Math.min(1000, Number(options.maxRecords) || 100),
  );

  const records = listOpportunityFunnelAuditRecords({
    auditPath: options.auditPath,
    maxRecords,
  }).slice().reverse();

  return buildOpportunityOutcomeTrackingReport(records, options);
}

export default {
  VERSION,
  buildOpportunityOutcomeTrackingReport,
  readOpportunityOutcomeTrackingReport,
};
