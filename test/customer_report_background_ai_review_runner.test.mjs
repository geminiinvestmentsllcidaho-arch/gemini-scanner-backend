import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildBoundedPostMarketAiEvidence,
  flattenOpportunityFunnelScans,
  runCustomerReportBackgroundAiReview,
} from "../src/scanner/customer_report_background_ai_review_runner.mjs";
import {
  listCustomerReportBackgroundAiReviewRecords,
} from "../src/scanner/customer_report_background_ai_review_store.mjs";

test("flattens scan candidates into report events", () => {
  const events = flattenOpportunityFunnelScans([{
    scanId: "scan-1",
    eventAt: "2026-07-17T15:00:00.000Z",
    scanner: "shared",
    scanType: "premarket",
    marketOpen: true,
    sourceStatus: "ok",
    candidates: [{
 symbol: "ABC", decision: "ENTER" }],
  }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].scanId, "scan-1");
  assert.equal(events[0].resultState, "ENTER");
  assert.equal(events[0].marketOpen, true);
  assert.equal(events[0].scanType, "premarket");
});


test("runner includes premarket evidence with source-specific metadata", async () => {
  let capturedInput = null;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-17T15:05:00.000Z"),
    listScans: () => [{
      scanId: "premarket-auto-1",
      eventAt: "2026-07-17T12:00:00.000Z",
      scanner: "alpaca_premarket_shared_readonly",
      scanType: "premarket",
      sourceStatus: "connected_readonly",
      marketOpen: false,
      candidates: [{
        symbol: "PMKT",
        decision: "WATCH",
        readonlyPotentialScore: 74,
        rankingConfidence: 0.72,
        premarketGapPct: 5.4,
        spreadPct: 0.6,
        dollarVolume: 1200000,
      }],
    }],
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    readPositionStore: () => ({ records: [] }),
    requestAiReview: async ({ input }) => {
      capturedInput = input;
      return {
        status: "completed_readonly",
        provider: "openai",
        responseId: "premarket-review",
        reviewText: "Premarket evidence reviewed.",
      };
    },
    persistRecord: () => ({ appended: true, duplicateSkipped: false, ledgerPath: "memory" }),
  });

  assert.equal(capturedInput.scanner.signalsGenerated, 1);
  assert.equal(result.premarketScanRecordCount, 1);
  assert.equal(result.includedPremarketEvidence, true);
  assert.deepEqual(result.sourceCounts, { premarket: 1 });
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
});

test("runner fails closed when scan evidence is unavailable", async () => {
  const result = await runCustomerReportBackgroundAiReview({
    listScans: () => [],
  });
  assert.equal(result.status, "no_scan_evidence");
  assert.equal(result.persisted, false);
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});

test("runner creates and persists a read-only AI review", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-bg-ai-"));
  const ledgerPath = path.join(dir, "reviews.jsonl");
  const scans = [{
    scanId: "scan-7",
    eventAt: "2026-07-17T15:00:00.000Z",
    scanner: "shared",
    marketOpen: true,
    sourceStatus: "ok",
    candidates: [
      { symbol: "ABC", resultState: "ENTER", readonlyPotentialScore: 80, rankingConfidence: 0.8 },
      { symbol: "XYZ", resultState: "WAIT", readonlyPotentialScore: 60, rankingConfidence: 0.6 },
    ],
  }];

  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-17T15:05:00.000Z"),
    ledgerPath,
    listScans: () => scans,
    fetchPaperAccount: async () => ({
      status: "not_connected_readonly",
      account: null,
      positions: [],
      summary: { totalMarketValue: 0, totalUnrealizedPl: 0 },
    }),
    buildPaperAccount: () => ({
      account: {},
      summary: { totalUnrealizedPl: 0 },
      readOnly: true,
      paperOnly: true,
    }),
    readPositionStore: () => ({ records: [] }),
    requestAiReview: async ({ input }) => {
      assert.equal(input.scanner.signalsGenerated, 2);
      return {
        status: "completed_readonly",
        provider: "openai",
        model: "gpt-5-mini",
        responseId: "resp-1",
        reviewText: "Observe and backtest only.",
        requiresBacktest: true,
        requiresOperatorApproval: true,
      };
    },
  });

  assert.equal(result.status, "completed_readonly");
  assert.equal(result.persisted, true);
  assert.equal(result.scanRecordCount, 1);
  assert.equal(result.scannerEventCount, 2);
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);

  const history = listCustomerReportBackgroundAiReviewRecords({ ledgerPath });
  assert.equal(history.recordCount, 1);
  assert.equal(history.records[0].providerStatus, "completed_readonly");
  assert.equal(history.records[0].reviewText, "Observe and backtest only.");
  assert.equal(history.records[0].localJsonlOnly, true);
});

