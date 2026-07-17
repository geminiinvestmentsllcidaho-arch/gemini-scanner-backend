export const VERSION = "customer_report_background_ai_review_worker_v1";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;

function boolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function boundedInterval(value, fallback = DEFAULT_INTERVAL_MS) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, parsed));
}

export function getCustomerReportBackgroundAiReviewWorkerConfig(env = process.env) {
  return Object.freeze({
    version: VERSION,
    enabled: boolEnv(env.GS_BACKGROUND_AI_REVIEW_ENABLED, false),
    intervalMs: boundedInterval(env.GS_BACKGROUND_AI_REVIEW_INTERVAL_MS),
    runOnStart: boolEnv(env.GS_BACKGROUND_AI_REVIEW_RUN_ON_START, false),
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

export function createCustomerReportBackgroundAiReviewWorker({
  env = process.env,
  runReview,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
  logger = console,
} = {}) {
  const config = getCustomerReportBackgroundAiReviewWorkerConfig(env);
  let timer = null;
  let inFlight = null;
  let runCount = 0;
  let lastStartedAt = null;
  let lastCompletedAt = null;
  let lastStatus = config.enabled ? "idle" : "disabled";
  let lastErrorCode = null;
  let lastResult = null;

  async function runNow() {
    if (!config.enabled) {
      lastStatus = "disabled";
      return Object.freeze({
        status: "disabled",
        readOnly: true,
        automaticLearningAllowed: false,
        scannerLogicMutationAllowed: false,
      });
    }
    if (inFlight) {
      return Object.freeze({
        status: "in_flight_skipped",
        readOnly: true,
        automaticLearningAllowed: false,
        scannerLogicMutationAllowed: false,
      });
    }
    if (typeof runReview !== "function") {
      lastStatus = "runner_unavailable";
      lastErrorCode = "RUN_REVIEW_REQUIRED";
      return Object.freeze({
        status: lastStatus,
        errorCode: lastErrorCode,
        readOnly: true,
        automaticLearningAllowed: false,
        scannerLogicMutationAllowed: false,
      });
    }

    const startedAt = new Date();
    lastStartedAt = startedAt.toISOString();
    lastStatus = "running";
    lastErrorCode = null;

    inFlight = Promise.resolve()
      .then(() => runReview({ now: startedAt, config }))
      .then((result) => {
        runCount += 1;
        lastCompletedAt = new Date().toISOString();
        lastResult = result ?? null;
        lastStatus = result?.status ?? "completed_readonly";
        return result;
      })
      .catch((error) => {
        runCount += 1;
        lastCompletedAt = new Date().toISOString();
        lastStatus = "worker_error";
        lastErrorCode = String(error?.code ?? error?.name ?? "BACKGROUND_AI_REVIEW_FAILED").slice(0, 120);
        logger?.error?.("[background-ai-review] run failed", error?.message ?? String(error));
        return Object.freeze({
          status: lastStatus,
          errorCode: lastErrorCode,
          readOnly: true,
          automaticLearningAllowed: false,
          scannerLogicMutationAllowed: false,
        });
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  function start() {
    if (!config.enabled) {
      lastStatus = "disabled";
      return getStatus();
    }
    if (timer) return getStatus();

    timer = setIntervalImpl(() => {
      void runNow();
    }, config.intervalMs);
    timer?.unref?.();
    lastStatus = "scheduled";

    if (config.runOnStart) {
      void runNow();
    }
    return getStatus();
  }

  function stop() {
    if (timer) {
      clearIntervalImpl(timer);
      timer = null;
    }
    if (!inFlight) lastStatus = config.enabled ? "stopped" : "disabled";
    return getStatus();
  }

  function getStatus() {
    return Object.freeze({
      version: VERSION,
      enabled: config.enabled,
      running: Boolean(timer),
      inFlight: Boolean(inFlight),
      intervalMs: config.intervalMs,
      runOnStart: config.runOnStart,
      runCount,
      lastStartedAt,
      lastCompletedAt,
      lastStatus,
      lastErrorCode,
      lastResult,
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

  return Object.freeze({ config, start, stop, runNow, getStatus });
}

export default {
  VERSION,
  getCustomerReportBackgroundAiReviewWorkerConfig,
  createCustomerReportBackgroundAiReviewWorker,
};
