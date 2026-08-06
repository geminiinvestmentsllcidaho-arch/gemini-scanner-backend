import { consolidatePremarketScansReadonly } from "./premarket_multiscan_consolidation_readonly.mjs";
import { buildPremarketOutcomeValidationReadonly } from "./premarket_outcome_validation_readonly.mjs";

export const VERSION = "premarket_outcome_validation_adapter_readonly_v1";

const clean = (value, max = 128) => String(value ?? "").trim().slice(0, max);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function outcomeQuality(row = {}) {
  const sourceFresh = row.originObservable === true
    && row.originSourceStale !== true
    && Number(row.observations ?? 0) > 0;
  const complete = [row.latestReturnPct, row.maxFavorablePct, row.maxAdversePct]
    .every((value) => finite(value) !== null);
  return (sourceFresh ? 2 : 0) + (complete ? 1 : 0);
}

function selectBestOutcomePerSymbol(rows = []) {
  const selected = new Map();
  for (const row of rows) {
    const symbol = clean(row?.symbol, 24).toUpperCase();
    if (!symbol) continue;
    const prior = selected.get(symbol);
    if (!prior || outcomeQuality(row) > outcomeQuality(prior)) {
      selected.set(symbol, row);
      continue;
    }
    if (outcomeQuality(row) === outcomeQuality(prior)) {
      const rowAt = String(row?.latestEventAt ?? row?.originEventAt ?? "");
      const priorAt = String(prior?.latestEventAt ?? prior?.originEventAt ?? "");
      if (rowAt > priorAt) selected.set(symbol, row);
    }
  }
  return [...selected.values()];
}

function outcomeToSession(row = {}) {
  const referencePrice = finite(row.entryPrice);
  const latestReturnPct = finite(row.latestReturnPct);
  const maxFavorablePct = finite(row.maxFavorablePct);
  const maxAdversePct = finite(row.maxAdversePct);
  const latestPrice = finite(row.latestPrice)
    ?? (referencePrice !== null && latestReturnPct !== null
      ? referencePrice * (1 + latestReturnPct / 100)
      : null);
  return Object.freeze({
    symbol: clean(row.symbol, 24).toUpperCase(),
    observedAt: row.latestEventAt ?? row.originEventAt ?? null,
    referencePrice,
    latestPrice,
    sessionHigh: referencePrice !== null && maxFavorablePct !== null
      ? referencePrice * (1 + maxFavorablePct / 100)
      : latestPrice,
    sessionLow: referencePrice !== null && maxAdversePct !== null
      ? referencePrice * (1 + maxAdversePct / 100)
      : latestPrice,
    regularDecisionState: clean(row.decision ?? row.resultState, 64).toUpperCase() || "UNKNOWN",
    spreadPct: finite(row.spreadPct),
    dollarVolume: finite(row.dollarVolume),
    momentumPct: finite(row.momentumPct),
    sourceFresh: row.originObservable === true
      && row.originSourceStale !== true
      && Number(row.observations ?? 0) > 0,
  });
}

export function buildPremarketOutcomeValidationFromHistoryReadonly({
  premarketScans = [],
  opportunityOutcomeReport = {},
  generatedAt = new Date().toISOString(),
  minimumObservedSample = 20,
  baselineDecisions = ["WATCH", "WAIT", "DO_NOT_ENTER"],
} = {}) {
  const consolidation = consolidatePremarketScansReadonly(premarketScans, { generatedAt });
  const outcomes = Array.isArray(opportunityOutcomeReport?.outcomes)
    ? opportunityOutcomeReport.outcomes
    : [];
  const trackedSymbols = new Set(consolidation.candidates.map(row => clean(row.symbol, 24).toUpperCase()));
  const allowedBaseline = new Set(baselineDecisions.map(value => clean(value, 64).toUpperCase()));
  const regularSessionObservations = selectBestOutcomePerSymbol(
    outcomes.filter(row => trackedSymbols.has(clean(row?.symbol, 24).toUpperCase())),
  ).map(outcomeToSession);
  const baselineObservations = selectBestOutcomePerSymbol(
    outcomes
      .filter(row => !trackedSymbols.has(clean(row?.symbol, 24).toUpperCase()))
      .filter(row => allowedBaseline.has(clean(row?.decision ?? row?.resultState, 64).toUpperCase())),
  ).map(outcomeToSession);
  return Object.freeze({
    ...buildPremarketOutcomeValidationReadonly({
      premarketCandidates: consolidation.candidates,
      regularSessionObservations,
      baselineObservations,
      generatedAt,
      minimumObservedSample,
    }),
    adapterVersion: VERSION,
    sourcePremarketScanCount: consolidation.sourceScanCount,
    sourcePremarketCandidateCount: consolidation.candidateCount,
    sourceOutcomeCount: outcomes.length,
    matchedTrackedOutcomeCount: regularSessionObservations.length,
    baselineOutcomeCount: baselineObservations.length,
    historicalMeasurementOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({ VERSION, buildPremarketOutcomeValidationFromHistoryReadonly });
