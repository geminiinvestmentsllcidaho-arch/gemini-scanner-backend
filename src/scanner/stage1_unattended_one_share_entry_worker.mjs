import { runStage1UnattendedEntry } from "./stage1_unattended_one_share_entry_controller.mjs";
import { readStage1UnattendedAttemptLatch, writeStage1UnattendedAttemptLatch } from "./stage1_unattended_one_share_attempt_latch.mjs";

export const VERSION = "stage1_unattended_one_share_entry_worker_v1";

const clean = (value) => String(value ?? "").trim();
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

function candidateState(candidate = {}) {
  return String(candidate.state ?? candidate.resultState ?? candidate.decision ?? "").trim().toUpperCase();
}

function candidateScore(candidate = {}) {
  return finite(candidate.score ?? candidate.readonlyPotentialScore);
}

function candidateSpread(candidate = {}) {
  return finite(candidate.spreadPct ?? candidate.spreadPercent);
}

function chooseCandidate(snapshot = {}) {
  const candidates = Array.isArray(snapshot.candidates) ? snapshot.candidates : [];
  return candidates
    .filter((candidate) => candidateState(candidate) === "ENTER")
    .filter((candidate) => candidate.buyRecommendation === true)
    .filter((candidate) => candidate.blocked !== true)
    .filter((candidate) => !Array.isArray(candidate.blockers) || candidate.blockers.length === 0)
    .sort((a, b) => {
      const scoreDelta = (candidateScore(b) ?? -Infinity) - (candidateScore(a) ?? -Infinity);
      if (scoreDelta !== 0) return scoreDelta;
      const spreadDelta = (candidateSpread(a) ?? Infinity) - (candidateSpread(b) ?? Infinity);
      if (spreadDelta !== 0) return spreadDelta;
      return clean(a.symbol).localeCompare(clean(b.symbol));
    })[0] ?? null;
}

