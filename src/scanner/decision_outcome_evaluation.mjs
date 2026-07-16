import {
  readOpportunityOutcomeTrackingReport,
} from "./opportunity_outcome_tracking.mjs";

export const VERSION = "decision_outcome_evaluation_v1";

const DEFAULT_THRESHOLDS = Object.freeze({
  positivePct: 0.25,
  negativePct: -0.25,
  meaningfulFavorablePct: 0.5,
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

function normalizeDecision(value) {
  const decision = clean(value, 32).toUpperCase().replaceAll(" ", "_");
  if (["ENTER", "WAIT", "DO_NOT_ENTER"].includes(decision)) return decision;
  return decision || "UNKNOWN";
}

function classifyOutcome(row, thresholds) {
  const observations = Math.max(0, Number(row?.observations) || 0);
  if (observations === 0) return "PENDING";

  const decision = normalizeDecision(row?.decision);
  const latestReturnPct = finite(row?.latestReturnPct) ?? 0;
  const maxFavorablePct = finite(row?.maxFavorablePct) ?? 0;
  const maxAdversePct = finite(row?.maxAdversePct) ?? 0;

  const positive = latestReturnPct >= thresholds.positivePct;
  const negative = latestReturnPct <= thresholds.negativePct;
  const meaningfulFavorable = maxFavorablePct >= thresholds.meaningfulFavorablePct;
  const avoidedLoss = maxAdversePct <= thresholds.negativePct || negative;

  if (decision === "ENTER") {
    if (positive) return "CORRECT_ENTER";
    if (negative) return "FALSE_POSITIVE_ENTER";
    if (meaningfulFavorable) return "LATE_OR_WEAK_ENTER";
    return "ENTER_INCONCLUSIVE";
  }

  if (decision === "WAIT") {
    if (positive || meaningfulFavorable) return "WAIT_TOO_LONG";
    if (avoidedLoss) return "CORRECT_WAIT";
    return "WAIT_INCONCLUSIVE";
  }

  if (decision === "DO_NOT_ENTER") {
    if (positive || meaningfulFavorable) return "MISSED_OPPORTUNITY";
    if (avoidedLoss) return "AVOIDED_LOSS";
    return "CORRECT_REJECTION";
  }

  return "UNCLASSIFIED";
}

export function buildDecisionOutcomeEvaluationReport(outcomeReport = {}, options = {}) {
  const thresholds = Object.freeze({
    positivePct: finite(options.positivePct) ?? DEFAULT_THRESHOLDS.positivePct,
    negativePct: finite(options.negativePct) ?? DEFAULT_THRESHOLDS.negativePct,
    meaningfulFavorablePct:
      finite(options.meaningfulFavorablePct) ?? DEFAULT_THRESHOLDS.meaningfulFavorablePct,
  });

  const sourceOutcomes = Array.isArray(outcomeReport?.outcomes)
    ? outcomeReport.outcomes
    : [];

  const evaluations = sourceOutcomes.map((row) => Object.freeze({
    key: clean(row?.key, 180),
    originScanId: clean(row?.originScanId, 128),
    originEventAt: clean(row?.originEventAt, 64) || null,
    symbol: clean(row?.symbol, 20).toUpperCase(),
    decision: normalizeDecision(row?.decision),
    classification: classifyOutcome(row, thresholds),
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
  }));

  const classifications = {};
  for (const row of evaluations) {
    classifications[row.classification] = (classifications[row.classification] ?? 0) + 1;
  }

  const observed = evaluations.filter((row) => row.classification !== "PENDING");
  const favorableDecisionCount = observed.filter((row) => [
    "CORRECT_ENTER",
    "CORRECT_WAIT",
    "CORRECT_REJECTION",
    "AVOIDED_LOSS",
  ].includes(row.classification)).length;

  const unfavorableDecisionCount = observed.filter((row) => [
    "FALSE_POSITIVE_ENTER",
    "WAIT_TOO_LONG",
    "MISSED_OPPORTUNITY",
    "LATE_OR_WEAK_ENTER",
  ].includes(row.classification)).length;

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    sourceVersion: clean(outcomeReport?.version, 64) || null,
    sourceOutcomeCount: sourceOutcomes.length,
    evaluationCount: evaluations.length,
    observedEvaluationCount: observed.length,
    pendingEvaluationCount: evaluations.length - observed.length,
    favorableDecisionCount,
    unfavorableDecisionCount,
    favorableDecisionRatePct: observed.length
      ? round((favorableDecisionCount / observed.length) * 100, 2)
      : null,
    classificationCounts: Object.freeze({ ...classifications }),
    thresholds,
    evaluations: Object.freeze(evaluations),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    historicalMeasurementOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

export function readDecisionOutcomeEvaluationReport(options = {}) {
  const outcomeReport = options.outcomeReport
    ?? readOpportunityOutcomeTrackingReport(options);

  return buildDecisionOutcomeEvaluationReport(outcomeReport, options);
}

export default {
  VERSION,
  buildDecisionOutcomeEvaluationReport,
  readDecisionOutcomeEvaluationReport,
};
