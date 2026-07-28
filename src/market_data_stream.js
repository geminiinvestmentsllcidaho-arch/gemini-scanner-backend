import { installAlpacaRequestAudit } from "./utils/alpaca_request_audit.mjs";
installAlpacaRequestAudit();
import 'dotenv/config';
import WebSocket from 'ws';
import { updateQuote, updateBar } from './market_data_cache.js';

import {
  markStreamConnected,
  markStreamEvent,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  incrementWatchdogTriggers,
} from './utils/stream_telemetry.js';

const KEY = process.env.ALPACA_KEY;
const SECRET = process.env.ALPACA_SECRET;
const FEED = (process.env.ALPACA_DATA_FEED || 'iex').toLowerCase();

if (!KEY || !SECRET) throw new Error('Missing ALPACA_KEY / ALPACA_SECRET in .env');

const WS_URL = `wss://stream.data.alpaca.markets/v2/${FEED}`;
const CLOCK_URL = 'https://paper-api.alpaca.markets/v2/clock';

function parseSymbolsEnv(v) {
  if (!v) return null;
  const out = v
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return out.length ? Array.from(new Set(out)) : null;
}

export function shouldEnforceStreamFreshness(nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (values.weekday === 'Sat' || values.weekday === 'Sun') return false;

  // Quote/bar inactivity is only actionable during the regular US equity session.
  // Outside 09:30-16:00 ET, an authenticated and subscribed Alpaca socket may
  // legitimately remain quiet. Real close/error events still reconnect normally.
  const minutes = (Number(values.hour) * 60) + Number(values.minute);
  return minutes >= 570 && minutes < 960;
}

export function shouldReconnectStaleStream({
  nowMs = Date.now(),
  lastRxTsMs,
  staleThresholdSec,
} = {}) {
  if (!shouldEnforceStreamFreshness(nowMs)) return false;
  if (!Number.isFinite(lastRxTsMs)) return false;
  if (!Number.isFinite(staleThresholdSec) || staleThresholdSec < 0) return false;
  return Math.floor((nowMs - lastRxTsMs) / 1000) > staleThresholdSec;
}

async function isMarketOpen() {
  const res = await fetch(CLOCK_URL, {
    headers: {
      'APCA-API-KEY-ID': KEY,
      'APCA-API-SECRET-KEY': SECRET,
    },
  });
  if (!res.ok) throw new Error(`clock HTTP ${res.status}`);
  const j = await res.json();
  return !!j.is_open;
}