export function createStage1UnattendedOneShareEntryWorker({
  getScanSnapshot,
  fetchAccountSnapshot,
  adapter,
  now = () => Date.now(),
  intervalMs = 15000,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
  readAttemptLatch = readStage1UnattendedAttemptLatch,
  writeAttemptLatch = writeStage1UnattendedAttemptLatch,
  attemptLatchPath,
  env = process.env,
} = {}) {
  let timer = null;
  let running = false;
  let inFlight = false;
  let attemptConsumed = false;
  let lastResult = null;
  let lastError = null;
  let cycles = 0;

  const enabled = () => String(env.STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED ?? "").trim() === "1";
  const idempotencyKey = () => clean(env.STAGE1_UNATTENDED_IDEMPOTENCY_KEY);
  const latchPath = () => clean(attemptLatchPath ?? env.STAGE1_UNATTENDED_ATTEMPT_LATCH_PATH);

  const diagnostics = () => Object.freeze({
    version: VERSION,
    enabled: enabled(),
    running,
    timerScheduled: timer !== null,
    inFlight,
    attemptConsumed,
    cycles,
    lastResult,
    lastError,
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      oneShareOnly: true,
      oneShotOnly: true,
      retryAllowed: false,
      disabledByDefault: true,
    }),
  });

  const runOnce = async () => {
    if (inFlight) return diagnostics();
    if (!enabled()) {
      lastResult = Object.freeze({ status: "DISABLED_BY_ENV", ready: false, orderSubmitted: false });
      return diagnostics();
    }
    if (attemptConsumed) {
      lastResult = Object.freeze({ status: "ONE_SHOT_ALREADY_CONSUMED", ready: false, orderSubmitted: false });
      return diagnostics();
    }
    if (!latchPath() || typeof readAttemptLatch !== "function" || typeof writeAttemptLatch !== "function") {
      lastResult = Object.freeze({ status: "BLOCKED_DURABLE_LATCH_REQUIRED", ready: false, orderSubmitted: false });
      return diagnostics();
    }
    const persistedLatch = readAttemptLatch(latchPath());
    if (persistedLatch?.consumed === true || persistedLatch?.ok !== true) {
      attemptConsumed = true;
      lastResult = Object.freeze({ status: persistedLatch?.blocker ?? "ONE_SHOT_ALREADY_CONSUMED", ready: false, orderSubmitted: false });
      return diagnostics();
    }
    if (typeof getScanSnapshot !== "function" || typeof fetchAccountSnapshot !== "function") {
      lastResult = Object.freeze({ status: "BLOCKED_MISSING_READONLY_DEPENDENCY", ready: false, orderSubmitted: false });
      return diagnostics();
    }

    inFlight = true;
    cycles += 1;
    try {
      const [snapshot, account] = await Promise.all([
        getScanSnapshot(),
        fetchAccountSnapshot(),
      ]);
      const candidate = chooseCandidate(snapshot);
      const observedAtMs = Date.parse(String(account?.observedAt ?? ""));
      const accountAgeSec = Number.isFinite(observedAtMs)
        ? Math.max(0, (Number(now()) - observedAtMs) / 1000)
        : Infinity;
      const clockTsMs = Date.parse(String(snapshot?.marketClock?.timestamp ?? snapshot?.sharedCache?.clockCheckedAt ?? ""));
      const clockAgeSec = Number.isFinite(clockTsMs)
        ? Math.max(0, (Number(now()) - clockTsMs) / 1000)
        : Infinity;

      const input = {
        armed: true,
        paperAccountConfirmed: account?.status === "connected_readonly" && account?.runtime?.paperOnly === true,
        liveTradingDisabled: true,
        marketOpen: snapshot?.marketClock?.isOpen === true,
        marketClockFresh: clockAgeSec <= 180,
        marketDataFresh: snapshot?.ok !== false && candidate !== null,
        accountSnapshotFresh: accountAgeSec <= 60,
        zeroPositions: Array.isArray(account?.positions) && account.positions.length === 0,
        zeroOpenOrders: Array.isArray(account?.openOrders) && account.openOrders.length === 0,
        killSwitchHealthy: env.STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY === "1",
        idempotencyReady: Boolean(idempotencyKey()),
        idempotencyKey: idempotencyKey(),
        stopAfterSingleAttempt: true,
        maxSpreadPct: finite(env.STAGE1_UNATTENDED_MAX_SPREAD_PCT) ?? 1,
        maxSourceAgeSec: finite(env.STAGE1_UNATTENDED_MAX_SOURCE_AGE_SEC) ?? 30,
        minScore: finite(env.STAGE1_UNATTENDED_MIN_SCORE) ?? 70,
        candidate,
      };

      const result = await runStage1UnattendedEntry(input, { adapter });
      lastResult = result;
      if (result.adapterInvoked === true) {
        writeAttemptLatch(latchPath(), {
          idempotencyKey: idempotencyKey(),
          symbol: result.order?.symbol,
          attemptedAt: new Date(Number(now())).toISOString(),
          adapterInvoked: true,
          networkAttempted: result.networkAttempted === true,
          orderSubmitAttempted: result.orderSubmitAttempted === true,
          orderSubmitted: result.orderSubmitted === true,
        });
        attemptConsumed = true;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
      lastResult = Object.freeze({ status: "WORKER_ERROR", ready: false, orderSubmitted: false });
    } finally {
      inFlight = false;
    }
    return diagnostics();
  };

  const start = () => {
    if (running) return diagnostics();
    running = true;
    if (typeof setIntervalImpl === "function") {
      timer = setIntervalImpl(() => {
        runOnce().catch((error) => {
          lastError = error?.message ?? String(error);
        });
      }, Math.max(1000, Number(intervalMs) || 15000));
    }
    return diagnostics();
  };

  const stop = () => {
    running = false;
    if (timer !== null && typeof clearIntervalImpl === "function") clearIntervalImpl(timer);
    timer = null;
    return diagnostics();
  };

  return Object.freeze({ start, stop, runOnce, diagnostics });
}

export default { VERSION, createStage1UnattendedOneShareEntryWorker };
