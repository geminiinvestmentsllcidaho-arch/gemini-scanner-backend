export const VERSION = "multi_horizon_strategy_evaluator_v1";

const DEFAULT_HORIZONS = Object.freeze([
  Object.freeze({
    id: "intraday",
    label: "Intraday",
    minimumObservations: 4,
    targetReturnPct: 0.5,
    maximumAdversePct: -0.75,
  }),
  Object.freeze({
    id: "next_day",
    label: "Next trading day",
    minimumObservations: 1,
    targetReturnPct: 1,
    maximumAdversePct: -1.5,
  }),
  Object.freeze({
    id: "swing_3_5_day",
    label: "Three-to-five trading days",
    minimumObservations: 3,
    targetReturnPct: 2,
    maximumAdversePct: -3,
  }),
]);

function clean(value, maxLength = 128) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integer(value, fallback, min = 0, max = 1000000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function normalizeHorizons(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_HORIZONS;
  return Object.freeze(source.slice(0, 12).map((row, index) => Object.freeze({
    id: clean(row?.id, 64) || `horizon_${index + 1}`,
    label: clean(row?.label, 128) || clean(row?.id, 64) || `Horizon ${index + 1}`,
    minimumObservations: integer(row?.minimumObservations, 1, 1, 10000),
    targetReturnPct: finite(row?.targetReturnPct) ?? 0,
    maximumAdversePct: finite(row?.maximumAdversePct) ?? -1,
  })));
}

function strategyFor(row = {}) {
  const explicit = clean(row.strategyType ?? row.strategy ?? row.tradeStyle, 64).toLowerCase();
  if (explicit) return explicit;
  const scanType = clean(row.scanType ?? row.scanner, 64).toLowerCase();
  if (scanType.includes("swing")) return "swing";
  if (scanType.includes("premarket") || scanType.includes("intraday") || scanType.includes("under_five")) {
    return "intraday";
  }
  return "unclassified";
}

function horizonEvaluation(row, horizon) {
  const observations = integer(
    row?.horizonObservations?.[horizon.id]
      ?? row?.observationsByHorizon?.[horizon.id]
      ?? row?.observations,
    0,
  );
  const latestReturnPct = finite(
    row?.horizonReturnsPct?.[horizon.id]
      ?? row?.returnsByHorizon?.[horizon.id]
      ?? row?.latestReturnPct,
  );
  const maxFavorablePct = finite(
    row?.horizonMaxFavorablePct?.[horizon.id]
      ?? row?.maxFavorableByHorizon?.[horizon.id]
      ?? row?.maxFavorablePct,
  );
  const maxAdversePct = finite(
    row?.horizonMaxAdversePct?.[horizon.id]
      ?? row?.maxAdverseByHorizon?.[horizon.id]
      ?? row?.maxAdversePct,
  );

  let status = "PENDING";
  if (observations >= horizon.minimumObservations && latestReturnPct !== null) {
    if (
      latestReturnPct >= horizon.targetReturnPct
      && (maxAdversePct === null || maxAdversePct >= horizon.maximumAdversePct)
    ) {
      status = "TARGET_MET";
    } else if (
      maxAdversePct !== null
      && maxAdversePct < horizon.maximumAdversePct
    ) {
      status = "RISK_LIMIT_BREACH";
    } else if (
      maxFavorablePct !== null
      && maxFavorablePct >= horizon.targetReturnPct
      && latestReturnPct < horizon.targetReturnPct
    ) {
      status = "EXIT_TIMING_REVIEW";
    } else {
      status = "TARGET_NOT_MET";
    }
  }

  return Object.freeze({
    horizonId: horizon.id,
    horizonLabel: horizon.label,
    observations,
    minimumObservations: horizon.minimumObservations,
    targetReturnPct: horizon.targetReturnPct,
    maximumAdversePct: horizon.maximumAdversePct,
    latestReturnPct,
    maxFavorablePct,
    maxAdversePct,
    status,
    observed: status !== "PENDING",
  });
}

function buildStrategySummary(rows, strategyType) {
  const matching = rows.filter((row) => row.strategyType === strategyType);
  const observed = matching.flatMap((row) => row.horizons).filter((row) => row.observed);
  const targetMet = observed.filter((row) => row.status === "TARGET_MET");
  const riskBreaches = observed.filter((row) => row.status === "RISK_LIMIT_BREACH");

  return Object.freeze({
    strategyType,
    candidateCount: matching.length,
    observedHorizonCount: observed.length,
    targetMetCount: targetMet.length,
    riskLimitBreachCount: riskBreaches.length,
    targetMetRatePct: observed.length
      ? round((targetMet.length / observed.length) * 100, 2)
      : null,
    averageLatestReturnPct: average(observed.map((row) => row.latestReturnPct)),
    averageMaxFavorablePct: average(observed.map((row) => row.maxFavorablePct)),
    averageMaxAdversePct: average(observed.map((row) => row.maxAdversePct)),
    promotionEligible: false,
    promotionBlockedReason: matching.length
      ? "EVIDENCE_COLLECTION_AND_SHADOW_VALIDATION_REQUIRED"
      : "NO_CANDIDATES",
  });
}

export function buildMultiHorizonStrategyEvaluationReport(input = {}, options = {}) {
  const sourceRows = Array.isArray(input)
    ? input
    : Array.isArray(input?.outcomes)
      ? input.outcomes
      : Array.isArray(input?.evaluations)
        ? input.evaluations
        : [];
  const horizons = normalizeHorizons(options.horizons);
  const rows = sourceRows.slice(0, 5000).map((row, index) => {
    const strategyType = strategyFor(row);
    return Object.freeze({
      key: clean(row?.key, 180) || `multi-horizon-${index + 1}`,
      symbol: clean(row?.symbol, 20).toUpperCase() || null,
      strategyType,
      decision: clean(row?.decision, 32).toUpperCase() || "UNKNOWN",
      originEventAt: clean(row?.originEventAt ?? row?.eventAt, 64) || null,
      originObservable: row?.originObservable !== false && row?.sourceStale !== true,
      rankingConfidence: finite(row?.rankingConfidence),
      readonlyPotentialScore: finite(row?.readonlyPotentialScore),
      horizons: Object.freeze(horizons.map((horizon) => horizonEvaluation(row, horizon))),
      readOnly: true,
      paperOnly: true,
      shadowOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      accountMutationAllowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
    });
  });

  const strategyTypes = [...new Set(rows.map((row) => row.strategyType))];
  const strategySummaries = strategyTypes
    .map((strategyType) => buildStrategySummary(rows, strategyType))
    .sort((a, b) => a.strategyType.localeCompare(b.strategyType));

  const horizonStatusCounts = {};
  for (const row of rows) {
    for (const horizon of row.horizons) {
      horizonStatusCounts[horizon.status] = (horizonStatusCounts[horizon.status] ?? 0) + 1;
    }
  }

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    sourceRecordCount: sourceRows.length,
    candidateCount: rows.length,
    horizonCount: horizons.length,
    horizons,
    strategySummaryCount: strategySummaries.length,
    strategySummaries: Object.freeze(strategySummaries),
    horizonStatusCounts: Object.freeze({ ...horizonStatusCounts }),
    evaluations: Object.freeze(rows),
    readinessState: "OBSERVATION_AND_SHADOW_VALIDATION",
    promotionEligible: false,
    profitabilityGuaranteed: false,
    readOnly: true,
    paperOnly: true,
    shadowOnly: true,
    proposalOnly: true,
    humanReviewRequired: true,
    separateApprovalRequired: true,
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
  buildMultiHorizonStrategyEvaluationReport,
});
