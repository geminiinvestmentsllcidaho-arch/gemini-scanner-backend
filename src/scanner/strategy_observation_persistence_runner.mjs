import {
  listOpportunityFunnelAuditRecords,
} from "./opportunity_funnel_audit_store.mjs";
import {
  buildTimeBasedStrategyObservationReport,
} from "./time_based_strategy_observation_builder.mjs";
import {
  appendStrategyObservationReport,
} from "./strategy_observation_store.mjs";

export const VERSION = "strategy_observation_persistence_runner_v1";

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
    : appendStrategyObservationReport(report, {
        observationPath: options.observationPath,
        now: options.now ?? report.generatedAt,
      });

  return Object.freeze({
    version: VERSION,
    generatedAt: report.generatedAt,
    auditRecordCount: auditRecords.length,
    outcomeCount: report.outcomeCount,
    observableOutcomeCount: report.observableOutcomeCount,
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
