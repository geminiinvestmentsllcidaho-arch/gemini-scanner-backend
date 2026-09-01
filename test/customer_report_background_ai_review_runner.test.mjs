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


test("runner rejects before provider or persistence work when strict scan reading fails", async () => {
  let providerCalled = false;
  let persisted = false;

  await assert.rejects(
    () => runCustomerReportBackgroundAiReview({
      listScans: () => {
        throw new SyntaxError("malformed opportunity audit record");
      },
      requestAiReview: async () => {
        providerCalled = true;
        return { status: "completed_readonly" };
      },
      persistRecord: () => {
        persisted = true;
        return { appended: true };
      },
    }),
    SyntaxError,
  );

  assert.equal(providerCalled, false);
  assert.equal(persisted, false);
});

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


test("runner preserves dedicated premarket evidence when recent scans are under-five only", async () => {
  let capturedInput = null;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-21T20:00:00.000Z"),
    listScans: () => [{
      scanId: "under-five-latest",
      eventAt: "2026-07-21T19:59:00.000Z",
      scanner: "alpaca_under_five_shared",
      scanType: "under_five",
      marketOpen: true,
      candidates: [{ symbol: "DAY", decision: "ENTER", readonlyPotentialScore: 82 }],
    }],
    listPremarketScans: () => [{
      scanId: "premarket-preserved",
      eventAt: "2026-07-21T12:30:00.000Z",
      scanner: "alpaca_premarket_shared_readonly",
      scanType: "premarket",
      marketOpen: false,
      candidates: [{ symbol: "PRE", decision: "WATCH", readonlyPotentialScore: 74 }],
    }],
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    listStrategyObservations: () => [],
    requestAiReview: async ({ input, timeoutMs }) => {
      capturedInput = input;
      assert.equal(timeoutMs, 90000);
      return {
        status: "completed_readonly",
        provider: "openai",
        responseId: "balanced-review",
        reviewText: "Balanced evidence reviewed.",
      };
    },
    persistRecord: () => ({ appended: true, duplicateSkipped: false, ledgerPath: "memory" }),
  });

  assert.equal(capturedInput.scanner.signalsGenerated, 2);
  assert.equal(result.scanRecordCount, 2);
  assert.equal(result.premarketScanRecordCount, 1);
  assert.equal(result.includedPremarketEvidence, true);
  assert.deepEqual(result.sourceCounts, { under_five: 1, premarket: 1 });
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
    requestAiReview: async ({ input }) => {
      assert.equal(input.scanner.signalsGenerated, 2);
      return {
        status: "completed_readonly",
        provider: "openai",
        model: "gpt-5-mini",
        responseId: "resp-1",
        reviewText: "Observe and backtest only.",
        requiresBacktest: true,
        requiresOperatorApproval: false,
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
    requestAiReview: async () => ({
      status: "completed_readonly",
      provider: "openai",
      model: "test-model",
      responseId: "manual-adjustment-response",
      reviewText: "Test a narrower WAIT window after three open sessions.",
      requiresBacktest: true,
      requiresOperatorApproval: false,
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

test("runner includes bounded strategy observation evidence and persists source metadata", async () => {
  let capturedInput = null;
  let persistedRecord = null;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-20T21:05:00.000Z"),
    listScans: () => [{
      scanId: "scan-strategy-evidence",
      eventAt: "2026-07-20T20:45:00.000Z",
      scanType: "intraday",
      candidates: [{ symbol: "AAA", resultState: "WAIT" }],
    }],
    listStrategyObservations: () => [{
      key: "scan-strategy-evidence:AAA",
      originScanId: "scan-strategy-evidence",
      observedAt: "2026-07-20T21:00:00.000Z",
      symbol: "AAA",
      scanType: "intraday",
      strategyType: "intraday",
      decision: "WAIT",
      latestReturnPct: 4.25,
      originObservable: true,
      originSourceStale: false,
      horizonObservations: { intraday: 2 },
      horizonReturnsPct: { intraday: 4.25 },
    }],
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    requestAiReview: async ({ input }) => {
      capturedInput = input;
      return {
        status: "completed_readonly",
        provider: "openai",
        model: "test-model",
        responseId: "strategy-evidence-response",
        reviewText: "Review historical strategy evidence manually.",
      };
    },
    persistRecord: (record) => {
      persistedRecord = record;
      return { appended: true, duplicateSkipped: false, ledgerPath: "memory" };
    },
  });

  assert.equal(capturedInput.strategyObservationEvidence.uniqueObservationCount, 1);
  assert.equal(capturedInput.strategyObservationEvidence.observations[0].symbol, "AAA");
  assert.equal(capturedInput.strategyObservationEvidence.observations[0].latestReturnPct, 4.25);
  assert.equal(capturedInput.strategyAuthorizationPolicy.version, "paper_auto_execution_strategy_authorization_v1");
  assert.equal(capturedInput.strategyAuthorizationPolicy.requiredState, "ENTER");
  assert.deepEqual(capturedInput.strategyAuthorizationPolicy.minimums, {
    setupScore: 70,
    rankingConfidence: 0.5,
    rankingQuality: 0.65,
  });
  assert.equal(capturedInput.strategyAuthorizationPolicy.executionAuthority, "deterministic_strategy_authorization");
  assert.equal(capturedInput.strategyAuthorizationPolicy.symbolLevelOnly, true);
  assert.equal(capturedInput.strategyAuthorizationPolicy.portfolioRootAuthorizationUsed, false);
  assert.equal(capturedInput.strategyAuthorizationPolicy.aiAuthorizationAllowed, false);
  assert.equal(capturedInput.strategyAuthorizationPolicy.aiOverrideAllowed, false);
  assert.equal(capturedInput.strategyAuthorizationPolicy.rankingSizingAuthoritative, false);
  assert.equal(capturedInput.strategyAuthorizationPolicy.aiSizingOverrideAllowed, false);
  assert.equal(result.includedStrategyObservationEvidence, true);
  assert.equal(result.strategyObservationSourceRecordCount, 1);
  assert.equal(result.strategyObservationUniqueCount, 1);
  assert.equal(result.strategyObservationObservableCount, 1);
  assert.equal(result.strategyObservationStaleSourceCount, 0);
  assert.equal(persistedRecord.includedStrategyObservationEvidence, true);
  assert.equal(persistedRecord.strategyObservationUniqueCount, 1);
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});


test("runner applies the supplied performance epoch to broker-backed AI review evidence", async () => {
  let capturedInput = null;
  let persistedRecord = null;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-09-01T04:10:00.000Z"),
    performanceEpochStartedAt: "2026-08-31T18:20:31.044Z",
    listScans: () => [{
      scanId: "epoch-scan",
      eventAt: "2026-09-01T04:09:00.000Z",
      scanType: "under_five",
      marketOpen: false,
      candidates: [{ symbol: "TEST", resultState: "WAIT" }],
    }],
    listPremarketScans: () => [],
    fetchBrokerPerformanceEvidence: async () => ({
      fetchedPaperAccount: {
        ok: true,
        status: "connected_readonly",
        observedAt: "2026-09-01T04:10:00.000Z",
        account: {
          equity: 1001,
          lastEquity: 1000,
          cash: 900,
          portfolioValue: 1001,
          positions: [],
        },
      },
      fillLedgerHistorySource: "alpaca_paper_order_history",
      fillLedgerHistoryCompleteness: { historyComplete: true },
      brokerObservationTs: "2026-09-01T04:10:00.000Z",
      fillLedgerHistory: [
        {
          symbol: "OLD",
          side: "buy",
          qty: 1,
          price: 100,
          filledAt: "2026-08-30T15:00:00.000Z",
        },
        {
          symbol: "OLD",
          side: "sell",
          qty: 1,
          price: 1,
          filledAt: "2026-08-30T16:00:00.000Z",
        },
      ],
    }),
    buildPaperAccount: (value) => value.account,
    requestAiReview: async ({ input }) => {
      capturedInput = input;
      return {
        status: "completed_readonly",
        reviewText: "Epoch-scoped evidence reviewed.",
        provider: "test",
        model: "test",
      };
    },
    persistRecord: (record) => {
      persistedRecord = record;
      return { appended: true, duplicateSkipped: false, ledgerPath: "memory" };
    },
    persistManualAdjustmentRecommendation: () => ({ appended: true, duplicateSkipped: false, ledgerPath: "manual-memory" }),
    getPostMarketResult: () => null,
    listStrategyObservations: () => [],
  });

  assert.equal(result.status, "completed_readonly");
  assert.ok(capturedInput);
  assert.equal(capturedInput.performance.realizedPl, 0);
  assert.equal(capturedInput.trades.totalTrades, 0);
  assert.ok(persistedRecord);
  assert.equal(persistedRecord.performanceEpochActive, true);
  assert.equal(persistedRecord.performanceEpochStartedAt, "2026-08-31T18:20:31.044Z");
});

