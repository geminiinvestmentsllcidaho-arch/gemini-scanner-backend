export const VERSION = "ai_manual_adjustment_weekly_report_v1";

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}
function timestamp(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}
function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}
function normalizeRecommendation(row = {}, source = {}) {
  return Object.freeze({
    recommendationId: clean(row.recommendationId, 128) || null,
    title: clean(row.title, 180) || "Manual review recommendation",
    targetArea: clean(row.targetArea, 128) || "general_review",
    suggestedDirection: clean(row.suggestedDirection, 1200),
    evidenceSummary: clean(row.evidenceSummary, 1600),
    currentValue: finite(row.currentValue),
    proposedValue: finite(row.proposedValue),
    unit: clean(row.unit, 32) || null,
    confidence: finite(row.confidence),
    sampleCount: integer(row.sampleCount, 0),
    riskLevel: clean(row.riskLevel, 32).toLowerCase() || "review",
    sourceRecordId: clean(source.recordId, 128) || null,
    sourceGeneratedAt: clean(source.generatedAt, 64) || null,
    historyPossiblyTruncated: source?.fillLedgerHistoryCompleteness?.historyPossiblyTruncated === true,
    requiresBacktest: true,
    requiresOperatorApproval: true,
    proposalOnly: true,
  });
}

export function buildAiManualAdjustmentWeeklyReport(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date");
  const lookbackDays = Math.max(1, Math.min(31, integer(options.lookbackDays, 7) || 7));
  const periodEndMs = now.getTime();
  const periodStartMs = periodEndMs - (lookbackDays * 86400000);
  const records = Array.isArray(input.records) ? input.records : [];
  const includedRecords = records
    .filter((record) => {
      const ms = timestamp(record?.generatedAt);
      return ms !== null && ms >= periodStartMs && ms <= periodEndMs;
    })
    .sort((a, b) => timestamp(a.generatedAt) - timestamp(b.generatedAt));
  const recommendations = includedRecords.flatMap((record) =>
    (Array.isArray(record?.recommendations) ? record.recommendations : [])
      .map((row) => normalizeRecommendation(row, record))
      .filter((row) => row.suggestedDirection || row.evidenceSummary));
  const targetAreas = [...new Set(recommendations.map((row) => row.targetArea))].sort();
  const truncatedHistoryRecordCount = includedRecords.filter(
    (record) => record?.fillLedgerHistoryCompleteness?.historyPossiblyTruncated === true,
  ).length;

  return Object.freeze({
    version: VERSION,
    generatedAt: now.toISOString(),
    period: "weekly",
    periodStart: new Date(periodStartMs).toISOString(),
    periodEnd: now.toISOString(),
    lookbackDays,
    sourceRecordCount: includedRecords.length,
    recommendationCount: recommendations.length,
    targetAreaCount: targetAreas.length,
    targetAreas: Object.freeze(targetAreas),
    truncatedHistoryRecordCount,
    brokerHistoryCompleteForAllIncludedRecords:
      includedRecords.length > 0 && truncatedHistoryRecordCount === 0
      && includedRecords.every((record) => record?.fillLedgerHistoryCompleteness?.historyComplete === true),
    backtestRequiredCount: recommendations.length,
    operatorApprovalRequiredCount: recommendations.length,
    recommendations: Object.freeze(recommendations),
    lifecycleStatus: recommendations.length ? "AWAITING_MANUAL_REVIEW" : "NO_ACTIONABLE_RECOMMENDATIONS",
    monitoringContinues: true,
    compareBeforeAfterRequired: true,
    proposalOnly: true,
    requiresBacktest: recommendations.length > 0,
    requiresOperatorApproval: recommendations.length > 0,
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

export default { VERSION, buildAiManualAdjustmentWeeklyReport };
