export const VERSION = "alpaca_under_five_cadence_verifier_v2";

const EXPECTED_CACHE_VERSION = "alpaca_under_five_shared_scan_cache_v3";
const EXPECTED_BROAD_INTERVAL_SEC = 300;
const EXPECTED_FOCUSED_INTERVAL_SEC = 15;

const finite = (value) =>
  value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const isoMs = (value) => {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
};
const normalizeSymbols = (value) =>
  Object.freeze(Array.isArray(value)
    ? [...new Set(value.map((symbol) => String(symbol ?? "").trim()).filter(Boolean))]
    : []);
const sameSymbols = (a, b) =>
  a.length === b.length && a.every((symbol, index) => symbol === b[index]);

export function createCadenceVerifierState() {
  return Object.freeze({
    marketWasOpen: false,
    startedAt: null,
    lastObservedAt: null,
    lastFocusedProgressAt: null,
    lastBroadScanCount: null,
    lastFocusedScanCount: null,
    lastBroadScanAt: null,
    broadCandidateSymbols: Object.freeze([]),
    broadEvents: Object.freeze([]),
    focusedEvents: Object.freeze([]),
    violations: Object.freeze([]),
  });
}

function event(kind, at, count, delta, diagnostics) {
  return Object.freeze({
    kind,
    at,
    count,
    delta,
    broadScanCount: Number(diagnostics?.broadScanCount ?? 0),
    focusedScanCount: Number(diagnostics?.focusedScanCount ?? 0),
    broadCandidateCount: Array.isArray(diagnostics?.broadCandidateSymbols)
      ? diagnostics.broadCandidateSymbols.length
      : null,
  });
}

function appendBounded(rows, value, max = 64) {
  return Object.freeze([...rows, value].slice(-max));
}

function resultLocks() {
  return {
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    remediationAllowed: false,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
  };
}