test("runner uses broker-confirmed PAPER lifecycle evidence and does not consult legacy position snapshots", async () => {
  let capturedInput = null;
  let persistedRecord = null;
  let persistedManualRecord = null;
  let legacyPositionStoreCalled = false;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-20T15:00:00.000Z"),
    listScans: () => [{
      scanId: "scan-broker-history",
      scanType: "under_five",
      eventAt: "2026-07-20T14:59:00.000Z",
      candidates: [{ symbol: "AAA", decision: "WAIT" }],
    }],
    listPremarketScans: () => [],
    fetchBrokerPerformanceEvidence: async () => ({
      fetchedPaperAccount: {},
      fillLedgerHistory: [{
        source: "alpaca_paper_order_history",
        sourceOrderId: "buy-1",
        symbol: "AAA",
        side: "buy",
        qty: 1,
        fillPrice: 10,
        filledAt: "2026-07-20T14:00:00.000Z",
      }, {
        source: "alpaca_paper_order_history",
        sourceOrderId: "sell-1",
        symbol: "AAA",
        side: "sell",
        qty: 1,
        fillPrice: 12,
        filledAt: "2026-07-20T14:30:00.000Z",
      }],
      fillLedgerHistorySource: "alpaca_paper_order_history",
      fillLedgerHistoryCompleteness: {
        historyLimit: 500,
        sourceRecordCount: 2,
        historyLimitReached: false,
        historyComplete: true,
        historyPossiblyTruncated: false,
      },
      brokerObservationTs: "2026-07-20T15:00:00.000Z",
    }),
    fetchPaperAccount: async () => {
      throw new Error("fallback account fetch must not run");
    },
    buildPaperAccount: () => ({
      account: {},
      summary: { totalUnrealizedPl: 0 },
      readOnly: true,
      paperOnly: true,
    }),
    readPositionStore: () => {
      legacyPositionStoreCalled = true;
      return { records: [{ realizedPl: 999999 }] };
    },
    listStrategyObservations: () => [],
    requestAiReview: async ({ input }) => {
      capturedInput = input;
      return {
        status: "completed_readonly",
        reviewText: "Broker lifecycle reviewed.",
        requiresBacktest: true,
        requiresOperatorApproval: false,
        automaticLogicMutationAllowed: false,
        orderPlacementAllowed: false,
      };
    },
    persistRecord: (record) => {
      persistedRecord = record;
      return { appended: true, duplicateSkipped: false, ledgerPath: "memory" };
    },
    persistManualAdjustmentRecommendation: (record) => {
      persistedManualRecord = record;
      return { appended: false, duplicateSkipped: false, ledgerPath: null };
    },
  });

  assert.equal(result.status, "completed_readonly");
  assert.equal(legacyPositionStoreCalled, false);
  assert.equal(capturedInput.trades.lifecycleSourceAvailable, true);
  assert.equal(capturedInput.trades.completedRoundTrips, 1);
  assert.equal(capturedInput.performance.realizedPl, 2);
  const expectedCompleteness = {
    historyLimit: 500,
    sourceRecordCount: 2,
    historyLimitReached: false,
    historyComplete: true,
    historyPossiblyTruncated: false,
  };
  assert.deepEqual(persistedRecord.fillLedgerHistoryCompleteness, expectedCompleteness);
  assert.deepEqual(persistedManualRecord.fillLedgerHistoryCompleteness, expectedCompleteness);
  assert.equal(persistedManualRecord.requiresBacktest, true);
  assert.equal(persistedManualRecord.requiresOperatorApproval, true);
  assert.equal(persistedManualRecord.scannerLogicMutationAllowed, false);
  assert.equal(persistedManualRecord.thresholdMutationAllowed, false);
  assert.equal(persistedManualRecord.orderPlacementAllowed, false);
  assert.equal(persistedManualRecord.accountMutationAllowed, false);
});

