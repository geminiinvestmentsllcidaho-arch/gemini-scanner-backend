import { fetchAlpacaUnderFiveUniverseReadonly } from "./alpaca_under_five_universe_readonly.mjs";
import { fetchAlpacaMarketClockReadonly } from "./alpaca_market_clock_readonly.mjs";

export const VERSION = "alpaca_under_five_shared_scan_cache_v1";

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
} = {}) {
  let latest = null;
  let timer = null;
  let running = false;
  let inFlight = null;
  let scanCount = 0;
  let lastError = null;

  const diagnostics = () => ({
    version: VERSION,
    running,
    scanCount,
    lastError,
    latest,
    hasSnapshot: latest !== null,
    lastClockCheckedAt: latest?.sharedCache?.clockCheckedAt ?? null,
    readOnly: true,
    sharedAcrossRequests: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });

  const refreshNow = async () => {
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const source = await fetchScan({
          ...scanOptions,
          nowMs: now(),
        });

        scanCount += 1;
        lastError = null;
        latest = {
          ...source,
          sharedCache: {
            version: VERSION,
            generatedAt: new Date(now()).toISOString(),
            scanCount,
            sharedAcrossRequests: true,
            readOnly: true,
          },
        };

        if (typeof onScanComplete === "function") {
          try {
            await onScanComplete(latest);
          } catch {
            // Audit/reporting failures must never stop the shared scanner.
          }
        }

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

  const updateClosedMarketSnapshot = (clockSource = {}) => {
    const marketClock = clockSource?.marketClock ?? {};
    latest = {
      ok: clockSource?.ok !== false,
      version: VERSION,
      status: clockSource?.status ?? "closed_market_wait",
      marketClock,
      assetCount: 0,
      snapshotCount: 0,
      candidateCount: 0,
      candidates: [],
      startupDeferred: scanCount === 0,
      sharedCache: {
        version: VERSION,
        generatedAt: new Date(now()).toISOString(),
        clockCheckedAt: new Date(now()).toISOString(),
        scanCount,
        sharedAcrossRequests: true,
        readOnly: true,
      },
    };
    lastError = null;
    return latest;
  };

  const runScheduledTick = async () => {
    const clockSource = await fetchMarketClock();
    const marketClock = clockSource?.marketClock ?? {};

    if (marketClock?.isOpen === true) {
      return refreshNow();
    }

    return updateClosedMarketSnapshot(clockSource);
  };

  const scheduleNext = () => {
    if (!running) return;

    const intervalSec = intervalSecForMarket(latest?.marketClock?.isOpen === true);
    const delayMs = msUntilNextBoundary(now(), intervalSec);

    timer = setTimeoutImpl(async () => {
      try {
        await runScheduledTick();
      } catch (error) {
        lastError = error?.message ?? String(error);
        // Keep the shared scheduler alive; diagnostics retain the last error.
      } finally {
        if (running) scheduleNext();
      }
    }, delayMs);
  };

  const start = async () => {
    if (running) return diagnostics();
    running = true;
    try {
      const clockSource = await fetchMarketClock();
      const marketClock = clockSource?.marketClock ?? {};
      if (marketClock?.isOpen === true) {
        await refreshNow();
      } else {
        updateClosedMarketSnapshot(clockSource);
      }
    } finally {
      if (running) scheduleNext();
    }
    return diagnostics();
  };

  const stop = () => {
    running = false;
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
    return diagnostics();
  };

  return {
    start,
    stop,
    refreshNow,
    getLatest: () => latest,
    getDiagnostics: diagnostics,
  };
}