export function observeUnderFiveCadence(previousState = createCadenceVerifierState(), input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new TypeError("invalid_now");

  const diagnostics = input?.diagnostics ?? {};
  const health = input?.health ?? {};
  const pm2 = Array.isArray(input?.pm2) ? input.pm2 : [];
  const marketOpen = health?.stream?.marketOpen === true;
  const currentSymbols = normalizeSymbols(diagnostics?.broadCandidateSymbols);

  const violations = [];
  if (diagnostics?.version !== EXPECTED_CACHE_VERSION) violations.push("CACHE_VERSION_MISMATCH");
  if (Number(diagnostics?.broadIntervalSec) !== EXPECTED_BROAD_INTERVAL_SEC) violations.push("BROAD_INTERVAL_MISMATCH");
  if (Number(diagnostics?.focusedIntervalSec) !== EXPECTED_FOCUSED_INTERVAL_SEC) violations.push("FOCUSED_INTERVAL_MISMATCH");
  if (diagnostics?.lastError) violations.push("CACHE_LAST_ERROR");
  if (health?.status !== "ok" || health?.degraded === true || (Array.isArray(health?.issues) && health.issues.length)) {
    violations.push("HEALTH_UNHEALTHY");
  }

  const processMap = new Map(pm2.map((row) => [String(row?.name ?? ""), String(row?.status ?? "")]));
  if (processMap.get("gemini-scanner") !== "online") violations.push("SCANNER_NOT_ONLINE");

  const broadCount = finite(diagnostics?.broadScanCount) ? Number(diagnostics.broadScanCount) : 0;
  const focusedCount = finite(diagnostics?.focusedScanCount) ? Number(diagnostics.focusedScanCount) : 0;

  if (!marketOpen) {
    const combined = Object.freeze([...new Set(violations)].sort());
    return Object.freeze({
      version: VERSION,
      generatedAt: now.toISOString(),
      status: combined.length ? "fail" : "waiting_for_market_open",
      pass: false,
      terminal: combined.length > 0,
      marketOpen: false,
      evidence: Object.freeze({
        observationSec: 0,
        broadObserved: 0,
        focusedObserved: 0,
        broadScanCount: broadCount,
        focusedScanCount: focusedCount,
        lastBroadScanAt: diagnostics?.lastBroadScanAt ?? null,
        broadCandidateCount: currentSymbols.length,
        broadIntervalSec: Number(diagnostics?.broadIntervalSec ?? 0),
        focusedIntervalSec: Number(diagnostics?.focusedIntervalSec ?? 0),
        focusedEvidenceRequired: false,
      }),
      violations: combined,
      state: createCadenceVerifierState(),
      ...resultLocks(),
    });
  }

  const firstOpen = previousState?.marketWasOpen !== true;
  const previousBroad = firstOpen || !finite(previousState?.lastBroadScanCount)
    ? broadCount : Number(previousState.lastBroadScanCount);
  const previousFocused = firstOpen || !finite(previousState?.lastFocusedScanCount)
    ? focusedCount : Number(previousState.lastFocusedScanCount);
  const broadDelta = Math.max(0, broadCount - previousBroad);
  const focusedDelta = Math.max(0, focusedCount - previousFocused);

  let broadEvents = firstOpen ? Object.freeze([]) : (previousState?.broadEvents ?? Object.freeze([]));
  let focusedEvents = firstOpen ? Object.freeze([]) : (previousState?.focusedEvents ?? Object.freeze([]));
  let cohort = firstOpen ? currentSymbols : normalizeSymbols(previousState?.broadCandidateSymbols);
  const sessionViolations = firstOpen ? [...violations] : [...(previousState?.violations ?? []), ...violations];

  const lastBroadMs = isoMs(diagnostics?.lastBroadScanAt);
  const priorBroadMs = firstOpen ? lastBroadMs : isoMs(previousState?.lastBroadScanAt);
  if (broadDelta > 1) sessionViolations.push("BROAD_SCAN_BURST");
  if (broadDelta > 0 && priorBroadMs !== null && lastBroadMs !== null) {
    const gapSec = (lastBroadMs - priorBroadMs) / 1000;
    const toleranceSec = Number(options.broadToleranceSec ?? 30);
    if (gapSec < EXPECTED_BROAD_INTERVAL_SEC - toleranceSec) sessionViolations.push("BROAD_SCAN_TOO_FREQUENT");
  }

  let lastFocusedProgressAt = firstOpen
    ? (currentSymbols.length > 0 ? now.toISOString() : null)
    : (previousState?.lastFocusedProgressAt ?? null);

  if (broadDelta > 0) {
    broadEvents = appendBounded(broadEvents, event("broad", now.toISOString(), broadCount, broadDelta, diagnostics));
    cohort = currentSymbols;
    lastFocusedProgressAt = cohort.length > 0 ? now.toISOString() : null;
  } else if (focusedDelta > 0 && !sameSymbols(currentSymbols, cohort)) {
    sessionViolations.push("FOCUSED_COHORT_MUTATED");
  }
  if (focusedDelta > 0) {
    focusedEvents = appendBounded(focusedEvents, event("focused", now.toISOString(), focusedCount, focusedDelta, diagnostics));
    lastFocusedProgressAt = now.toISOString();
  }

  const startedAt = firstOpen ? now.toISOString() : (previousState?.startedAt ?? now.toISOString());
  const startMs = isoMs(startedAt) ?? now.getTime();
  const observationSec = Math.max(0, (now.getTime() - startMs) / 1000);
  const focusedProgressMs = isoMs(lastFocusedProgressAt);
  const elapsedSinceFocusedProgressSec = focusedProgressMs === null
    ? 0
    : Math.max(0, (now.getTime() - focusedProgressMs) / 1000);

  if (
    !firstOpen &&
    cohort.length > 0 &&
    broadDelta === 0 &&
    focusedDelta === 0 &&
    elapsedSinceFocusedProgressSec >= Number(options.focusedStallSec ?? 45)
  ) {
    sessionViolations.push("FOCUSED_SCAN_STALLED");
  }

  const combined = Object.freeze([...new Set(sessionViolations)].sort());
  const broadObserved = broadEvents.length;
  const focusedObserved = focusedEvents.length;
  const focusedEvidenceRequired = cohort.length > 0;
  const broadCycleObserved =
    observationSec >= Number(options.minimumObservationSec ?? 300) &&
    broadObserved >= 1;
  const enoughEvidence =
    broadCycleObserved &&
    focusedEvidenceRequired &&
    focusedObserved >= Number(options.minimumFocusedEvents ?? 3);

  const status = combined.length
    ? "fail"
    : enoughEvidence
      ? "pass"
      : broadCycleObserved && !focusedEvidenceRequired
        ? "insufficient_focused_evidence"
        : "collecting";

  const state = Object.freeze({
    marketWasOpen: true,
    startedAt,
    lastObservedAt: now.toISOString(),
    lastFocusedProgressAt,
    lastBroadScanCount: broadCount,
    lastFocusedScanCount: focusedCount,
    lastBroadScanAt: diagnostics?.lastBroadScanAt ?? previousState?.lastBroadScanAt ?? null,
    broadCandidateSymbols: cohort,
    broadEvents,
    focusedEvents,
    violations: combined,
  });

  return Object.freeze({
    version: VERSION,
    generatedAt: now.toISOString(),
    status,
    pass: status === "pass",
    terminal: status === "pass" || status === "fail",
    marketOpen: true,
    evidence: Object.freeze({
      observationSec,
      broadObserved,
      focusedObserved,
      broadScanCount: broadCount,
      focusedScanCount: focusedCount,
      lastBroadScanAt: diagnostics?.lastBroadScanAt ?? null,
      broadCandidateCount: currentSymbols.length,
      broadIntervalSec: Number(diagnostics?.broadIntervalSec ?? 0),
      focusedIntervalSec: Number(diagnostics?.focusedIntervalSec ?? 0),
      focusedEvidenceRequired,
    }),
    violations: combined,
    state,
    ...resultLocks(),
  });
}

export default Object.freeze({
  VERSION,
  createCadenceVerifierState,
  observeUnderFiveCadence,
});