test("runner treats an unavailable fill ledger as unavailable lifecycle evidence", async () => {
  let capturedInput = null;
  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-07-20T15:00:00.000Z"),
    listScans: () => [{
      scanId: "scan-fill-unavailable",
      scanType: "under_five",
      eventAt: "2026-07-20T14:59:00.000Z",
      candidates: [{ symbol: "AAA", decision: "WAIT" }],
    }],
    listPremarketScans: () => [],
    fetchBrokerPerformanceEvidence: async () => ({
      fetchedPaperAccount: {},
      fillLedgerHistory: null,
      fillLedgerHistorySource: "alpaca_paper_order_history",
      fillLedgerHistoryCompleteness: null,
      brokerObservationTs: "2026-07-20T15:00:00.000Z",
    }),
    buildPaperAccount: () => ({}),
    listStrategyObservations: () => [],
    requestAiReview: async ({ input }) => {
      capturedInput = input;
      return {
        status: "completed_readonly",
        reviewText: "No lifecycle source.",
        requiresBacktest: true,
        requiresOperatorApproval: false,
        automaticLogicMutationAllowed: false,
        orderPlacementAllowed: false,
      };
    },
    persistRecord: () => ({ persisted: true }),
    persistManualAdjustmentRecommendation: () => ({ persisted: false }),
  });

  assert.equal(result.status, "completed_readonly");
  assert.equal(capturedInput.trades.lifecycleSourceAvailable, false);
  assert.equal(capturedInput.trades.completedRoundTrips, null);
});

