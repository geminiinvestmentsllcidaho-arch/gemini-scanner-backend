import {
  readDecisionOutcomeEvaluationReport,
} from "./decision_outcome_evaluation.mjs";

export const VERSION = "decision_quality_classification_v1";

const QUALITY_MAP = Object.freeze({
  CORRECT_ENTER: Object.freeze({
    qualityClass: "STRONG_DECISION",
    qualityLabel: "Correct entry",
    severity: "positive",
    reviewPriority: 0,
  }),
  CORRECT_WAIT: Object.freeze({
    qualityClass: "STRONG_DECISION",
    qualityLabel: "Correct wait",
    severity: "positive",
    reviewPriority: 0,
  }),
  CORRECT_REJECTION: Object.freeze({
    qualityClass: "STRONG_DECISION",
    qualityLabel: "Correct rejection",
    severity: "positive",
    reviewPriority: 0,
  }),
  AVOIDED_LOSS: Object.freeze({
    qualityClass: "CAPITAL_PROTECTION_SUCCESS",
    qualityLabel: "Avoided loss",
    severity: "positive",
    reviewPriority: 0,
  }),
  FALSE_POSITIVE_ENTER: Object.freeze({
    qualityClass: "FALSE_POSITIVE",
    qualityLabel: "False-positive entry",
    severity: "high",
    reviewPriority: 4,
  }),
  MISSED_OPPORTUNITY: Object.freeze({
    qualityClass: "MISSED_OPPORTUNITY",
    qualityLabel: "Missed opportunity",
    severity: "high",
    reviewPriority: 4,
  }),
  WAIT_TOO_LONG: Object.freeze({
    qualityClass: "LATE_DECISION",
    qualityLabel: "Waited too long",
    severity: "medium",
    reviewPriority: 3,
  }),
  LATE_OR_WEAK_ENTER: Object.freeze({
    qualityClass: "LATE_ENTRY",
    qualityLabel: "Late or weak entry",
    severity: "medium",
    reviewPriority: 3,
  }),
  ENTER_INCONCLUSIVE: Object.freeze({
    qualityClass: "NEAR_MISS",
    qualityLabel: "Entry near miss",
    severity: "low",
    reviewPriority: 2,
  }),
  WAIT_INCONCLUSIVE: Object.freeze({
    qualityClass: "NEAR_MISS",
    qualityLabel: "Wait near miss",
    severity: "low",
    reviewPriority: 2,
  }),
  PENDING: Object.freeze({
    qualityClass: "PENDING",
    qualityLabel: "Pending observation",
    severity: "pending",
    reviewPriority: 0,
  }),
  UNCLASSIFIED: Object.freeze({
    qualityClass: "UNCLASSIFIED",
    qualityLabel: "Unclassified decision",
    severity: "unknown",
    reviewPriority: 1,
  }),
});

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

function qualityFor(classification) {
  return QUALITY_MAP[classification] ?? QUALITY_MAP.UNCLASSIFIED;
}

function reviewReason(row, quality) {
  const latest = finite(row?.latestReturnPct);
  const favorable = finite(row?.maxFavorablePct);
  const adverse = finite(row?.maxAdversePct);
  const flags = Array.isArray(row?.blockingFlags) ? row.blockingFlags : [];

  const evidence = [
    latest === null ? null : `latest_return_pct=${latest}`,
    favorable === null ? null : `max_favorable_pct=${favorable}`,
    adverse === null ? null : `max_adverse_pct=${adverse}`,
    flags.length ? `blocking_flags=${flags.slice(0, 5).join(",")}` : null,
  ].filter(Boolean);

  return clean(`${quality.qualityLabel}${evidence.length ? `; ${evidence.join("; ")}` : ""}`, 500);
}

