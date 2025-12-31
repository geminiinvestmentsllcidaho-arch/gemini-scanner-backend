import 'dotenv/config';
import WebSocket from 'ws';
import { updateQuote, updateBar } from './market_data_cache.js';

const KEY = process.env.ALPACA_KEY;
const SECRET = process.env.ALPACA_SECRET;
const FEED = (process.env.ALPACA_DATA_FEED || 'iex').toLowerCase();

if (!KEY || !SECRET) throw new Error('Missing ALPACA_KEY / ALPACA_SECRET in .env');

const WS_URL = `wss://stream.data.alpaca.markets/v2/${FEED}`;
const CLOCK_URL = 'https://paper-api.alpaca.markets/v2/clock';

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

function parseSymbolsEnv(v) {
  if (!v) return null;
  const out = v
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return out.length ? Array.from(new Set(out)) : null;
}

export async function startMarketDataStream({ symbols = ['AAPL'] } = {}) {
  const envSymbols = parseSymbolsEnv(process.env.ALPACA_SYMBOLS);
  if (envSymbols) symbols = envSymbols;

  const open = await isMarketOpen();
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
          const sub = { action: 'subscribe', quotes: symbols };
          if (open) sub.bars = symbols;
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