test("runner supplies bounded PAPER execution lifecycle evidence to AI provider", async () => {
  let capturedInput = null;
  let persistedRecord = null;
  const lifecycleEvidence = Object.freeze({
    version: "paper_auto_execution_ai_lifecycle_evidence_v1",
    performanceEpochActive: true,
    performanceEpochStartedAt: "2026-08-31T18:20:31.044Z",
    lifecycleRecordCount: 2,
    scaleActionRecordCount: 1,
    lifecycleStateCounts: Object.freeze({ MONITORING: 1, ROUND_TRIP_COMPLETED: 1 }),
    lifecycles: Object.freeze([
      Object.freeze({ symbol: "AAA", state: "MONITORING" }),
      Object.freeze({ symbol: "BBB", state: "ROUND_TRIP_COMPLETED" }),
    ]),
    scaleActions: Object.freeze([
      Object.freeze({ symbol: "AAA", action: "scale_in", state: "FILLED_RECONCILED" }),
    ]),
    readOnly: true,
    paperOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });

  const result = await runCustomerReportBackgroundAiReview({
    now: new Date("2026-09-01T05:30:00.000Z"),
    performanceEpochStartedAt: "2026-08-31T18:20:31.044Z",
    listScans: () => [{
      scanId: "life-evidence-scan",
      eventAt: "2026-09-01T05:29:00.000Z",
      scanType: "under_five",
      candidates: [{ symbol: "AAA", decision: "WAIT" }],
    }],
    listPremarketScans: () => [],
    listStrategyObservations: () => [],
    buildPaperExecutionLifecycleEvidence: (options) => {
      assert.equal(options.performanceEpochStartedAt, "2026-08-31T18:20:31.044Z");
      return lifecycleEvidence;
    },
    fetchPaperAccount: async () => ({ status: "not_connected_readonly", positions: [], summary: {} }),
    buildPaperAccount: () => ({ account: {}, summary: {}, readOnly: true, paperOnly: true }),
    requestAiReview: async ({ input }) => {
      capturedInput = input;
      return {
        status: "completed_readonly",
        provider: "test",
        model: "test",
        reviewText: "Lifecycle evidence reviewed manually.",
      };
    },
    persistRecord: (record) => {
      persistedRecord = record;
      return { appended: true, duplicateSkipped: false, ledgerPath: "memory" };
    },
    persistManualAdjustmentRecommendation: () => ({ appended: false, duplicateSkipped: false, ledgerPath: null }),
  });

  assert.equal(capturedInput.paperExecutionLifecycleEvidence, lifecycleEvidence);
  assert.equal(result.includedPaperExecutionLifecycleEvidence, true);
  assert.equal(result.paperExecutionLifecycleRecordCount, 2);
  assert.equal(result.paperExecutionScaleActionRecordCount, 1);
  assert.equal(persistedRecord.paperExecutionLifecycleRecordCount, 2);
  assert.equal(persistedRecord.paperExecutionScaleActionRecordCount, 1);
  assert.equal(persistedRecord.includedPaperExecutionLifecycleEvidence, true);
  assert.equal(persistedRecord.requiresBacktest, true);
  assert.equal(persistedRecord.requiresOperatorApproval, true);
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});
