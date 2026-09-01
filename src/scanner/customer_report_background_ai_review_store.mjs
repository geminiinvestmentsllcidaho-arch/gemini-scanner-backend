import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const VERSION = "customer_report_background_ai_review_store_v1";
export const DEFAULT_BACKGROUND_AI_REVIEW_PATH =
  path.resolve("runs/customer_report_background_ai_reviews.jsonl");

function safeText(value, max = 12000) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > max ? text.slice(0, max) : text;
}

function safeJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function buildCustomerReportBackgroundAiReviewRecord(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const generatedAt = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const review = input.review && typeof input.review === "object" ? input.review : {};
  const report = input.report && typeof input.report === "object" ? input.report : {};
  const scanner = report.scanner && typeof report.scanner === "object" ? report.scanner : {};
  const source = input.source && typeof input.source === "object" ? input.source : {};
  const fingerprintSource = JSON.stringify({
    latestScanId: source.latestScanId ?? null,
    latestScanAt: source.latestScanAt ?? null,
    scanRecordCount: Number(source.scanRecordCount ?? 0),
    sourceCounts: source.sourceCounts ?? {},
    premarketScanRecordCount: Number(source.premarketScanRecordCount ?? 0),
    postMarketGeneratedAt: source.postMarketGeneratedAt ?? null,
    postMarketStatus: source.postMarketStatus ?? null,
    postMarketFingerprint: source.postMarketFingerprint ?? null,
    postMarketSourceRecordCount: Number(source.postMarketSourceRecordCount ?? 0),
    postMarketProposalCount: Number(source.postMarketProposalCount ?? 0),
    strategyObservationSourceRecordCount: Number(source.strategyObservationSourceRecordCount ?? 0),
    strategyObservationUniqueCount: Number(source.strategyObservationUniqueCount ?? 0),
    strategyObservationObservableCount: Number(source.strategyObservationObservableCount ?? 0),
    strategyObservationStaleSourceCount: Number(source.strategyObservationStaleSourceCount ?? 0),
    paperExecutionLifecycleRecordCount: Number(source.paperExecutionLifecycleRecordCount ?? 0),
    paperExecutionScaleActionRecordCount: Number(source.paperExecutionScaleActionRecordCount ?? 0),
    performanceEpochActive: source.performanceEpochActive === true,
    performanceEpochStartedAt: source.performanceEpochStartedAt ?? null,
    fillLedgerHistoryCompleteness: source.fillLedgerHistoryCompleteness ?? null,
    scannerEvents: Number(scanner.signalsGenerated ?? 0),
    enter: Number(scanner.enter ?? 0),
    wait: Number(scanner.wait ?? 0),
    averagePotentialScore: scanner.averagePotentialScore ?? null,
    providerStatus: review.status ?? null,
    responseId: review.responseId ?? null,
  });

  return Object.freeze({
    version: VERSION,
    reviewId: crypto.createHash("sha256").update(fingerprintSource).digest("hex").slice(0, 24),
    generatedAt,
    period: report.period ?? "lifetime",
    reportStatus: report.status ?? null,
    performanceEpochActive: source.performanceEpochActive === true,
    performanceEpochStartedAt: safeText(source.performanceEpochStartedAt, 64) || null,
    fillLedgerHistoryCompleteness:
      source.fillLedgerHistoryCompleteness && typeof source.fillLedgerHistoryCompleteness === "object"
        ? Object.freeze({ ...source.fillLedgerHistoryCompleteness })
        : null,
    latestScanId: source.latestScanId ?? null,
    latestScanAt: source.latestScanAt ?? null,
    scanRecordCount: Number(source.scanRecordCount ?? 0),
    sourceCounts: Object.freeze({ ...(source.sourceCounts ?? {}) }),
    premarketScanRecordCount: Number(source.premarketScanRecordCount ?? 0),
    includedPremarketEvidence: Number(source.premarketScanRecordCount ?? 0) > 0,
    postMarketGeneratedAt: source.postMarketGeneratedAt ?? null,
    postMarketStatus: source.postMarketStatus ?? null,
    postMarketFingerprint: source.postMarketFingerprint ?? null,
    postMarketSourceRecordCount: Number(source.postMarketSourceRecordCount ?? 0),
    postMarketProposalCount: Number(source.postMarketProposalCount ?? 0),
    strategyObservationSourceRecordCount: Number(source.strategyObservationSourceRecordCount ?? 0),
    strategyObservationUniqueCount: Number(source.strategyObservationUniqueCount ?? 0),
    strategyObservationObservableCount: Number(source.strategyObservationObservableCount ?? 0),
    strategyObservationStaleSourceCount: Number(source.strategyObservationStaleSourceCount ?? 0),
    paperExecutionLifecycleRecordCount: Number(source.paperExecutionLifecycleRecordCount ?? 0),
    paperExecutionScaleActionRecordCount: Number(source.paperExecutionScaleActionRecordCount ?? 0),
    includedPaperExecutionLifecycleEvidence:
      Number(source.paperExecutionLifecycleRecordCount ?? 0) > 0
      || Number(source.paperExecutionScaleActionRecordCount ?? 0) > 0,
    includedStrategyObservationEvidence:
      Number(source.strategyObservationUniqueCount ?? 0) > 0,
    includedPostMarketEvidence: source.postMarketStatus === "completed_readonly"
      && Number(source.postMarketSourceRecordCount ?? 0) > 0,
    scannerEventCount: Number(scanner.signalsGenerated ?? 0),
    enterCount: Number(scanner.enter ?? 0),
    waitCount: Number(scanner.wait ?? 0),
    averageConfidence: scanner.averageConfidence ?? null,
    averagePotentialScore: scanner.averagePotentialScore ?? null,
    provider: review.provider ?? "openai",
    model: review.model ?? null,
    providerStatus: review.status ?? "unknown",
    responseId: review.responseId ?? null,
    reviewText: safeText(review.reviewText),
    requiresBacktest: true,
    requiresOperatorApproval: true,
    readOnly: true,
    paperOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    localJsonlOnly: true,
  });
}

export function appendCustomerReportBackgroundAiReviewRecord(record, options = {}) {
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_BACKGROUND_AI_REVIEW_PATH);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });

  let duplicateSkipped = false;
  if (fs.existsSync(ledgerPath)) {
    const latest = fs.readFileSync(ledgerPath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map(safeJsonLine)
      .filter(Boolean)
      .at(-1);
    duplicateSkipped = latest?.reviewId === record?.reviewId;
  }

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
    reviewId: record?.reviewId ?? null,
    localJsonlOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
  });
}

export function listCustomerReportBackgroundAiReviewRecords(options = {}) {
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_BACKGROUND_AI_REVIEW_PATH);
  const maxRecords = Math.max(1, Math.min(1000, Number.parseInt(String(options.maxRecords ?? 100), 10) || 100));
  const records = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map(safeJsonLine)
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
    localJsonlOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
  });
}

export default {
  VERSION,
  DEFAULT_BACKGROUND_AI_REVIEW_PATH,
  buildCustomerReportBackgroundAiReviewRecord,
  appendCustomerReportBackgroundAiReviewRecord,
  listCustomerReportBackgroundAiReviewRecords,
};
