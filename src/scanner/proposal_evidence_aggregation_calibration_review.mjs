import {
  readDecisionQualityProposalReport,
} from "./decision_quality_proposal_generation.mjs";

export const VERSION = "proposal_evidence_aggregation_calibration_review_v1";

function clean(value, maxLength = 256) {
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

function average(values) {
  const numbers = values.filter(Number.isFinite);
  if (!numbers.length) return null;
  return round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, 4);
}

function calibrationBand(sampleCount) {
  if (sampleCount >= 50) return "STRONG_SAMPLE";
  if (sampleCount >= 20) return "MODERATE_SAMPLE";
  if (sampleCount >= 5) return "EARLY_SAMPLE";
  return "INSUFFICIENT_SAMPLE";
}

function reviewStatus(sampleCount, disagreementRatePct) {
  if (sampleCount < 5) return "INSUFFICIENT_EVIDENCE";
  if (disagreementRatePct !== null && disagreementRatePct >= 60) return "HIGH_CALIBRATION_CONCERN";
  if (disagreementRatePct !== null && disagreementRatePct >= 35) return "CALIBRATION_REVIEW_REQUIRED";
  return "CALIBRATION_OBSERVATION_ONLY";
}

function aggregateProposalGroup(proposals, key, value) {
  const rows = proposals.filter((proposal) => clean(proposal?.[key], 128) === value);
  const confidenceValues = rows.map((row) => finite(row?.evidence?.rankingConfidence));
  const potentialValues = rows.map((row) => finite(row?.evidence?.readonlyPotentialScore));
  const latestReturns = rows.map((row) => finite(row?.evidence?.latestReturnPct));
  const favorableReturns = rows.map((row) => finite(row?.evidence?.maxFavorablePct));
  const adverseReturns = rows.map((row) => finite(row?.evidence?.maxAdversePct));
  const symbols = [...new Set(rows.map((row) => clean(row?.evidence?.symbol, 20)).filter(Boolean))];
  const scanIds = [...new Set(rows.map((row) => clean(row?.sourceScanId, 128)).filter(Boolean))];
  const blockingFlagCounts = {};

  for (const row of rows) {
    for (const flag of Array.isArray(row?.evidence?.blockingFlags) ? row.evidence.blockingFlags : []) {
      const normalized = clean(flag, 128);
      if (normalized) blockingFlagCounts[normalized] = (blockingFlagCounts[normalized] ?? 0) + 1;
    }
  }

  const highConfidenceConcernCount = rows.filter((row) => {
    const confidence = finite(row?.evidence?.rankingConfidence);
    return confidence !== null && confidence >= 0.75;
  }).length;
  const disagreementRatePct = rows.length
    ? round((highConfidenceConcernCount / rows.length) * 100, 2)
    : null;

  return Object.freeze({
    groupBy: key,
    groupKey: value,
    sampleCount: rows.length,
    uniqueSymbolCount: symbols.length,
    uniqueScanCount: scanIds.length,
    averageRankingConfidence: average(confidenceValues),
    averagePotentialScore: average(potentialValues),
    averageLatestReturnPct: average(latestReturns),
    averageMaxFavorablePct: average(favorableReturns),
    averageMaxAdversePct: average(adverseReturns),
    highConfidenceConcernCount,
    disagreementRatePct,
    calibrationBand: calibrationBand(rows.length),
    calibrationReviewStatus: reviewStatus(rows.length, disagreementRatePct),
    blockingFlagCounts: Object.freeze({ ...blockingFlagCounts }),
    evidenceKeys: Object.freeze(rows.map((row) => clean(row?.sourceKey, 180)).filter(Boolean).slice(0, 100)),
    readOnly: true,
    historicalMeasurementOnly: true,
    proposalOnly: true,
    requiresHumanReview: true,
    requiresSeparateApproval: true,
    automaticLearningAllowed: false,
    automaticPatchAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
  });
}

export function buildProposalEvidenceAggregationCalibrationReview(proposalReport = {}, options = {}) {
  const proposals = Array.isArray(proposalReport?.proposals) ? proposalReport.proposals : [];
  const proposalTypes = [...new Set(proposals.map((row) => clean(row?.proposalType, 128)).filter(Boolean))];
  const targetAreas = [...new Set(proposals.map((row) => clean(row?.targetArea, 128)).filter(Boolean))];

  const byProposalType = proposalTypes
    .map((value) => aggregateProposalGroup(proposals, "proposalType", value))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.groupKey.localeCompare(b.groupKey));

  const byTargetArea = targetAreas
    .map((value) => aggregateProposalGroup(proposals, "targetArea", value))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.groupKey.localeCompare(b.groupKey));

  const calibrationReviewQueue = [...byProposalType, ...byTargetArea]
    .filter((group) => group.calibrationReviewStatus !== "CALIBRATION_OBSERVATION_ONLY")
    .sort((a, b) =>
      b.sampleCount - a.sampleCount
      || (b.disagreementRatePct ?? -1) - (a.disagreementRatePct ?? -1)
      || a.groupKey.localeCompare(b.groupKey));

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    sourceVersion: clean(proposalReport?.version, 64) || null,
    sourceProposalCount: Math.max(0, Number(proposalReport?.proposalCount) || proposals.length),
    analyzedProposalCount: proposals.length,
    proposalTypeGroupCount: byProposalType.length,
    targetAreaGroupCount: byTargetArea.length,
    calibrationReviewQueueCount: calibrationReviewQueue.length,
    byProposalType: Object.freeze(byProposalType),
    byTargetArea: Object.freeze(byTargetArea),
    calibrationReviewQueue: Object.freeze(
      calibrationReviewQueue.slice(0, Math.max(1, Math.min(200, Number(options.maxReviewGroups) || 100))),
    ),
    calibrationMethod: Object.freeze({
      highConfidenceFloor: 0.75,
      concernMeaning: "historical proposal evidence occurred despite ranking confidence at or above the review floor",
      minimumEvidenceForReview: 5,
      moderateSampleMinimum: 20,
      strongSampleMinimum: 50,
    }),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    historicalMeasurementOnly: true,
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
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

export function readProposalEvidenceAggregationCalibrationReview(options = {}) {
  const proposalReport = options.proposalReport
    ?? readDecisionQualityProposalReport(options);

  return buildProposalEvidenceAggregationCalibrationReview(proposalReport, options);
}

export default {
  VERSION,
  buildProposalEvidenceAggregationCalibrationReview,
  readProposalEvidenceAggregationCalibrationReview,
};
