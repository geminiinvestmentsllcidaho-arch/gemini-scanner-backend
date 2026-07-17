import { buildCustomerReportModel } from "./customer_report_model.mjs";
import { fetchAlpacaPaperAccountReadonly } from "./alpaca_paper_account_readonly_fetch.mjs";
import { buildCustomerZeroPaperAccountBridge } from "./customer_zero_paper_account_bridge.mjs";
import { readPaperTradePositionStateStoreDashboard } from "./paper_trade_position_state_store.mjs";
import { listOpportunityFunnelAuditRecords } from "./opportunity_funnel_audit_store.mjs";
import { requestCustomerReportRealtimeAiReview } from "./customer_report_realtime_ai_client.mjs";
import {
  appendCustomerReportBackgroundAiReviewRecord,
  buildCustomerReportBackgroundAiReviewRecord,
} from "./customer_report_background_ai_review_store.mjs";

export const VERSION = "customer_report_background_ai_review_runner_v1";

export function flattenOpportunityFunnelScans(scans = []) {
  return (Array.isArray(scans) ? scans : []).flatMap(scan => {
    const eventAt = scan?.eventAt ?? null;
    return (Array.isArray(scan?.candidates) ? scan.candidates : []).map((candidate) => Object.freeze({
      ...candidate,
      createdAt: eventAt,
      sourceTs: eventAt,
      scanId: scan?.scanId ?? null,
      scanner: scan?.scanner ?? null,
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

  const review = await requestAiReview({
    input: report.aiReview?.input ?? {},
    timeoutMs: Number(options.timeoutMs ?? process.env.GS_REALTIME_AI_TIMEOUT_MS ?? 30000),
  });

  const latestScan = scans.at(-1) ?? {};
  const record = buildCustomerReportBackgroundAiReviewRecord({
    report,
    review,
    source: {
      latestScanId: latestScan?.scanId ?? null,
      latestScanAt: latestScan?.eventAt ?? null,
      scanRecordCount: scans.length,
    },
  }, { now });
  const write = persistRecord(record, { ledgerPath: options.ledgerPath });

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
  flattenOpportunityFunnelScans,
  runCustomerReportBackgroundAiReview,
};