test("store deduplicates identical completed review records", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-bg-ai-dedupe-"));
  const ledgerPath = path.join(dir, "reviews.jsonl");
  const options = {
    now: new Date("2026-07-17T15:05:00.000Z"),
    ledgerPath,
    listScans: () => [{
      scanId: "scan-same",
      eventAt: "2026-07-17T15:00:00.000Z",
      candidates: [{ symbol: "ABC", resultState: "WAIT" }],
    }],
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    readPositionStore: () => ({ records: [] }),
    requestAiReview: async () => ({
      status: "completed_readonly",
      provider: "openai",
      model: "gpt-5-mini",
      responseId: "same-response",
      reviewText: "Same review.",
    }),
  };

  const first = await runCustomerReportBackgroundAiReview(options);
  const second = await runCustomerReportBackgroundAiReview(options);
  assert.equal(first.persisted, true);
  assert.equal(second.persisted, false);
  assert.equal(second.duplicateSkipped, true);
  assert.equal(listCustomerReportBackgroundAiReviewRecords({ ledgerPath }).recordCount, 1);
});


test("bounds post-market evidence before provider review", () => {
  const evidence = buildBoundedPostMarketAiEvidence({
    generatedAt: "2026-07-17T21:00:00.000Z",
    status: "completed_readonly",
    success: true,
    fingerprint: "f".repeat(200),
    sourceFreshness: { maxFreshSec: 900, stalePositionCount: 1, staleWatchCount: 2 },
    qualityReview: {
      sourceRecordCount: 30,
      proposalReport: { proposalCount: 4 },
      evaluationReport: {
        evaluations: Array.from({ length: 30 }, (_, index) => ({
          symbol: `P${index}`,
          decision: "CONTINUATION_WATCH",
          classification: "MISSED_OPPORTUNITY",
          rankingConfidence: 0.7,
          blockingFlags: Array.from({ length: 20 }, (_v, flagIndex) => `FLAG_${flagIndex}`),
          sourceTimestamp: "2026-07-17T20:59:00.000Z",
          originSourceStale: false,
          originObservable: true,
          secret: "must-not-pass",
        })),
      },
    },
  });

  assert.equal(evidence.evaluations.length, 25);
  assert.equal(evidence.evaluations[0].blockingFlags.length, 12);
  assert.equal("secret" in evidence.evaluations[0], false);
  assert.equal(evidence.fingerprint.length, 128);
  assert.equal(evidence.sourceRecordCount, 30);
  assert.equal(evidence.proposalCount, 4);
  assert.equal(evidence.automaticLearningAllowed, false);
  assert.equal(evidence.orderPlacementAllowed, false);
});

