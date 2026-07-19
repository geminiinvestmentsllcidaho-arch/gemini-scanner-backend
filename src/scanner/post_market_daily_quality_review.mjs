import {
  buildDecisionQualityClassificationReport,
} from "./decision_quality_classification.mjs";
import {
  buildDecisionQualityProposalReport,
} from "./decision_quality_proposal_generation.mjs";
import {
  buildProposalEvidenceAggregationCalibrationReview,
} from "./proposal_evidence_aggregation_calibration_review.mjs";
import {
  buildProposalCalibrationHistoryRecord,
} from "./proposal_calibration_history_store.mjs";

export const VERSION = "post_market_daily_quality_review_v1";

function clean(value, maxLength = 128) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function frozenArray(value) {
  return Object.freeze(Array.isArray(value) ? [...value] : []);
}

function classificationForPostMarket(row = {}) {
  const riskState = clean(row.riskState ?? row.positionRiskState, 64).toUpperCase();
  const overnightState = clean(row.overnightState, 64).toUpperCase();
  const nextDayState = clean(row.nextDayState, 64).toUpperCase();

  if (
    riskState === "DATA_STALE"
    || riskState === "REVIEW_UNAVAILABLE"
    || overnightState === "INSUFFICIENT_DATA"
    || nextDayState === "AVOID_WATCH_ONLY" && row.sourceObservable === false
  ) {
    return "PENDING";
  }

  if (
    riskState === "EXIT_REVIEW_REQUIRED"
    || overnightState === "DO_NOT_CARRY_WITHOUT_REVIEW"
  ) {
    return "CAPITAL_PROTECTION_SUCCESS";
  }

  if (
    riskState === "REDUCE_RISK_REVIEW"
    || overnightState === "ELEVATED_OVERNIGHT_RISK"
    || nextDayState === "GAP_RISK_WATCH"
  ) {
    return "WAIT_INCONCLUSIVE";
  }

  if (
    nextDayState === "BREAKOUT_CONFIRMATION_REQUIRED"
    || nextDayState === "PULLBACK_WATCH"
  ) {
    return "LATE_DECISION";
  }

  if (nextDayState === "CONTINUATION_WATCH") {
    return "MISSED_OPPORTUNITY";
  }

  if (
    riskState === "POSITION_HEALTHY"
    || riskState === "HOLD_WITH_CAUTION"
    || overnightState === "SUITABLE_FOR_OVERNIGHT_REVIEW"
    || nextDayState === "NO_NEXT_DAY_SETUP"
  ) {
    return "STRONG_DECISION";
  }

  return "UNCLASSIFIED";
}

function toEvaluationRow(row = {}, index = 0) {
  const symbol = clean(row.symbol, 24).toUpperCase() || null;
  const classification = classificationForPostMarket(row);
  const sourceTimestamp = row.sourceTimestamp ?? row.generatedAt ?? null;
  const sourceStale = row.sourceStale === true
    || clean(row.riskState ?? row.positionRiskState, 64).toUpperCase() === "DATA_STALE";
  const sourceObservable = row.sourceObservable !== false && !sourceStale;

  return Object.freeze({
    key: clean(row.key, 160) || `post-market-${symbol ?? "unknown"}-${index + 1}`,
    symbol,
    decision: clean(row.nextDayState ?? row.overnightState ?? row.riskState, 64).toUpperCase() || "POST_MARKET_REVIEW",
    classification,
    outcomeClass: classification,
    rankingConfidence: Number.isFinite(Number(row.rankingConfidence))
      ? Number(row.rankingConfidence)
      : null,
    blockingFlags: frozenArray(row.flags),
    sourceTimestamp,
    originMarketOpen: false,
    originSourceStale: sourceStale,
    originObservable: sourceObservable,
    scanType: "post_market",
    scanner: "post_market_position_review",
    reviewOnly: true,
    paperOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export function buildPostMarketDailyQualityReview(rows = [], options = {}) {
  const evaluations = (Array.isArray(rows) ? rows : []).map(toEvaluationRow);
  const evaluationReport = Object.freeze({
    version: VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    marketOpenObservationsOnly: false,
    freshSourceObservationsOnly: evaluations.every((row) => row.originObservable === true),
    evaluations: Object.freeze(evaluations),
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });

  const classificationReport = buildDecisionQualityClassificationReport(evaluationReport, options);
  const proposalReport = buildDecisionQualityProposalReport(classificationReport, options);
  const calibrationReview = buildProposalEvidenceAggregationCalibrationReview(proposalReport, options);
  const calibrationHistoryRecord = buildProposalCalibrationHistoryRecord(
    proposalReport,
    calibrationReview,
    { generatedAt: evaluationReport.generatedAt },
  );

  return Object.freeze({
    version: VERSION,
    generatedAt: evaluationReport.generatedAt,
    sourceRecordCount: evaluations.length,
    evaluationReport,
    classificationReport,
    proposalReport,
    calibrationReview,
    calibrationHistoryRecord,
    readOnly: true,
    paperOnly: true,
    proposalOnly: true,
    humanReviewRequired: true,
    separateApprovalRequired: true,
    implementationIncluded: false,
    patchIncluded: false,
    automaticLearningAllowed: false,
    automaticPatchAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({
  VERSION,
  buildPostMarketDailyQualityReview,
});