export function buildDecisionQualityClassificationReport(evaluationReport = {}, options = {}) {
  const sourceEvaluations = Array.isArray(evaluationReport?.evaluations)
    ? evaluationReport.evaluations
    : [];

  const items = sourceEvaluations.map((row) => {
    const classification = clean(row?.classification, 64).toUpperCase() || "UNCLASSIFIED";
    const quality = qualityFor(classification);

    return Object.freeze({
      key: clean(row?.key, 180),
      originScanId: clean(row?.originScanId, 128),
      originEventAt: clean(row?.originEventAt, 64) || null,
      symbol: clean(row?.symbol, 20).toUpperCase(),
      decision: clean(row?.decision, 32).toUpperCase() || "UNKNOWN",
      outcomeClassification: classification,
      qualityClass: quality.qualityClass,
      qualityLabel: quality.qualityLabel,
      severity: quality.severity,
      reviewPriority: quality.reviewPriority,
      reviewRequired: quality.reviewPriority > 0,
      reviewReason: reviewReason(row, quality),
      observations: Math.max(0, Number(row?.observations) || 0),
      entryPrice: finite(row?.entryPrice),
      latestPrice: finite(row?.latestPrice),
      latestReturnPct: finite(row?.latestReturnPct),
      maxFavorablePct: finite(row?.maxFavorablePct),
      maxAdversePct: finite(row?.maxAdversePct),
      readonlyPotentialScore: finite(row?.readonlyPotentialScore),
      rankingConfidence: finite(row?.rankingConfidence),
      blockingFlags: Object.freeze(
        (Array.isArray(row?.blockingFlags) ? row.blockingFlags : [])
          .slice(0, 20)
          .map((flag) => clean(flag, 128))
          .filter(Boolean),
      ),
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
    });
  });

  const qualityClassCounts = {};
  const severityCounts = {};
  for (const item of items) {
    qualityClassCounts[item.qualityClass] = (qualityClassCounts[item.qualityClass] ?? 0) + 1;
    severityCounts[item.severity] = (severityCounts[item.severity] ?? 0) + 1;
  }

  const observed = items.filter((item) => item.qualityClass !== "PENDING");
  const reviewItems = observed
    .filter((item) => item.reviewRequired)
    .slice()
    .sort((a, b) =>
      b.reviewPriority - a.reviewPriority
      || Math.abs(Number(b.latestReturnPct) || 0) - Math.abs(Number(a.latestReturnPct) || 0)
      || a.symbol.localeCompare(b.symbol));

  const falsePositiveCount = qualityClassCounts.FALSE_POSITIVE ?? 0;
  const missedOpportunityCount = qualityClassCounts.MISSED_OPPORTUNITY ?? 0;
  const lateEntryCount = qualityClassCounts.LATE_ENTRY ?? 0;
  const lateDecisionCount = qualityClassCounts.LATE_DECISION ?? 0;
  const nearMissCount = qualityClassCounts.NEAR_MISS ?? 0;

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    sourceVersion: clean(evaluationReport?.version, 64) || null,
    sourceEvaluationCount: sourceEvaluations.length,
    classificationCount: items.length,
    observedClassificationCount: observed.length,
    pendingClassificationCount: items.length - observed.length,
    reviewRequiredCount: reviewItems.length,
    falsePositiveCount,
    missedOpportunityCount,
    lateEntryCount,
    lateDecisionCount,
    nearMissCount,
    reviewRequiredRatePct: observed.length
      ? round((reviewItems.length / observed.length) * 100, 2)
      : null,
    qualityClassCounts: Object.freeze({ ...qualityClassCounts }),
    severityCounts: Object.freeze({ ...severityCounts }),
    reviewQueue: Object.freeze(reviewItems.slice(0, Math.max(1, Math.min(500, Number(options.maxReviewItems) || 100)))),
    classifications: Object.freeze(items),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    historicalMeasurementOnly: true,
    proposalGenerationAllowed: true,
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

export function readDecisionQualityClassificationReport(options = {}) {
  const evaluationReport = options.evaluationReport
    ?? readDecisionOutcomeEvaluationReport(options);

  return buildDecisionQualityClassificationReport(evaluationReport, options);
}

export default {
  VERSION,
  buildDecisionQualityClassificationReport,
  readDecisionQualityClassificationReport,
};