test("runner includes bounded post-market evidence and persists completed provider result", async () => {
  let capturedInput = null;
  let persistedRecord = null;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-17T21:05:00.000Z"),
    listScans: () => [{
      scanId: "scan-postmarket-context",
      eventAt: "2026-07-17T20:45:00.000Z",
      scanType: "intraday",
      candidates: [{ symbol: "AAA", resultState: "WAIT" }],
    }],
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    readPositionStore: () => ({ records: [] }),
    getPostMarketResult: () => ({
      generatedAt: "2026-07-17T21:00:00.000Z",
      status: "completed_readonly",
      success: true,
      fingerprint: "post-fingerprint",
      sourceFreshness: { maxFreshSec: 900, stalePositionCount: 0, staleWatchCount: 0 },
      qualityReview: {
        sourceRecordCount: 1,
        proposalReport: { proposalCount: 2 },
        evaluationReport: {
          evaluations: [{
            symbol: "AAA",
            decision: "ELEVATED_OVERNIGHT_RISK",
            classification: "WAIT_INCONCLUSIVE",
            blockingFlags: ["AFTER_HOURS_WEAKNESS"],
            originSourceStale: false,
            originObservable: true,
          }],
        },
      },
    }),
    requestAiReview: async ({ input }) => {
      capturedInput = input;
      return {
        status: "completed_readonly",
        provider: "openai",
        model: "test-model",
        responseId: "postmarket-response",
        reviewText: "Post-market evidence reviewed without execution.",
      };
    },
    persistRecord: (record) => {
      persistedRecord = record;
      return { appended: true, duplicateSkipped: false, ledgerPath: "memory" };
    },
  });

  assert.equal(capturedInput.postMarketEvidence.status, "completed_readonly");
  assert.equal(capturedInput.postMarketEvidence.evaluations[0].symbol, "AAA");
  assert.equal(result.includedPostMarketEvidence, true);
  assert.equal(result.postMarketSourceRecordCount, 1);
  assert.equal(result.postMarketProposalCount, 2);
  assert.equal(persistedRecord.includedPostMarketEvidence, true);
  assert.equal(persistedRecord.postMarketFingerprint, "post-fingerprint");
});

test("runner does not persist failed provider calls so evidence remains retryable", async () => {
  let persistCalls = 0;
  const result = await runCustomerReportBackgroundAiReview({
    listScans: () => [{
      scanId: "retryable-scan",
      eventAt: "2026-07-17T20:45:00.000Z",
      candidates: [{ symbol: "AAA", resultState: "WAIT" }],
    }],
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    readPositionStore: () => ({ records: [] }),
    requestAiReview: async () => ({
      status: "timeout",
      provider: "openai",
      reviewText: null,
    }),
    persistRecord: () => {
      persistCalls += 1;
      return { appended: true };
    },
  });

  assert.equal(result.status, "provider_timeout");
  assert.equal(result.persisted, false);
  assert.equal(result.persistenceSkippedForProviderStatus, true);
  assert.equal(persistCalls, 0);
});

test("runner persists a manual-adjustment recommendation while all mutation locks remain closed", async () => {
  let persistedManualRecord = null;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-20T20:05:00.000Z"),
    minimumOpenSessionsBeforeAdjustment: 3,
    listScans: () => [{
      scanId: "open-session-1",
      eventAt: "2026-07-20T19:55:00.000Z",
      scanType: "intraday",
      marketOpen: true,
      candidates: [{ symbol: "AAA", resultState: "WAIT" }],
    }],
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    readPositionStore: () => ({ records: [] }),
    requestAiReview: async () => ({
      status: "completed_readonly",
      provider: "openai",
      model: "test-model",
      responseId: "manual-adjustment-response",
      reviewText: "Test a narrower WAIT window after three open sessions.",
      requiresBacktest: true,
      requiresOperatorApproval: true,
    }),
    persistRecord: () => ({ appended: true, duplicateSkipped: false, ledgerPath: "reviews-memory" }),
    persistManualAdjustmentRecommendation: (record) => {
      persistedManualRecord = record;
      return { appended: true, duplicateSkipped: false, ledgerPath: "manual-memory" };
    },
  });

  assert.equal(result.status, "completed_readonly");
  assert.equal(result.manualAdjustmentRecommendationCount, 1);
  assert.equal(result.manualAdjustmentPersisted, true);
  assert.equal(result.monitoringContinues, true);
  assert.equal(result.minimumOpenSessionsBeforeAdjustment, 3);
  assert.equal(persistedManualRecord.requiresBacktest, true);
  assert.equal(persistedManualRecord.requiresOperatorApproval, true);
  assert.equal(persistedManualRecord.automaticLearningAllowed, false);
  assert.equal(persistedManualRecord.scannerLogicMutationAllowed, false);
  assert.equal(persistedManualRecord.thresholdMutationAllowed, false);
  assert.equal(persistedManualRecord.orderPlacementAllowed, false);
  assert.equal(persistedManualRecord.accountMutationAllowed, false);
});
