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
            output_text: "Backtest a higher confidence floor before manual approval.",
          };
        },
      };
    },
  });

  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  assert.match(request.options.body, /manual operator approval/);
  assert.equal(result.status, "completed_readonly");
  assert.equal(result.responseId, "resp_test");
  assert.equal(result.automaticLogicMutationAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});
