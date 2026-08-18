import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION = "ai_manual_adjustment_recommendation_store_v1";
export const DEFAULT_AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH =
  path.resolve("runs/ai_manual_adjustment_recommendations.jsonl");

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integer(value, fallback = 0, min = 0, max = 1000000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function normalizeRecommendation(row = {}, index = 0) {
  const targetArea = clean(row.targetArea ?? row.groupKey ?? row.category, 128) || "general_review";
  const suggestedDirection = clean(
    row.suggestedDirection ?? row.proposal ?? row.recommendation,
    1200,
  );
  const evidenceSummary = clean(
    row.evidenceSummary ?? row.observation ?? row.rationale,
    1600,
  );
  return Object.freeze({
    recommendationId: clean(row.recommendationId, 128)
      || `manual-adjustment-${String(index + 1).padStart(4, "0")}`,
    title: clean(row.title, 180) || `Review ${targetArea.replaceAll("_", " ")}`,
    targetArea,
    suggestedDirection,
    evidenceSummary,
    proposedValue: finite(row.proposedValue),
    currentValue: finite(row.currentValue),
    unit: clean(row.unit, 32) || null,
    confidence: finite(row.confidence),
    sampleCount: integer(row.sampleCount, 0),
    observableSourceCount: integer(row.observableSourceCount, 0),
    staleSourceCount: integer(row.staleSourceCount, 0),
    riskLevel: clean(row.riskLevel, 32).toLowerCase() || "review",
    status: "PROPOSED_FOR_MANUAL_REVIEW",
    proposalOnly: true,
    requiresBacktest: true,
    requiresOperatorApproval: true,
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

export function buildAiManualAdjustmentRecommendationRecord(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const generatedAt = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const sourceReview = input.sourceReview && typeof input.sourceReview === "object"
    ? input.sourceReview
    : {};
  const sourceCalibration = input.sourceCalibration && typeof input.sourceCalibration === "object"
    ? input.sourceCalibration
    : {};
  const rawRecommendations = Array.isArray(input.recommendations) ? input.recommendations : [];
  const maxRecommendations = Math.max(1, Math.min(50, integer(options.maxRecommendations, 20, 1, 50)));
  const recommendations = rawRecommendations
    .slice(0, maxRecommendations)
    .map(normalizeRecommendation)
    .filter((row) => row.suggestedDirection || row.evidenceSummary);

  const fingerprintSource = JSON.stringify({
    sourceReviewId: sourceReview.reviewId ?? null,
    sourceReviewGeneratedAt: sourceReview.generatedAt ?? null,
    sourceResponseId: sourceReview.responseId ?? null,
    sourceCalibrationGeneratedAt: sourceCalibration.generatedAt ?? null,
    sourceCalibrationQueueCount: integer(sourceCalibration.calibrationReviewQueueCount, 0),
    recommendations,
  });

  return Object.freeze({
    version: VERSION,
    recordId: crypto.createHash("sha256").update(fingerprintSource).digest("hex").slice(0, 24),
    generatedAt,
    sourceReviewId: clean(sourceReview.reviewId, 128) || null,
    sourceReviewGeneratedAt: clean(sourceReview.generatedAt, 64) || null,
    sourceResponseId: clean(sourceReview.responseId, 128) || null,
    sourceProviderStatus: clean(sourceReview.providerStatus, 64) || null,
    sourceCalibrationGeneratedAt: clean(sourceCalibration.generatedAt, 64) || null,
    sourceCalibrationQueueCount: integer(sourceCalibration.calibrationReviewQueueCount, 0),
    recommendationCount: recommendations.length,
    recommendations: Object.freeze(recommendations),
    lifecycleStatus: recommendations.length
      ? "AWAITING_MANUAL_REVIEW"
      : "NO_ACTIONABLE_RECOMMENDATIONS",
    monitoringContinues: true,
    compareBeforeAfterRequired: true,
    minimumOpenSessionsBeforeAdjustment: integer(
      options.minimumOpenSessionsBeforeAdjustment,
      3,
      1,
      20,
    ),
    proposalOnly: true,
    requiresBacktest: true,
    requiresOperatorApproval: true,
    implementationIncluded: false,
    patchIncluded: false,
    readOnly: true,
    paperOnly: true,
    localJsonlOnly: true,
    automaticLearningAllowed: false,
    automaticPatchAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export function appendAiManualAdjustmentRecommendationRecord(record, options = {}) {
  const ledgerPath = path.resolve(
    options.ledgerPath ?? DEFAULT_AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH,
  );
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });

  const existingRecords = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map(safeJson)
      .filter(Boolean)
    : [];
  const duplicateSkipped = existingRecords.some(
    (existing) => existing?.recordId === record?.recordId,
  );

  if (!duplicateSkipped) {
    fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    try { fs.chmodSync(ledgerPath, 0o600); } catch {}
  }

  return Object.freeze({
    appended: !duplicateSkipped,
    duplicateSkipped,
    ledgerPath,
    recordId: record?.recordId ?? null,
    localJsonlOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
  });
}

export function listAiManualAdjustmentRecommendationRecords(options = {}) {
  const ledgerPath = path.resolve(
    options.ledgerPath ?? DEFAULT_AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH,
  );
  const maxRecords = Math.max(1, Math.min(500, integer(options.maxRecords, 50, 1, 500)));
  const records = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map(safeJson)
      .filter(Boolean)
      .slice(-maxRecords)
      .reverse()
      .map((record) => Object.freeze(record))
    : [];

  return Object.freeze({
    version: VERSION,
    ledgerPath,
    recordCount: records.length,
    records: Object.freeze(records),
    readOnly: true,
    paperOnly: true,
    localJsonlOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
  });
}

export default {
  VERSION,
  DEFAULT_AI_MANUAL_ADJUSTMENT_RECOMMENDATION_PATH,
  buildAiManualAdjustmentRecommendationRecord,
  appendAiManualAdjustmentRecommendationRecord,
  listAiManualAdjustmentRecommendationRecords,
};
