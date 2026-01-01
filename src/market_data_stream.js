import 'dotenv/config';
import WebSocket from 'ws';
import { updateQuote, updateBar } from './market_data_cache.js';

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

// Off-hours seed: fetch recent 1Min bars so RSI can compute.
async function backfillBars({ symbol, limit = 200 }) {
  // We use a wide window so holidays/weekends still return the most recent session if available.
  // Alpaca requires explicit feed sometimes; we pass feed=${FEED}.
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // last 7 days

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

  // Push into cache oldest->newest
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

export async function startMarketDataStream({ symbols = ['AAPL'] } = {}) {
  const envSymbols = parseSymbolsEnv(process.env.ALPACA_SYMBOLS);
  if (envSymbols) symbols = envSymbols;

  const open = await isMarketOpen();

  // If market is closed, seed bars via REST so RSI works off-hours
  if (!open) {
    try {
      for (const s of symbols) {
        const n = await backfillBars({ symbol: s, limit: 300 });
        console.log('[md] backfilled bars', { symbol: s, count: n });
      }
    } catch (e) {
      console.log('[md] backfill error', String(e?.message || e));
    }
  }

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('[md] ws open', WS_URL);
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
        updateQuote(m.S, { t: m.t, bp: m.bp, bs: m.bs, ap: m.ap, as: m.as });
        continue;
      }

      if (m.T === 'b' && m.S) {
        updateBar(m.S, { t: m.t, o: m.o, h: m.h, l: m.l, c: m.c, v: m.v, vw: m.vw });
        continue;
      }
    }
  });

  ws.on('close', (code, reason) => console.log('[md] ws closed', { code, reason: reason?.toString?.() }));
  ws.on('error', (err) => console.error('[md] ws error', err));

  return { ws, open };
}