async function backfillBars({ symbol, limit = 200 }) {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  const qs = new URLSearchParams({
    timeframe: '1Min',
    start: start.toISOString(),
    end: end.toISOString(),
    limit: String(limit),
    feed: FEED,
  });

  const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?${qs.toString()}`;

  const res = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': KEY,
      'APCA-API-SECRET-KEY': SECRET,
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`bars HTTP ${res.status} ${txt.slice(0, 120)}`);
  }

  const j = await res.json();
  const bars = Array.isArray(j?.bars) ? j.bars : [];

  for (const b of bars) {
    updateBar(symbol, {
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
      vw: b.vw,
    });
  }

  return bars.length;
}

export async function startMarketDataStream({ symbols = ['AAPL'], runtime = {} } = {}) {
  const WebSocketImpl = runtime.WebSocketImpl || WebSocket;
  const nowFn = runtime.nowFn || Date.now;
  const setTimeoutFn = runtime.setTimeoutFn || setTimeout;
  const clearTimeoutFn = runtime.clearTimeoutFn || clearTimeout;
  const setIntervalFn = runtime.setIntervalFn || setInterval;
  const clearIntervalFn = runtime.clearIntervalFn || clearInterval;
  const envSymbols = parseSymbolsEnv(process.env.ALPACA_SYMBOLS);
  if (envSymbols) symbols = envSymbols;

  const open = runtime.skipInitialFetches ? false : await isMarketOpen();

  if (!runtime.skipInitialFetches) {
    try {
      for (const s of symbols) {
        const backfillLimit = Number(process.env.ALPACA_BACKFILL_LIMIT || 3000);
        const n = await backfillBars({ symbol: s, limit: backfillLimit });
        console.log('[md] backfilled bars', { symbol: s, count: n, marketOpen: open });
      }
    } catch (e) {
      console.log('[md] backfill error', String(e?.message || e), { marketOpen: open });
    }
  }

  let ws = null;
  let reconnectTimer = null;
  let watchdogTimer = null;
  let closedManually = false;

  // Internal rx clock (NOT exposed, no schema changes). Used only for watchdog.
  let lastRxTsMs = null;

  const staleThresholdSec = Number(process.env.STREAM_STALE_THRESHOLD_SEC || 30);
  const watchdogEveryMs = 5000;

  function computeBackoffDelay(attempt) {
    const base = 1000;
    const max = 30000;
    const delay = base * Math.pow(2, attempt - 1);
    return Math.min(delay, max);
  }

  function scheduleReconnect() {
    if (closedManually) return;
    if (reconnectTimer) return; // ensure single scheduled reconnect

    const attempt = incrementReconnectAttempts();
    const delay = computeBackoffDelay(attempt);

    console.log('[md] reconnect scheduled', { attempt, delay });

    reconnectTimer = setTimeoutFn(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (reconnectTimer) {
      clearTimeoutFn(reconnectTimer);
      reconnectTimer = null;
    }

    ws = new WebSocketImpl(WS_URL);

    ws.on('open', () => {
      console.log('[md] ws open', WS_URL);
      markStreamConnected(true);
      resetReconnectAttempts();

      // Start watchdog clock at connect time so "no data after connect" is detectable
      lastRxTsMs = nowFn();

      ws.send(JSON.stringify({ action: 'auth', key: KEY, secret: SECRET }));
    });

    ws.on('message', (raw) => {
      let arr;
      try { arr = JSON.parse(raw.toString()); }
      catch { console.log('[md] non-json:', raw.toString()); return; }

      for (const m of arr) {
        if (m.T === 'success' || m.T === 'error' || m.T === 'subscription') {
          console.log('[md]', m);
          if (m.T === 'success' && m.msg === 'authenticated') {
            const sub = { action: 'subscribe', quotes: symbols, bars: symbols };
            ws.send(JSON.stringify(sub));
            console.log('[md] subscribed', sub);
          }
          continue;
        }

        if (m.T === 'q' && m.S) {
          const ts = Date.parse(m.t);
          lastRxTsMs = Number.isFinite(ts) ? ts : nowFn();
          markStreamEvent(ts);

          updateQuote(m.S, { t: m.t, bp: m.bp, bs: m.bs, ap: m.ap, as: m.as });
          continue;
        }

        if (m.T === 'b' && m.S) {
          const ts = Date.parse(m.t);
          lastRxTsMs = Number.isFinite(ts) ? ts : nowFn();
          markStreamEvent(ts);

          updateBar(m.S, { t: m.t, o: m.o, h: m.h, l: m.l, c: m.c, v: m.v, vw: m.vw });
          continue;
        }
      }
    });

    ws.on('close', (code, reason) => {
      markStreamConnected(false);
      console.log('[md] ws closed', { code, reason: reason?.toString?.() });
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.error('[md] ws error', err);
      try { ws.close(); } catch {}
      // close handler will schedule reconnect
    });
  }

  // Start connection
  connect();

  // Stale watchdog: if socket is OPEN but no rx for threshold, force reconnect.
  watchdogTimer = setIntervalFn(() => {
    if (closedManually) return;
    if (!ws) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    const nowMs = nowFn();
    if (!shouldReconnectStaleStream({ nowMs, lastRxTsMs, staleThresholdSec })) return;

    const ageSec = Math.floor((nowMs - lastRxTsMs) / 1000);
    incrementWatchdogTriggers();

    console.log('[md] watchdog stale -> reconnect', { ageSec, staleThresholdSec });
    try { ws.terminate(); } catch {
      try { ws.close(); } catch {}
    }
    // close handler schedules reconnect
  }, watchdogEveryMs);

  return {
    get ws() {
      return ws;
    },
    open,
    stop() {
      closedManually = true;
      if (reconnectTimer) clearTimeoutFn(reconnectTimer);
      if (watchdogTimer) clearIntervalFn(watchdogTimer);
      if (ws) ws.close();
    },
  };
}
