import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
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
    marketOpen: true,
    sourceStatus: "ok",
    candidates: [{
 symbol: "ABC", decision: "ENTER" }],
  }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].scanId, "scan-1");
  assert.equal(events[0].resultState, "ENTER");
  assert.equal(events[0].marketOpen, true);
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
