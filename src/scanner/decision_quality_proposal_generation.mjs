import {
  readDecisionQualityClassificationReport,
} from "./decision_quality_classification.mjs";

export const VERSION = "decision_quality_proposal_generation_v1";

const PROPOSAL_MAP = Object.freeze({
  FALSE_POSITIVE: Object.freeze({
    proposalType: "REDUCE_FALSE_POSITIVES",
    title: "Review entry confirmation requirements",
    targetArea: "entry_confirmation",
    suggestedDirection: "Require stronger confirmation evidence before ENTER decisions.",
    riskLevel: "high",
    reviewPriority: 4,
  }),
  MISSED_OPPORTUNITY: Object.freeze({
    proposalType: "REDUCE_MISSED_OPPORTUNITIES",
    title: "Review rejection sensitivity",
    targetArea: "rejection_sensitivity",
    suggestedDirection: "Inspect whether valid setups are being rejected too aggressively.",
    riskLevel: "high",
    reviewPriority: 4,
  }),
  LATE_DECISION: Object.freeze({
    proposalType: "IMPROVE_DECISION_TIMING",
    title: "Review WAIT timing",
    targetArea: "wait_timing",
    suggestedDirection: "Inspect whether WAIT decisions persist after favorable confirmation appears.",
    riskLevel: "medium",
    reviewPriority: 3,
  }),
  LATE_ENTRY: Object.freeze({
    proposalType: "IMPROVE_ENTRY_TIMING",
    title: "Review delayed entry confirmation",
    targetArea: "entry_timing",
    suggestedDirection: "Inspect whether entry confirmation arrives after most favorable movement is complete.",
    riskLevel: "medium",
    reviewPriority: 3,
  }),
  NEAR_MISS: Object.freeze({
    proposalType: "REVIEW_INCONCLUSIVE_BOUNDARIES",
    title: "Review inconclusive decision boundaries",
    targetArea: "decision_boundaries",
    suggestedDirection: "Measure which evidence separates inconclusive decisions from stronger outcomes.",
    riskLevel: "low",
    reviewPriority: 2,
  }),
  UNCLASSIFIED: Object.freeze({
    proposalType: "IMPROVE_CLASSIFICATION_COVERAGE",
    title: "Review unclassified decision records",
    targetArea: "classification_coverage",
    suggestedDirection: "Add historical measurement coverage for currently unclassified decisions.",
    riskLevel: "low",
    reviewPriority: 1,
  }),
});

function clean(value, maxLength = 256) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function proposalFor(qualityClass) {
  return PROPOSAL_MAP[qualityClass] ?? null;
}

function evidenceFor(item) {
  return Object.freeze({
    symbol: clean(item?.symbol, 20).toUpperCase(),
    decision: clean(item?.decision, 32).toUpperCase(),
    outcomeClassification: clean(item?.outcomeClassification, 64).toUpperCase(),
    qualityClass: clean(item?.qualityClass, 64).toUpperCase(),
    latestReturnPct: finite(item?.latestReturnPct),
    maxFavorablePct: finite(item?.maxFavorablePct),
    maxAdversePct: finite(item?.maxAdversePct),
    readonlyPotentialScore: finite(item?.readonlyPotentialScore),
    rankingConfidence: finite(item?.rankingConfidence),
    blockingFlags: Object.freeze(
      (Array.isArray(item?.blockingFlags) ? item.blockingFlags : [])
        .slice(0, 10)
        .map((flag) => clean(flag, 128))
        .filter(Boolean),
    ),
  });
}

export function buildDecisionQualityProposalReport(classificationReport = {}, options = {}) {
  const sourceQueue = Array.isArray(classificationReport?.reviewQueue)
    ? classificationReport.reviewQueue
    : [];

  const proposals = sourceQueue
    .map((item, index) => {
      const qualityClass = clean(item?.qualityClass, 64).toUpperCase();
      const template = proposalFor(qualityClass);
      if (!template) return null;

      return Object.freeze({
        proposalId: `quality-proposal-${String(index + 1).padStart(4, "0")}`,
        proposalType: template.proposalType,
        title: template.title,
        targetArea: template.targetArea,
        suggestedDirection: template.suggestedDirection,
        riskLevel: template.riskLevel,
        reviewPriority: template.reviewPriority,
        sourceKey: clean(item?.key, 180),
        sourceScanId: clean(item?.originScanId, 128),
        sourceEventAt: clean(item?.originEventAt, 64) || null,
        evidence: evidenceFor(item),
        proposalOnly: true,
        requiresHumanReview: true,
        requiresSeparateApproval: true,
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
    })
    .filter(Boolean);

  const proposalTypeCounts = {};
  const targetAreaCounts = {};
  for (const proposal of proposals) {
    proposalTypeCounts[proposal.proposalType] = (proposalTypeCounts[proposal.proposalType] ?? 0) + 1;
    targetAreaCounts[proposal.targetArea] = (targetAreaCounts[proposal.targetArea] ?? 0) + 1;
  }

  const limit = Math.max(1, Math.min(500, Number(options.maxProposals) || 100));
  const bounded = proposals.slice(0, limit);

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    sourceVersion: clean(classificationReport?.version, 64) || null,
    sourceReviewRequiredCount: Math.max(0, Number(classificationReport?.reviewRequiredCount) || 0),
    sourceQueueCount: sourceQueue.length,
    proposalCount: proposals.length,
    returnedProposalCount: bounded.length,
    proposalTypeCounts: Object.freeze({ ...proposalTypeCounts }),
    targetAreaCounts: Object.freeze({ ...targetAreaCounts }),
    proposals: Object.freeze(bounded),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    historicalMeasurementOnly: true,
    proposalGenerationAllowed: true,
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

export function readDecisionQualityProposalReport(options = {}) {
  const classificationReport = options.classificationReport
    ?? readDecisionQualityClassificationReport(options);

  return buildDecisionQualityProposalReport(classificationReport, options);
}

export default {
  VERSION,
  buildDecisionQualityProposalReport,
  readDecisionQualityProposalReport,
};
