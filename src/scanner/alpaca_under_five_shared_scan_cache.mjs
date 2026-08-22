import { fetchAlpacaUnderFiveUniverseReadonly } from "./alpaca_under_five_universe_readonly.mjs";
import { fetchAlpacaMarketClockReadonly } from "./alpaca_market_clock_readonly.mjs";

export const VERSION = "alpaca_under_five_shared_scan_cache_v2";
export const DEFAULT_DEMAND_WINDOW_SEC = 120;

export function intervalSecForMarket(isOpen) {
  return isOpen === true ? 15 : 300;
}

export function msUntilNextBoundary(nowMs = Date.now(), intervalSec = 30) {
  const intervalMs = Math.max(1, Number(intervalSec) || 30) * 1000;
  const remainder = Number(nowMs) % intervalMs;
  return remainder === 0 ? intervalMs : intervalMs - remainder;
}

export function createAlpacaUnderFiveSharedScanCache({
  fetchScan = fetchAlpacaUnderFiveUniverseReadonly,
  fetchMarketClock = fetchAlpacaMarketClockReadonly,
  now = () => Date.now(),
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  scanOptions = {},
  onScanComplete = null,
  demandWindowSec = DEFAULT_DEMAND_WINDOW_SEC,
} = {}) {
  let latest = null;
  let timer = null;
  let running = false;
  let inFlight = null;
  let scanCount = 0;
  let lastError = null;
  let nextWakeAt = null;
  let demandUntilMs = null;
  let lastDemandAt = null;
  let idleReason = "not_started";

  const normalizedDemandWindowSec = Math.max(15, Number(demandWindowSec) || DEFAULT_DEMAND_WINDOW_SEC);
  const demandActive = () =>
    Number.isFinite(demandUntilMs) && demandUntilMs > Number(now());

  const diagnostics = () => ({
    version: VERSION,
    running,
    scanCount,
    lastError,
    latest,
    hasSnapshot: latest !== null,
    lastClockCheckedAt: latest?.sharedCache?.clockCheckedAt ?? null,
    nextWakeAt,
    timerScheduled: timer !== null,
    inFlight: inFlight !== null,
    demandAware: true,
    demandActive: demandActive(),
    demandWindowSec: normalizedDemandWindowSec,
    demandUntil: Number.isFinite(demandUntilMs) ? new Date(demandUntilMs).toISOString() : null,
    lastDemandAt,
    idleReason,
    readOnly: true,
    sharedAcrossRequests: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
    nextWakeAt = null;
  };

  const markIdle = (reason = "no_active_demand") => {
    idleReason = reason;
    clearTimer();
    if (latest) {
      latest = {
        ...latest,
        idleNoDemand: true,
        sharedCache: {
          ...(latest.sharedCache ?? {}),
          idleNoDemand: true,
          demandAware: true,
        },
      };
    }
  };

  const refreshNow = async () => {
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const source = await fetchScan({
          ...scanOptions,
        });

        scanCount += 1;
        lastError = null;
        idleReason = demandActive() ? null : "manual_refresh_without_active_demand";
        latest = {
          ...source,
          idleNoDemand: !demandActive(),
          sharedCache: {
            version: VERSION,
            generatedAt: new Date(now()).toISOString(),
            scanCount,
            sharedAcrossRequests: true,
            readOnly: true,
            demandAware: true,
            idleNoDemand: !demandActive(),
          },
        };

        if (typeof onScanComplete === "function") {
          try {
            await onScanComplete(latest);
          } catch {
          }
        }

        if (running && demandActive() && timer === null) scheduleNext();
        return latest;
      } catch (error) {
        lastError = error?.message ?? String(error);
        throw error;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  };

  const runDemandTick = async () => {
    if (!demandActive()) {
      markIdle("demand_window_expired");
      return latest;
    }

    const clockSource = await fetchMarketClock();
    const marketClock = clockSource?.marketClock ?? {};

    if (marketClock?.isOpen === true) {
      return refreshNow();
    }

    lastError = null;
    latest = {
      ok: clockSource?.ok !== false,
      version: VERSION,
      status: clockSource?.status ?? "closed_market_wait",
      marketClock,
      assetCount: 0,
      snapshotCount: 0,
      candidateCount: 0,
      candidates: [],
      idleNoDemand: false,
      sharedCache: {
        version: VERSION,
        generatedAt: new Date(now()).toISOString(),
        clockCheckedAt: new Date(now()).toISOString(),
        scanCount,
        sharedAcrossRequests: true,
        readOnly: true,
        demandAware: true,
        idleNoDemand: false,
      },
    };
    return latest;
  };

  const scheduleNext = () => {
    clearTimer();
    if (!running) return;
    if (!demandActive()) {
      markIdle("no_active_demand");
      return;
    }

    const nowMs = Number(now());
    const marketOpen = latest?.marketClock?.isOpen === true;
    const cadenceMs = msUntilNextBoundary(nowMs, intervalSecForMarket(marketOpen));
    const remainingDemandMs = Math.max(1, demandUntilMs - nowMs);
    const delayMs = Math.min(cadenceMs, remainingDemandMs);
    nextWakeAt = new Date(nowMs + delayMs).toISOString();

    timer = setTimeoutImpl(async () => {
      timer = null;
      nextWakeAt = null;
      try {
        await runDemandTick();
      } catch (error) {
        lastError = error?.message ?? String(error);
      } finally {
        if (running && demandActive()) scheduleNext();
        else if (running) markIdle("demand_window_expired");
      }
    }, delayMs);
  };

  const noteDemand = () => {
    const nowMs = Number(now());
    lastDemandAt = new Date(nowMs).toISOString();
    demandUntilMs = nowMs + normalizedDemandWindowSec * 1000;
    idleReason = null;
    if (latest?.idleNoDemand === true) {
      latest = {
        ...latest,
        idleNoDemand: false,
        sharedCache: {
          ...(latest.sharedCache ?? {}),
          idleNoDemand: false,
          demandAware: true,
        },
      };
    }
    if (running && timer === null && latest !== null) scheduleNext();
    return diagnostics();
  };

  const start = async () => {
    if (running) return diagnostics();
    running = true;
    idleReason = "waiting_for_demand";
    clearTimer();
    return diagnostics();
  };

  const stop = () => {
    running = false;
    demandUntilMs = null;
    idleReason = "stopped";
    clearTimer();
    return diagnostics();
  };

  return {
    start,
    stop,
    noteDemand,
    refreshNow,
    getLatest: () => latest,
    getDiagnostics: diagnostics,
  };
}
