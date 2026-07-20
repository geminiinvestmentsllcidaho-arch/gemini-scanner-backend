import { buildCustomerReportModel } from "./customer_report_model.mjs";
import { fetchAlpacaPaperAccountReadonly } from "./alpaca_paper_account_readonly_fetch.mjs";
import { buildCustomerZeroPaperAccountBridge } from "./customer_zero_paper_account_bridge.mjs";
import { readPaperTradePositionStateStoreDashboard } from "./paper_trade_position_state_store.mjs";
import { listOpportunityFunnelAuditRecords } from "./opportunity_funnel_audit_store.mjs";
import { listStrategyObservationRecords } from "./strategy_observation_store.mjs";
import { buildBoundedStrategyObservationAiEvidence } from "./strategy_observation_ai_evidence.mjs";
import { requestCustomerReportRealtimeAiReview } from "./customer_report_realtime_ai_client.mjs";
import {
  appendCustomerReportBackgroundAiReviewRecord,
  buildCustomerReportBackgroundAiReviewRecord,
} from "./customer_report_background_ai_review_store.mjs";
import {
  appendAiManualAdjustmentRecommendationRecord,
  buildAiManualAdjustmentRecommendationRecord,
} from "./ai_manual_adjustment_recommendation_store.mjs";

export const VERSION = "customer_report_background_ai_review_runner_v1";

