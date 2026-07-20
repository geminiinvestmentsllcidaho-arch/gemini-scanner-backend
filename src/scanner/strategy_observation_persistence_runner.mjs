import {
  listOpportunityFunnelAuditRecords,
} from "./opportunity_funnel_audit_store.mjs";
import {
  buildTimeBasedStrategyObservationReport,
} from "./time_based_strategy_observation_builder.mjs";
import {
  appendStrategyObservationReport,
  buildStrategyObservationRecord,
  listStrategyObservationRecords,
} from "./strategy_observation_store.mjs";

export const VERSION = "strategy_observation_persistence_runner_v1";


const MATERIAL_FIELDS = Object.freeze([
  "key",
  "originScanId",
  "originEventAt",
  "symbol",
  "scanner",
  "scanType",
  "strategyType",
  "decision",
  "resultState",
  "entryPrice",
  "latestPrice",
  "observations",
  "latestEventAt",
  "latestReturnPct",
  "maxFavorablePct",
  "maxAdversePct",
  "horizonObservations",
  "horizonReturnsPct",
  "horizonMaxFavorablePct",
  "horizonMaxAdversePct",
  "originObservable",
  "originSourceStale",
  "rankingConfidence",
  "readonlyPotentialScore",
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value ?? null;
}

function materialFingerprint(row = {}) {
  return JSON.stringify(Object.fromEntries(
    MATERIAL_FIELDS.map((key) => [key, stable(row[key])]),
  ));
}

function latestByKey(records = []) {
  const latest = new Map();
  for (const record of records) {
    const key = String(record?.key ?? "").trim();
    if (key && !latest.has(key)) latest.set(key, record);
  }
  return latest;
}

function integer(value, fallback, min = 1, max = 5000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

export function runStrategyObservationPersistence(options = {}) {
  const auditRecords = Array.isArray(options.auditRecords)
    ? options.auditRecords
    : listOpportunityFunnelAuditRecords({
        auditPath: options.auditPath,
        maxRecords: integer(options.maxAuditRecords, 1000, 1, 1000),
      });

  const chronological = [...auditRecords].reverse();
  const report = buildTimeBasedStrategyObservationReport(chronological, {
    now: options.now,
    minDecision: options.minDecision,
    intradayMinutes: options.intradayMinutes,
    swingMinSessions: options.swingMinSessions,
    swingMaxSessions: options.swingMaxSessions,
  });

  const existingRecords = listStrategyObservationRecords({
    observationPath: options.observationPath,
    maxRecords: integer(options.maxObservationRecords, 5000, 1, 5000),
  });
  const existingLatest = latestByKey(existingRecords);
  const changedOutcomes = report.outcomes.filter((outcome) => {
    const candidate = buildStrategyObservationRecord(outcome, {
      now: options.now ?? report.generatedAt,
    });
    const previous = existingLatest.get(candidate.key);
    return !previous || materialFingerprint(candidate) !== materialFingerprint(previous);
  });
  const skippedUnchangedCount = report.outcomeCount - changedOutcomes.length;

  const persistence = options.persist === false
    ? Object.freeze({
        ok: true,
        appendedCount: 0,
        records: Object.freeze([]),
        observationPath: options.observationPath ?? null,
        previewOnly: true,
        readOnly: true,
        paperOnly: true,
        localStoreOnly: true,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        liveTradingAllowed: false,
        accountMutationAllowed: false,
      })
    : appendStrategyObservationReport({
        ...report,
        outcomes: changedOutcomes,
      }, {
        observationPath: options.observationPath,
        now: options.now ?? report.generatedAt,
      });

  return Object.freeze({
    version: VERSION,
    generatedAt: report.generatedAt,
    auditRecordCount: auditRecords.length,
    outcomeCount: report.outcomeCount,
    observableOutcomeCount: report.observableOutcomeCount,
    changedOutcomeCount: changedOutcomes.length,
    skippedUnchangedCount,
    appendedCount: persistence.appendedCount,
    report,
    persistence,
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

export default Object.freeze({
  VERSION,
  runStrategyObservationPersistence,
});
