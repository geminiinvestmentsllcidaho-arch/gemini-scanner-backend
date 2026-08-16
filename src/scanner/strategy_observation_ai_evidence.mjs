export const VERSION = "strategy_observation_ai_evidence_v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function triBool(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function clean(value, maxLength = 128) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function boundedStrategyAuthorization(value) {
  if (!value || typeof value !== "object") return null;
  return Object.freeze({
    version: clean(value.version, 128) || null,
    authorized: triBool(value.authorized),
    state: clean(value.state, 32).toUpperCase() || null,
    rankingSetupScore: finite(value.rankingSetupScore),
    rankingConfidence: finite(value.rankingConfidence),
    rankingQuality: finite(value.rankingQuality),
    minimums: Object.freeze({
      setupScore: finite(value?.minimums?.setupScore),
      rankingConfidence: finite(value?.minimums?.rankingConfidence),
      rankingQuality: finite(value?.minimums?.rankingQuality),
    }),
    blockers: Object.freeze(
      (Array.isArray(value.blockers) ? value.blockers : [])
        .slice(0, 20)
        .map((item) => clean(item, 128))
        .filter(Boolean),
    ),
    symbolLevelOnly: triBool(value.symbolLevelOnly),
    portfolioRootAuthorizationUsed: triBool(value.portfolioRootAuthorizationUsed),
    paperOnly: triBool(value.paperOnly),
  });
}

export function buildBoundedStrategyObservationAiEvidence(records = []) {
  const source = Array.isArray(records) ? records : [];
  const latestByKey = new Map();

  for (const row of source) {
    const key = String(row?.key ?? "").trim();
    if (key && !latestByKey.has(key)) latestByKey.set(key, row);
  }

  const latest = [...latestByKey.values()].slice(0, 100);
  const observable = latest.filter((row) => row?.originObservable === true);
  const stale = latest.filter((row) => row?.originSourceStale === true);
  const measuredReturns = observable
    .map((row) => Number(row?.latestReturnPct))
    .filter(Number.isFinite);

  const averageLatestReturnPct = measuredReturns.length
    ? Math.round(
        (measuredReturns.reduce((sum, value) => sum + value, 0) / measuredReturns.length)
        * 10000,
      ) / 10000
    : null;

  return Object.freeze({
    version: VERSION,
    sourceRecordCount: source.length,
    uniqueObservationCount: latest.length,
    observableCount: observable.length,
    staleSourceCount: stale.length,
    measuredReturnCount: measuredReturns.length,
    positiveReturnCount: measuredReturns.filter((value) => value > 0).length,
    negativeReturnCount: measuredReturns.filter((value) => value < 0).length,
    averageLatestReturnPct,
    observations: Object.freeze(latest.slice(0, 50).map((row) => Object.freeze({
      key: String(row?.key ?? "").slice(0, 180) || null,
      originScanId: String(row?.originScanId ?? "").slice(0, 128) || null,
      originEventAt: row?.originEventAt ?? null,
      observedAt: row?.observedAt ?? null,
      symbol: String(row?.symbol ?? "").trim().toUpperCase().slice(0, 24) || null,
      scanner: String(row?.scanner ?? "").slice(0, 64) || null,
      scanType: String(row?.scanType ?? "").slice(0, 64) || null,
      strategyType: String(row?.strategyType ?? "").slice(0, 64) || null,
      decision: String(row?.decision ?? "").slice(0, 32) || null,
      resultState: String(row?.resultState ?? "").slice(0, 32) || null,
      latestReturnPct: Number.isFinite(Number(row?.latestReturnPct))
        ? Number(row.latestReturnPct)
        : null,
      maxFavorablePct: Number.isFinite(Number(row?.maxFavorablePct))
        ? Number(row.maxFavorablePct)
        : null,
      maxAdversePct: Number.isFinite(Number(row?.maxAdversePct))
        ? Number(row.maxAdversePct)
        : null,
      horizonObservations: Object.freeze({ ...(row?.horizonObservations ?? {}) }),
      horizonReturnsPct: Object.freeze({ ...(row?.horizonReturnsPct ?? {}) }),
      originObservable: row?.originObservable === true,
      originSourceStale: row?.originSourceStale === true,
      rankingConnected: triBool(row?.rankingConnected),
      rankingP3GateOk: triBool(row?.rankingP3GateOk),
      rankingSetupScore: finite(row?.rankingSetupScore),
      rankingConfidence: finite(row?.rankingConfidence),
      rankingQuality: finite(row?.rankingQuality),
      readonlyPotentialScore: finite(row?.readonlyPotentialScore),
      strategyAuthorization: boundedStrategyAuthorization(row?.strategyAuthorization),
    }))),
    readOnly: true,
    paperOnly: true,
    shadowOnly: true,
    historicalMeasurementOnly: true,
    localStoreOnly: true,
    automaticLearningAllowed: false,
    automaticPatchAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({
  VERSION,
  buildBoundedStrategyObservationAiEvidence,
});
