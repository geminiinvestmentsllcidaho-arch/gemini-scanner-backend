import { fetchAlpacaUnderFiveUniverseReadonly } from "./alpaca_under_five_universe_readonly.mjs";
import { fetchAlpacaMarketClockReadonly } from "./alpaca_market_clock_readonly.mjs";

export const VERSION = "alpaca_under_five_shared_scan_cache_v3";
export const DEFAULT_DEMAND_WINDOW_SEC = 120;
export const MARKET_OPEN_FOCUSED_INTERVAL_SEC = 15;
export const MARKET_OPEN_BROAD_INTERVAL_SEC = 300;

export function intervalSecForMarket(isOpen) {
  return isOpen === true ? MARKET_OPEN_FOCUSED_INTERVAL_SEC : 300;
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
  let broadScanCount = 0;
  let focusedScanCount = 0;
  let lastBroadScanAtMs = null;
  let broadCandidateSymbols = [];
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
    broadScanCount,
    focusedScanCount,
    lastBroadScanAt: Number.isFinite(lastBroadScanAtMs) ? new Date(lastBroadScanAtMs).toISOString() : null,
    broadCandidateSymbols: [...broadCandidateSymbols],
    broadIntervalSec: MARKET_OPEN_BROAD_INTERVAL_SEC,
    focusedIntervalSec: MARKET_OPEN_FOCUSED_INTERVAL_SEC,
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

  const applyScanResult = async (source, { broad = false } = {}) => {
    const generatedAtMs = Number(now());
    scanCount += 1;
    if (broad) {
      broadScanCount += 1;
      lastBroadScanAtMs = generatedAtMs;
      broadCandidateSymbols = Array.isArray(source?.candidates)
        ? [...new Set(source.candidates.map((candidate) => String(candidate?.symbol ?? "").trim().toUpperCase()).filter(Boolean))]
        : [];
    } else {
      focusedScanCount += 1;
    }
    lastError = null;
    idleReason = demandActive() ? null : "manual_refresh_without_active_demand";
    latest = {
      ...source,
      idleNoDemand: !demandActive(),
      sharedCache: {
        version: VERSION,
        generatedAt: new Date(generatedAtMs).toISOString(),
        scanCount,
        broadScanCount,
        focusedScanCount,
        lastBroadScanAt: Number.isFinite(lastBroadScanAtMs) ? new Date(lastBroadScanAtMs).toISOString() : null,
        broadCandidateSymbols: [...broadCandidateSymbols],
        scanTier: broad ? "broad" : "focused",
        broadIntervalSec: MARKET_OPEN_BROAD_INTERVAL_SEC,
        focusedIntervalSec: MARKET_OPEN_FOCUSED_INTERVAL_SEC,
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
  };

  const refreshNow = async () => {
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const source = await fetchScan({
          ...scanOptions,
        });
        return await applyScanResult(source, { broad: true });
      } catch (error) {
        lastError = error?.message ?? String(error);
        throw error;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  };

  const refreshFocusedNow = async () => {
    if (inFlight) return inFlight;

    const symbols = [...broadCandidateSymbols];

    if (symbols.length === 0) {
      lastError = null;
      return latest;
    }

    inFlight = (async () => {
      try {
        const source = await fetchScan({
          ...scanOptions,
          symbols,
        });
        return await applyScanResult(source, { broad: false });
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
      const nowMs = Number(now());
      const broadDue =
        !Number.isFinite(lastBroadScanAtMs)
        || nowMs - lastBroadScanAtMs >= MARKET_OPEN_BROAD_INTERVAL_SEC * 1000;
      return broadDue ? refreshNow() : refreshFocusedNow();
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
    refreshFocusedNow,
    getLatest: () => latest,
    getDiagnostics: diagnostics,
  };
}
