export const VERSION = "customer_report_realtime_ai_client_v1";

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1600;
const DEFAULT_MAX_REVIEW_CHARS = 12000;

function boolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedText(value, maxChars = DEFAULT_MAX_REVIEW_CHARS) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function textFromResponse(payload = {}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return boundedText(payload.output_text);
  }
  const parts = [];
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return boundedText(parts.join("\n"));
}

export function getCustomerReportRealtimeAiConfig(env = process.env) {
  const apiKey = String(env.OPENAI_API_KEY ?? "").trim();
  return Object.freeze({
    version: VERSION,
    enabled: boolEnv(env.GS_REALTIME_AI_ENABLED, false),
    configured: apiKey.length > 0,
    apiKey,
    endpoint: String(env.OPENAI_RESPONSES_ENDPOINT ?? DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT,
    model: String(env.GS_REALTIME_AI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    timeoutMs: positiveInt(env.GS_REALTIME_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    readOnly: true,
    paperOnly: true,
    automaticLogicMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export async function requestCustomerReportRealtimeAiReview({
  input,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs,
} = {}) {
  const baseConfig = getCustomerReportRealtimeAiConfig(env);
  const config = Object.freeze({
    ...baseConfig,
    timeoutMs: positiveInt(timeoutMs, baseConfig.timeoutMs),
  });
  if (!config.enabled) {
    return Object.freeze({
      version: VERSION,
      status: "disabled",
      provider: "openai",
      model: config.model,
      reviewText: null,
      readOnly: true,
      automaticLogicMutationAllowed: false,
    });
  }
  if (!config.configured) {
    return Object.freeze({
      version: VERSION,
      status: "not_configured",
      provider: "openai",
      model: config.model,
      reviewText: null,
      readOnly: true,
      automaticLogicMutationAllowed: false,
    });
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
        reasoning: { effort: "low" },
        instructions: [
          "Review GeminiScanner paper-trading report data.",
          "Return concise observations and testing proposals only.",
          "Honor input.dataSemantics exactly and distinguish verified evidence from hypotheses.",
          "Treat null or unavailable values as missing data, never as zero.",
          "Use input.calibrationContext only as bounded historical evidence; stale or mixed-source groups must be described as provisional.",
          "Never treat calibrationContext as permission for automatic learning, scanner mutation, or threshold mutation.",
          "Use input.strategyObservationEvidence only as bounded historical measurement evidence.",
          "Distinguish observable, stale, missing, and insufficient-sample strategy outcomes.",
          "Do not infer causality from small samples or mixed strategies.",
          "Never treat strategyObservationEvidence as permission to learn automatically, patch code, mutate scanner logic, or change thresholds.",
          "Do not infer a P/L inconsistency from lastFillPrice differing from current mark-to-market P/L.",
          "Do not compare totalTrades with fillCount as though they measure the same thing.",
          "Do not infer broken scanner linkage solely because fills exist without scanner events.",
          "Never claim to change scanner logic.",
          "Never recommend placing an order.",
          "All changes require backtesting and manual operator approval.",
        ].join(" "),
        input: JSON.stringify(input ?? {}),
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return Object.freeze({
        version: VERSION,
        status: "provider_error",
        provider: "openai",
        model: config.model,
        httpStatus: response.status,
        errorCode: payload?.error?.code ?? null,
        reviewText: null,
        readOnly: true,
        automaticLogicMutationAllowed: false,
      });
    }

    const reviewText = textFromResponse(payload);
    return Object.freeze({
      version: VERSION,
      status: reviewText ? "completed_readonly" : "empty_response",
      provider: "openai",
      model: payload?.model ?? config.model,
      responseId: payload?.id ?? null,
      reviewText: reviewText || null,
      readOnly: true,
      paperOnly: true,
      requiresBacktest: true,
      requiresOperatorApproval: true,
      automaticLogicMutationAllowed: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    });
  } catch (error) {
    return Object.freeze({
      version: VERSION,
      status: error?.name === "AbortError" ? "timeout" : "request_failed",
      provider: "openai",
      model: config.model,
      errorName: error?.name ?? "Error",
      reviewText: null,
      readOnly: true,
      automaticLogicMutationAllowed: false,
    });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  VERSION,
  getCustomerReportRealtimeAiConfig,
  requestCustomerReportRealtimeAiReview,
};
