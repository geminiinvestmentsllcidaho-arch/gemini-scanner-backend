import { buildPostMarketSchedulePlan } from "./post_market_schedule_planner.mjs";
import { runPostMarketReadonlyWorkerCycle } from "./post_market_readonly_worker.mjs";

export const VERSION = "post_market_runtime_worker_v1";

function safeDelay(nextCycleAt, nowMs) {
  const targetMs = Date.parse(nextCycleAt ?? "");
  if (!Number.isFinite(targetMs)) return 60_000;
  return Math.max(1_000, targetMs - nowMs);
}

export function createPostMarketRuntimeWorker({
  env = process.env,
  runCycle = runPostMarketReadonlyWorkerCycle,
  afterCycle = async () => null,
  buildPlan = buildPostMarketSchedulePlan,
  getMarketClock = async () => ({}),
  now = () => new Date(),
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  logger = console,
} = {}) {
  const enabled = !["0", "false", "off", "no"].includes(
    String(env.GS_POSTMARKET_WORKER_ENABLED ?? "true").trim().toLowerCase(),
  );

  let timer = null;
  let inFlight = null;
  let running = false;
  let runCount = 0;
  let skippedCount = 0;
  let lastStartedAt = null;
  let lastCompletedAt = null;
  let lastStatus = enabled ? "idle" : "disabled";
  let lastErrorCode = null;
  let lastPlan = null;
  let lastResult = null;
  let previousFingerprint = null;

  function schedule(nextCycleAt) {
    if (!running || !enabled) return;
    if (timer) clearTimeoutImpl(timer);
    const delayMs = safeDelay(nextCycleAt, now().getTime());
    timer = setTimeoutImpl(() => {
      timer = null;
      void tick();
    }, delayMs);
    timer?.unref?.();
  }

  async function tick() {
    if (!enabled) {
      lastStatus = "disabled";
      return getStatus();
    }
    if (inFlight) {
      skippedCount += 1;
      lastStatus = "in_flight_skipped";
      return getStatus();
    }

    const started = now();
    lastStartedAt = started.toISOString();
    lastStatus = "planning";
    lastErrorCode = null;

    inFlight = Promise.resolve()
      .then(async () => {
        const marketClock = await getMarketClock({ now: started });
        const plan = buildPlan( { now: started, marketClock });
        lastPlan = plan;

        if (!plan.shouldRunNow) {
          lastStatus = plan.schedulerState;
          schedule(plan.nextCycleAt);
          return Object.freeze({
            status: lastStatus,
            ranCycle: false,
            plan,
            readOnly: true,
            paperOnly: true,
          });
        }

        lastStatus = "running_readonly_cycle";
        const result = await runCycle({
          now: started,
          previousFingerprint,
          marketClock,
          schedulePlan: plan,
        });
        runCount += 1;
        lastCompletedAt = now().toISOString();
        lastResult = result ?? null;
        if (result?.fingerprint) previousFingerprint = result.fingerprint;

        let afterCycleResult = null;
        try {
          afterCycleResult = await afterCycle({
            now: started,
            result,
            marketClock,
            schedulePlan: plan,
          });
        } catch (error) {
          logger?.error?.(
            "[postmarket-runtime] after-cycle hook failed",
            error?.message ?? String(error),
          );
          afterCycleResult = Object.freeze({
            status: "after_cycle_hook_failed",
            errorCode: String(
              error?.code ?? error?.name ?? "POSTMARKET_AFTER_CYCLE_HOOK_FAILED",
            ).slice(0, 120),
            readOnly: true,
            paperOnly: true,
            automaticLearningAllowed: false,
            scannerLogicMutationAllowed: false,
            thresholdMutationAllowed: false,
            brokerContactAllowed: false,
            orderPlacementAllowed: false,
            accountMutationAllowed: false,
          });
        }

        lastResult = Object.freeze({
          ...(result ?? {}),
          strategyObservationPersistence: afterCycleResult,
        });
        lastStatus = result?.duplicateSnapshot
          ? "duplicate_snapshot_suppressed"
          : result?.status ?? "completed_readonly";
        schedule(plan.nextCycleAt);
        return lastResult;
      })
      .catch((error) => {
        lastCompletedAt = now().toISOString();
        lastStatus = "worker_error";
        lastErrorCode = String(error?.code ?? error?.name ?? "POSTMARKET_RUNTIME_WORKER_FAILED").slice(0, 120);
        logger?.error?.("[postmarket-runtime] tick failed", error?.message ?? String(error));
        schedule(new Date(now().getTime() + 60_000).toISOString());
        return Object.freeze({
          status: lastStatus,
          errorCode: lastErrorCode,
          readOnly: true,
          paperOnly: true,
          orderPlacementAllowed: false,
          accountMutationAllowed: false,
        });
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  function start() {
    if (!enabled) {
      lastStatus = "disabled";
      return getStatus();
    }
    if (running) return getStatus();
    running = true;
    void tick();
    return getStatus();
  }

  function stop() {
    running = false;
    if (timer) clearTimeoutImpl(timer);
    timer = null;
    if (!inFlight) lastStatus = enabled ? "stopped" : "disabled";
    return getStatus();
  }

  function getStatus() {
    return Object.freeze({
      version: VERSION,
      enabled,
      running,
      timerScheduled: Boolean(timer),
      inFlight: Boolean(inFlight),
      runCount,
      skippedCount,
      lastStartedAt,
      lastCompletedAt,
      lastStatus,
      lastErrorCode,
      schedulerState: lastPlan?.schedulerState ?? lastStatus,
      nextWakeAt: lastPlan?.nextCycleAt ?? null,
      lastPlan,
      lastResult,
      previousFingerprint,
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      automaticLearningAllowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    });
  }

  return Object.freeze({ start, stop, tick, getStatus });
}

export default Object.freeze({
  VERSION,
  createPostMarketRuntimeWorker,
});