export function buildBoundedPostMarketAiEvidence(result = {}) {
  const qualityReview = result?.qualityReview && typeof result.qualityReview === "object"
    ? result.qualityReview
    : {};
  const rows = Array.isArray(qualityReview?.evaluationReport?.evaluations)
    ? qualityReview.evaluationReport.evaluations
    : [];
  return Object.freeze({
    generatedAt: result?.generatedAt ?? null,
    status: result?.status ?? "unavailable",
    success: result?.success === true,
    duplicateSnapshot: result?.duplicateSnapshot === true,
    fingerprint: typeof result?.fingerprint === "string"
      ? result.fingerprint.slice(0, 128)
      : null,
    sourceFreshness: Object.freeze({
      maxFreshSec: Number.isFinite(Number(result?.sourceFreshness?.maxFreshSec))
        ? Number(result.sourceFreshness.maxFreshSec)
        : null,
      stalePositionCount: Number(result?.sourceFreshness?.stalePositionCount ?? 0),
      staleWatchCount: Number(result?.sourceFreshness?.staleWatchCount ?? 0),
    }),
    sourceRecordCount: Number(qualityReview?.sourceRecordCount ?? 0),
    proposalCount: Number(qualityReview?.proposalReport?.proposalCount ?? 0),
    evaluations: Object.freeze(rows.slice(0, 25).map((row) => Object.freeze({
      symbol: String(row?.symbol ?? "").trim().toUpperCase().slice(0, 24) || null,
      decision: String(row?.decision ?? "").trim().slice(0, 64) || null,
      classification: String(row?.classification ?? "").trim().slice(0, 64) || null,
      rankingConfidence: Number.isFinite(Number(row?.rankingConfidence))
        ? Number(row.rankingConfidence)
        : null,
      blockingFlags: Object.freeze(
        (Array.isArray(row?.blockingFlags) ? row.blockingFlags : [])
          .slice(0, 12)
          .map((flag) => String(flag).slice(0, 64)),
      ),
      sourceTimestamp: row?.sourceTimestamp ?? null,
      originSourceStale: row?.originSourceStale === true,
      originObservable: row?.originObservable === true,
    }))),
    readOnly: true,
    paperOnly: true,
    historicalMeasurementOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export function flattenOpportunityFunnelScans(scans = []) {
  return (Array.isArray(scans) ? scans : []).flatMap(scan => {
    const eventAt = scan?.eventAt ?? null;
    return (Array.isArray(scan?.candidates) ? scan.candidates : []).map((candidate) => Object.freeze({
      ...candidate,
      createdAt: eventAt,
      sourceTs: eventAt,
      scanId: scan?.scanId ?? null,
      scanner: scan?.scanner ?? null,
      scanType: scan?.scanType ?? null,
      marketOpen: scan?.marketOpen === true,
      sourceStatus: scan?.sourceStatus ?? null,
      resultState: candidate?.resultState ?? candidate?.decision ?? null,
    }));
  });
}

export async function runCustomerReportBackgroundAiReview(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const fetchPaperAccount = options.fetchPaperAccount ?? fetchAlpacaPaperAccountReadonly;
  const buildPaperAccount = options.buildPaperAccount ?? buildCustomerZeroPaperAccountBridge;
  const readPositionStore = options.readPositionStore ?? readPaperTradePositionStateStoreDashboard;
  const listScans = options.listScans ?? listOpportunityFunnelAuditRecords;
  const requestAiReview = options.requestAiReview ?? requestCustomerReportRealtimeAiReview;
  const persistRecord = options.persistRecord ?? appendCustomerReportBackgroundAiReviewRecord;
  const persistManualAdjustmentRecommendation =
    options.persistManualAdjustmentRecommendation
    ?? appendAiManualAdjustmentRecommendationRecord;
  const getPostMarketResult = options.getPostMarketResult ?? (() => null);
  const listStrategyObservations = options.listStrategyObservations ?? listStrategyObservationRecords;

  const scans = listScans({ maxRecords: options.maxScanRecords ?? 120 });
  if (!Array.isArray(scans) || scans.length === 0) {
    return Object.freeze({
      version: VERSION,
      status: "no_scan_evidence",
      persisted: false,
      readOnly: true,
      paperOnly: true,
      automaticLearningAllowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    });
  }

  const fetchedPaperAccount = await fetchPaperAccount();
  const paperAccount = buildPaperAccount(fetchedPaperAccount);
  const positionStore = readPositionStore();
  const paperLedgerHistory = Array.isArray(positionStore?.records) ? positionStore.records : [];
  const scannerEvents = flattenOpportunityFunnelScans(scans);
  const report = buildCustomerReportModel({
    period: "lifetime",
    now,
    weekStartsOn: 1,
    paperAccount,
    paperLedgerHistory,
    scannerEvents,
  });

  const postMarketEvidence = buildBoundedPostMarketAiEvidence(getPostMarketResult() ?? {});
  const strategyObservationEvidence = buildBoundedStrategyObservationAiEvidence(
    listStrategyObservations({
      maxRecords: Number(options.maxStrategyObservationRecords ?? 1000),
      observationPath: options.strategyObservationPath,
    }),
  );
  const review = await requestAiReview({
    input: Object.freeze({
      ...(report.aiReview?.input ?? {}),
      postMarketEvidence,
      strategyObservationEvidence,
    }),
    timeoutMs: Number(options.timeoutMs ?? process.env.GS_REALTIME_AI_TIMEOUT_MS ?? 30000),
  });

  const latestScan = scans[0] ?? {};
  const sourceCounts = scans.reduce((counts, scan) => {
    const key = String(scan?.scanType ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const premarketScanRecordCount = Number(sourceCounts.premarket ?? 0);
  const record = buildCustomerReportBackgroundAiReviewRecord({
    report,
    review,
    source: {
      latestScanId: latestScan?.scanId ?? null,
      latestScanAt: latestScan?.eventAt ?? null,
      scanRecordCount: scans.length,
      sourceCounts,
      premarketScanRecordCount,
      postMarketGeneratedAt: postMarketEvidence.generatedAt,
      postMarketStatus: postMarketEvidence.status,
      postMarketFingerprint: postMarketEvidence.fingerprint,
      postMarketSourceRecordCount: postMarketEvidence.sourceRecordCount,
      postMarketProposalCount: postMarketEvidence.proposalCount,
      strategyObservationSourceRecordCount: strategyObservationEvidence.sourceRecordCount,
      strategyObservationUniqueCount: strategyObservationEvidence.uniqueObservationCount,
      strategyObservationObservableCount: strategyObservationEvidence.observableCount,
      strategyObservationStaleSourceCount: strategyObservationEvidence.staleSourceCount,
    },
  }, { now });
  const write = review?.status === "completed_readonly"
    ? persistRecord(record, { ledgerPath: options.ledgerPath })
    : Object.freeze({
      appended: false,
      duplicateSkipped: false,
      ledgerPath: options.ledgerPath ?? null,
      skippedUnsafeProviderStatus: true,
    });

  const manualAdjustmentRecord = buildAiManualAdjustmentRecommendationRecord({
    sourceReview: {
      reviewId: record.reviewId,
      generatedAt: record.generatedAt,
      responseId: review?.responseId ?? null,
      providerStatus: review?.status ?? null,
    },
    sourceCalibration: {
      generatedAt: postMarketEvidence.generatedAt,
      calibrationReviewQueueCount: postMarketEvidence.proposalCount,
    },
    recommendations:
      review?.status === "completed_readonly"
      && typeof review?.reviewText === "string"
      && review.reviewText.trim()
        ? [{
            title: "AI review for manual scanner-logic adjustment",
            targetArea: "manual_scanner_calibration",
            suggestedDirection: review.reviewText,
            evidenceSummary:
              `Source scans: ${scans.length}; scanner events: ${scannerEvents.length}; post-market proposals: ${postMarketEvidence.proposalCount}.`,
            sampleCount: scans.length,
            observableSourceCount: scans.filter((scan) => scan?.marketOpen === true).length,
            staleSourceCount:
              postMarketEvidence.sourceFreshness.stalePositionCount
              + postMarketEvidence.sourceFreshness.staleWatchCount,
            riskLevel: "review",
          }]
        : [],
  }, {
    now,
    minimumOpenSessionsBeforeAdjustment:
      Number(options.minimumOpenSessionsBeforeAdjustment ?? 3),
  });

  const manualAdjustmentWrite = review?.status === "completed_readonly"
    ? persistManualAdjustmentRecommendation(manualAdjustmentRecord, {
        ledgerPath: options.manualAdjustmentLedgerPath,
      })
    : Object.freeze({
        appended: false,
        duplicateSkipped: false,
        ledgerPath: options.manualAdjustmentLedgerPath ?? null,
      });

  return Object.freeze({
    version: VERSION,
    status: review?.status === "completed_readonly"
      ? "completed_readonly"
      : `provider_${review?.status ?? "unknown"}`,
    reviewId: record.reviewId,
    providerStatus: review?.status ?? null,
    responseId: review?.responseId ?? null,
    persisted: write?.appended === true,
    duplicateSkipped: write?.duplicateSkipped === true,
    ledgerPath: write?.ledgerPath ?? null,
    scanRecordCount: scans.length,
    scannerEventCount: scannerEvents.length,
    sourceCounts: Object.freeze({ ...sourceCounts }),
    premarketScanRecordCount,
    includedPremarketEvidence: premarketScanRecordCount > 0,
    includedPostMarketEvidence: postMarketEvidence.status === "completed_readonly"
      && postMarketEvidence.sourceRecordCount > 0,
    postMarketStatus: postMarketEvidence.status,
    postMarketSourceRecordCount: postMarketEvidence.sourceRecordCount,
    postMarketProposalCount: postMarketEvidence.proposalCount,
    includedStrategyObservationEvidence: strategyObservationEvidence.uniqueObservationCount > 0,
    strategyObservationSourceRecordCount: strategyObservationEvidence.sourceRecordCount,
    strategyObservationUniqueCount: strategyObservationEvidence.uniqueObservationCount,
    strategyObservationObservableCount: strategyObservationEvidence.observableCount,
    strategyObservationStaleSourceCount: strategyObservationEvidence.staleSourceCount,
    strategyObservationMeasuredReturnCount: strategyObservationEvidence.measuredReturnCount,
    persistenceSkippedForProviderStatus: write?.skippedUnsafeProviderStatus === true,
    manualAdjustmentRecordId: manualAdjustmentRecord.recordId,
    manualAdjustmentRecommendationCount: manualAdjustmentRecord.recommendationCount,
    minimumOpenSessionsBeforeAdjustment: manualAdjustmentRecord.minimumOpenSessionsBeforeAdjustment,
    manualAdjustmentPersisted: manualAdjustmentWrite?.appended === true,
    manualAdjustmentDuplicateSkipped: manualAdjustmentWrite?.duplicateSkipped === true,
    manualAdjustmentLedgerPath: manualAdjustmentWrite?.ledgerPath ?? null,
    monitoringContinues: true,
    readOnly: true,
    paperOnly: true,
    requiresBacktest: true,
    requiresOperatorApproval: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export default {
  VERSION,
  buildBoundedPostMarketAiEvidence,
  buildBoundedStrategyObservationAiEvidence,
  flattenOpportunityFunnelScans,
  runCustomerReportBackgroundAiReview,
};
