import 'dotenv/config';
import WebSocket from 'ws';

const KEY = process.env.ALPACA_KEY;
const SECRET = process.env.ALPACA_SECRET;
const FEED = (process.env.ALPACA_DATA_FEED || 'iex').toLowerCase();

// Symbols to cache for heartbeat / off-hours
const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'SPY'];

if (!KEY || !SECRET) {
  console.error('Missing ALPACA_KEY / ALPACA_SECRET in .env');
  process.exit(1);
}

const url = `wss://stream.data.alpaca.markets/v2/${FEED}`;
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('[ws] open', url);
  ws.send(JSON.stringify({ action: 'auth', key: KEY, secret: SECRET }));
});

ws.on('message', (raw) => {
  let arr;
  try {
    arr = JSON.parse(raw.toString());
  } catch {
    console.log('[ws] non-json:', raw.toString());
    return;
  }

  for (const m of arr) {
    // Control messages
    if (m.T === 'success' || m.T === 'error' || m.T === 'subscription') {
      console.log('[ws]', m);

      // Once authenticated, subscribe to QUOTES + BARS
      if (m.T === 'success' && m.msg === 'authenticated') {
        ws.send(JSON.stringify({
          action: 'subscribe',
          quotes: SYMBOLS,
          bars: SYMBOLS
        }));
      }
      continue;
    }

    // Quote messages
    if (m.T === 'q' && SYMBOLS.includes(m.S)) {
      console.log('[quote]', {
        S: m.S,
        t: m.t,
        bp: m.bp,
        bs: m.bs,
        ap: m.ap,
        as: m.as
      });
      continue;
    }

    // Bar messages (THIS is what RSI needs)
    if (m.T === 'b' && SYMBOLS.includes(m.S)) {
      console.log('[bar]', {
        S: m.S,
        t: m.t,
        o: m.o,
        h: m.h,
        l: m.l,
        c: m.c,
        v: m.v
      });
      continue;
    }
  }
});

ws.on('close', (code, reason) =>
  console.log('[ws] closed', { code, reason: reason?.toString?.() })
);

ws.on('error', (err) => console.error('[ws] error', err));
