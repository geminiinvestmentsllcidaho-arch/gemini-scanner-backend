import test from "node:test";
import assert from "node:assert/strict";
import {
  getCustomerReportRealtimeAiConfig,
  requestCustomerReportRealtimeAiReview,
} from "../src/scanner/customer_report_realtime_ai_client.mjs";

test("realtime AI is disabled and read-only by default", () => {
  const config = getCustomerReportRealtimeAiConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.configured, false);
  assert.equal(config.automaticLogicMutationAllowed, false);
  assert.equal(config.orderPlacementAllowed, false);
});

test("does not contact provider while disabled", async () => {
  let called = false;
  const result = await requestCustomerReportRealtimeAiReview({
    input: { period: "daily" },
    env: {},
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });
  assert.equal(called, false);
  assert.equal(result.status, "disabled");
});

test("returns not configured without API key", async () => {
  const result = await requestCustomerReportRealtimeAiReview({
    input: {},
    env: { GS_REALTIME_AI_ENABLED: "true" },
  });
  assert.equal(result.status, "not_configured");
});

test("calls Responses API and returns bounded review text", async () => {
  let request;
  const result = await requestCustomerReportRealtimeAiReview({
    input: { period: "weekly", safety: { readOnly: true } },
    env: {
      GS_REALTIME_AI_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
      GS_REALTIME_AI_MODEL: "test-model",
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: "resp_test",
            model: "test-model",
            output_text: "Backtest a higher confidence floor before use.",
          };
        },
      };
    },
  });

  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  const requestBody = JSON.parse(request.options.body);
  assert.equal(requestBody.max_output_tokens, 1600);
  assert.deepEqual(requestBody.reasoning, { effort: "low" });
  assert.match(request.options.body, /manual operator approval/);
  assert.match(request.options.body, /Honor input\.dataSemantics exactly/);
  assert.match(request.options.body, /Treat null or unavailable values as missing data, never as zero/);
  assert.match(request.options.body, /Use input\.calibrationContext only as bounded historical evidence/);
  assert.match(request.options.body, /Never treat calibrationContext as permission for automatic learning/);
  assert.match(request.options.body, /Use input\.strategyObservationEvidence only as bounded historical measurement evidence/);
  assert.match(request.options.body, /Distinguish observable, stale, missing, and insufficient-sample strategy outcomes/);
  assert.match(request.options.body, /Do not infer causality from small samples or mixed strategies/);
  assert.match(request.options.body, /Never treat strategyObservationEvidence as permission to learn automatically, patch code/);
  assert.match(request.options.body, /Do not compare totalTrades with fillCount/);
  assert.match(request.options.body, /Do not infer broken scanner linkage/);
  assert.equal(result.status, "completed_readonly");
  assert.equal(result.responseId, "resp_test");
  assert.equal(result.automaticLogicMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});

test("bounds oversized review text", async () => {
  const oversized = "x".repeat(15000);
  const result = await requestCustomerReportRealtimeAiReview({
    input: {},
    env: {
      GS_REALTIME_AI_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          id: "resp_oversized",
          model: "test-model",
          output_text: oversized,
        };
      },
    }),
  });

  assert.equal(result.status, "completed_readonly");
  assert.equal(result.reviewText.length, 12000);
  assert.equal(result.reviewText, "x".repeat(12000));
});

test("supports a bounded per-request timeout override", async () => {
  let capturedSignal;
  const resultPromise = requestCustomerReportRealtimeAiReview({
    input: { period: "daily" },
    env: {
      GS_REALTIME_AI_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
      GS_REALTIME_AI_TIMEOUT_MS: "30000",
    },
    timeoutMs: 10,
    fetchImpl: async (_url, options) => {
      capturedSignal = options.signal;
      await new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    },
  });

  const result = await resultPromise;
  assert.equal(capturedSignal.aborted, true);
  assert.equal(result.status, "timeout");
});
