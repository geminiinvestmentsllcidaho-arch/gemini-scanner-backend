import {
  storePaperTradePositionState
} from './paper_trade_position_state_store.mjs';

export const PAPER_TRADE_POSITION_STATE_AUTO_REFRESH_VERSION =
  'paper_trade_position_state_auto_refresh_v1';

export const DEFAULT_PAPER_TRADE_POSITION_STATE_REFRESH_INTERVAL_MS = 60_000;

function normalizeIntervalMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return DEFAULT_PAPER_TRADE_POSITION_STATE_REFRESH_INTERVAL_MS;
  }
  return Math.floor(parsed);
}

export function createPaperTradePositionStateAutoRefresh(options = {}) {
  const intervalMs = normalizeIntervalMs(
    options.intervalMs ??
      process.env.PAPER_TRADE_POSITION_STATE_REFRESH_INTERVAL_MS
  );
  const refresh =
    typeof options.refresh === 'function'
      ? options.refresh
      : () => storePaperTradePositionState();

  let timer = null;
  let running = false;
  let refreshCount = 0;
  let writeCount = 0;
  let unchangedCount = 0;
  let lastRefreshAt = null;
  let lastStatus = 'idle';
  let lastError = null;

  function runOnce() {
    try {
      const result = refresh();
      refreshCount += 1;
      lastRefreshAt = new Date().toISOString();
      lastStatus = result?.status ?? 'unknown';
      lastError = null;
      if (result?.wroteRecord === true) writeCount += 1;
      if (result?.unchanged === true) unchangedCount += 1;
      return result;
    } catch (error) {
      refreshCount += 1;
      lastRefreshAt = new Date().toISOString();
      lastStatus = 'error';
      lastError = error?.message ?? String(error);
      return {
        ok: false,
        status: 'error',
        error: lastError
      };
    }
  }

  function start() {
    if (running) return diagnostics();
    running = true;
    runOnce();
    timer = setInterval(runOnce, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    return diagnostics();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
    return diagnostics();
  }

  function diagnostics() {
    return {
      ok: true,
      version: PAPER_TRADE_POSITION_STATE_AUTO_REFRESH_VERSION,
      monitorOnly: true,
      previewOnly: true,
      paperOnly: true,
      running,
      intervalMs,
      refreshCount,
      writeCount,
      unchangedCount,
      lastRefreshAt,
      lastStatus,
      lastError,
      safety: {
        orderPlacement: false,
        liveTrading: false,
        autoTrading: false,
        brokerExecution: false,
        accountMutation: false,
        brokerContact: false,
        localJsonlOnly: true
      }
    };
  }

  return {
    start,
    stop,
    runOnce,
    diagnostics
  };
}
