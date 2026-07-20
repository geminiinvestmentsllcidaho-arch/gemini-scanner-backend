import { fetchAlpacaPremarketUniverseReadonly, premarketSession } from "./alpaca_premarket_universe_readonly.mjs";
import { consolidatePremarketScansReadonly } from "./premarket_multiscan_consolidation_readonly.mjs";

export const VERSION = "alpaca_premarket_shared_scan_cache_v1";

function easternParts(nowMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function easternDateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = easternParts(date.getTime());
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function practicalPremarketIntervalSec(nowMs = Date.now()) {
  const parts = easternParts(nowMs);
  const minutes = (Number(parts.hour) * 60) + Number(parts.minute);
  if (minutes < 420) return 300;
  if (minutes < 510) return 120;
  return 30;
}

export function isPremarketTradingDay(snapshot, nowMs = Date.now()) {
  const session = premarketSession(new Date(nowMs));
  if (["Sat", "Sun"].includes(session.weekday)) return false;

  const today = easternDateKey(nowMs);
  const clock = snapshot?.marketClock ?? {};
  const nextOpen = clock.next_open ?? clock.nextOpen ?? null;
  const nextOpenDate = easternDateKey(nextOpen);

  return nextOpenDate ? nextOpenDate === today : true;
}

export function msUntilNextPremarketBoundary(nowMs = Date.now(), intervalSec = practicalPremarketIntervalSec(nowMs)) {
  const intervalMs = Math.max(1, Number(intervalSec) || 30) * 1000;
  const remainder = Number(nowMs) % intervalMs;
  return remainder === 0 ? intervalMs : intervalMs - remainder;
}

export function msUntilNextPremarketWake(nowMs = Date.now()) {
  const session = premarketSession(new Date(nowMs));
  if (session.active) return msUntilNextPremarketBoundary(nowMs);

  const minuteMs = 60 * 1000;
  let probeMs = (Math.floor(Number(nowMs) / minuteMs) * minuteMs) + minuteMs;
  const limitMs = Number(nowMs) + (8 * 24 * 60 * 60 * 1000);

  while (probeMs <= limitMs) {
    if (premarketSession(new Date(probeMs)).active) return probeMs - Number(nowMs);
    probeMs += minuteMs;
  }

  return 60 * 60 * 1000;
}

export function createAlpacaPremarketSharedScanCache({
  fetchScan = fetchAlpacaPremarketUniverseReadonly,
  now = () => Date.now(),
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  scanOptions = {},
  onScanComplete = null,
  initialScanHistory = [],
} = {}) {
  let latest = null;
  let timer = null;
  let running = false;
  let inFlight = null;
  let scanCount = 0;
  let lastError = null;
  let skippedCount = 0;
  let aiEvidencePublicationCount = 0;
  let lastAiEvidencePublishedAt = null;
  let lastAiEvidencePublicationError = null;
  const maxHistoryScans = Math.max(10, Number(scanOptions.maxHistoryScans ?? 240));
  const normalizeHistoryTimestamp = (scan) => {
    const value = scan?.sharedCache?.generatedAt ?? scan?.generatedAt ?? null;
    const timestampMs = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(timestampMs) ? timestampMs : null;
  };
  const historyKey = (scan) => String(
    scan?.scanId
    ?? scan?.sharedCache?.scanId
    ?? scan?.generatedAt
    ?? scan?.sharedCache?.generatedAt
    ?? ""
  );
  const scanHistory = (Array.isArray(initialScanHistory) ? initialScanHistory : [])
    .filter((scan) => scan && typeof scan === "object" && Array.isArray(scan.candidates))
    .map((scan) => ({ ...scan }))
    .filter((scan) => normalizeHistoryTimestamp(scan) !== null)
    .sort((a, b) => normalizeHistoryTimestamp(a) - normalizeHistoryTimestamp(b))
    .filter((scan, index, items) => {
      const key = historyKey(scan);
      return !key || items.findIndex((item) => historyKey(item) === key) === index;
    })
    .slice(-maxHistoryScans);

  const diagnostics = () => {
    const nowMs = now();
    const session = premarketSession(new Date(nowMs));
    const nextWakeMs = msUntilNextPremarketWake(nowMs);
    const latestSharedCache = latest?.sharedCache ?? null;
    const latestCandidateCount = Number.isFinite(Number(latest?.candidateCount))
      ? Number(latest.candidateCount)
      : Array.isArray(latest?.candidates)
        ? latest.candidates.length
        : 0;
    const schedulerState = !running
      ? "stopped"
      : lastError
        ? "error"
        : session.active
          ? "scanning"
          : "sleeping";
    const multiscanConsolidation = consolidatePremarketScansReadonly(scanHistory, {
      generatedAt: new Date(nowMs).toISOString(),
    });

    return ({
    version: VERSION,
    running,
    schedulerState,
    scanCount,
    skippedCount,
    lastError,
    latest,
    hasSnapshot: latest !== null,
    session,
    practicalIntervalSec: practicalPremarketIntervalSec(nowMs),
    nextWakeAt: new Date(nowMs + nextWakeMs).toISOString(),
    nextWakeMs,
    lastAutomaticScanAt: latestSharedCache?.generatedAt ?? null,
    lastAutomaticScanSkipped: latestSharedCache?.skipped === true,
    lastAutomaticScanSkipReason: latestSharedCache?.skipReason ?? null,
    lastCandidateCount: latestCandidateCount,
    multiscanHistoryCount: scanHistory.length,
    multiscanConsolidation,
    aiEvidencePublicationCount,
    lastAiEvidencePublishedAt,
    lastAiEvidencePublicationError,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
  });
  };

  const refreshNow = async () => {
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const nowMs = now();
        const session = premarketSession(new Date(nowMs));

        if (!session.active) {
          skippedCount += 1;
          return latest;
        }

        const source = await fetchScan({
          ...scanOptions,
          now: new Date(nowMs),
        });

        if (!isPremarketTradingDay(source, nowMs)) {
          skippedCount += 1;
          latest = {
            ...source,
            sharedCache: {
              version: VERSION,
              generatedAt: new Date(nowMs).toISOString(),
              scanCount,
              skipped: true,
              skipReason: "market_not_open_today",
              readOnly: true,
            },
          };
          return latest;
        }

        scanCount += 1;
        lastError = null;
        latest = {
          ...source,
          sharedCache: {
            version: VERSION,
            generatedAt: new Date(nowMs).toISOString(),
            scanCount,
            skipped: false,
            intervalSec: practicalPremarketIntervalSec(nowMs),
            readOnly: true,
          },
        };

        scanHistory.push(latest);
        if (scanHistory.length > maxHistoryScans) {
          scanHistory.splice(0, scanHistory.length - maxHistoryScans);
        }

        if (typeof onScanComplete === "function") {
          try {
            await onScanComplete(latest);
            aiEvidencePublicationCount += 1;
            lastAiEvidencePublishedAt = latest?.sharedCache?.generatedAt ?? new Date(nowMs).toISOString();
            lastAiEvidencePublicationError = null;
          } catch (error) {
            lastAiEvidencePublicationError = error?.message ?? String(error);
            // Audit/reporting failures must never stop the scheduler.
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

  const scheduleNext = () => {
    if (!running) return;
    const nowMs = now();
    const delayMs = msUntilNextPremarketWake(nowMs);

    timer = setTimeoutImpl(async () => {
      try {
        await refreshNow();
      } catch {
        // Keep scheduler alive; diagnostics retain the last error.
      } finally {
        if (running) scheduleNext();
      }
    }, delayMs);
  };

  const start = async () => {
    if (running) return diagnostics();
    running = true;
    try {
      await refreshNow();
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
    getScanHistory: () => Object.freeze([...scanHistory]),
    getMultiscanConsolidation: () => consolidatePremarketScansReadonly(scanHistory),
    getDiagnostics: diagnostics,
  };
}

export default {
  VERSION,
  practicalPremarketIntervalSec,
  isPremarketTradingDay,
  msUntilNextPremarketBoundary,
  msUntilNextPremarketWake,
  createAlpacaPremarketSharedScanCache,
};
