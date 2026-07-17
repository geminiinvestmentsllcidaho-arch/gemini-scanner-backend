import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomerReportBackgroundAiReviewWorker,
  getCustomerReportBackgroundAiReviewWorkerConfig,
} from "../src/scanner/customer_report_background_ai_review_worker.mjs";

test("background AI review worker is disabled and safety locked by default", () => {
  const config = getCustomerReportBackgroundAiReviewWorkerConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.intervalMs, 900000);
  assert.equal(config.readOnly, true);
  assert.equal(config.paperOnly, true);
  assert.equal(config.automaticLearningAllowed, false);
  assert.equal(config.scannerLogicMutationAllowed, false);
  assert.equal(config.orderPlacementAllowed, false);
});

test("normalizes explicit worker configuration with bounded interval", () => {
  const low = getCustomerReportBackgroundAiReviewWorkerConfig({
    GS_BACKGROUND_AI_REVIEW_ENABLED: "true",
    GS_BACKGROUND_AI_REVIEW_INTERVAL_MS: "1",
    GS_BACKGROUND_AI_REVIEW_RUN_ON_START: "yes",
  });
  assert.equal(low.enabled, true);
  assert.equal(low.intervalMs, 60000);
  assert.equal(low.runOnStart, true);

  const high = getCustomerReportBackgroundAiReviewWorkerConfig({
    GS_BACKGROUND_AI_REVIEW_INTERVAL_MS: "999999999",
  });
  assert.equal(high.intervalMs, 86400000);
});

test("disabled worker never schedules or calls provider runner", async () => {
  let scheduled = 0;
  let calls = 0;
  const worker = createCustomerReportBackgroundAiReviewWorker({
    env: {},
    runReview: async () => {
      calls += 1;
    },
    setIntervalImpl: () => {
      scheduled += 1;
      return {};
    },
  });

  assert.equal(worker.start().lastStatus, "disabled");
  assert.equal((await worker.runNow()).status, "disabled");
  assert.equal(scheduled, 0);
  assert.equal(calls, 0);
});

test("enabled worker schedules one interval and runs read-only review", async () => {
  let intervalCallback;
  let scheduledMs;
  let calls = 0;
  const worker = createCustomerReportBackgroundAiReviewWorker({
    env: {
      GS_BACKGROUND_AI_REVIEW_ENABLED: "true",
      GS_BACKGROUND_AI_REVIEW_INTERVAL_MS: "60000",
    },
    runReview: async () => {
      calls += 1;
      return Object.freeze({
        status: "completed_readonly",
        reviewId: "review-1",
        automaticLearningAllowed: false,
      });
    },
    setIntervalImpl: (callback, ms) => {
      intervalCallback = callback;
      scheduledMs = ms;
      return { unref() {} };
    },
    clearIntervalImpl: () => {},
  });

  const started = worker.start();
  assert.equal(started.running, true);
  assert.equal(scheduledMs, 60000);
  assert.equal(calls, 0);

  intervalCallback();
  await new Promise((resolve) => setImmediate(resolve));

  const status = worker.getStatus();
  assert.equal(calls, 1);
  assert.equal(status.runCount, 1);
  assert.equal(status.lastStatus, "completed_readonly");
  assert.equal(status.lastResult.reviewId, "review-1");
  assert.equal(status.automaticLearningAllowed, false);
  assert.equal(status.scannerLogicMutationAllowed, false);
});

test("worker deduplicates overlapping background reviews", async () => {
  let release;
  let calls = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const worker = createCustomerReportBackgroundAiReviewWorker({
    env: { GS_BACKGROUND_AI_REVIEW_ENABLED: "true" },
    runReview: async () => {
      calls += 1;
      await pending;
      return { status: "completed_readonly" };
    },
  });

  const first = worker.runNow();
  await new Promise((resolve) => setImmediate(resolve));
  const second = await worker.runNow();

  assert.equal(second.status, "in_flight_skipped");
  assert.equal(calls, 1);

  release();
  await first;
  assert.equal(worker.getStatus().runCount, 1);
});

test("worker fails closed when runner is unavailable", async () => {
  const worker = createCustomerReportBackgroundAiReviewWorker({
    env: { GS_BACKGROUND_AI_REVIEW_ENABLED: "true" },
  });
  const result = await worker.runNow();
  assert.equal(result.status, "runner_unavailable");
  assert.equal(result.errorCode, "RUN_REVIEW_REQUIRED");
  assert.equal(result.automaticLearningAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
});
