import 'dotenv/config';
import WebSocket from 'ws';

const KEY = process.env.ALPACA_KEY;
const SECRET = process.env.ALPACA_SECRET;
const FEED = (process.env.ALPACA_DATA_FEED || 'iex').toLowerCase();

if (!KEY || !SECRET) {
  console.error('Missing ALPACA_KEY / ALPACA_SECRET in .env');
  process.exit(1);
}

const url = 'wss://stream.data.alpaca.markets/v2/' + FEED;
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('[ws] open', url);

  ws.send(JSON.stringify({
    action: 'auth',
    key: KEY,
    secret: SECRET
  }));
});

ws.on('message', (raw) => {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch (e) {
    console.log('[ws] non-json message:', raw.toString());
    return;
  }

  for (const m of msg) {
    // auth + status messages
    if (m.T === 'success' || m.T === 'error' || m.T === 'subscription') {
      console.log('[ws]', m);
      if (m.T === 'success' && m.msg === 'authenticated') {
        ws.send(JSON.stringify({
          action: 'subscribe',
          bars: ['AAPL']
        }));
      }
      continue;
    }

    // bar messages (v2)
    if (m.T === 'b' && m.S === 'AAPL') {
      console.log('[bar]', {
        S: m.S,
        t: m.t,
        o: m.o,
        h: m.h,
        l: m.l,
        c: m.c,
        v: m.v,
        vw: m.vw
      });
      continue;
    }

    // anything else
    console.log('[ws]', m);
  }
});

ws.on('close', (code, reason) => {
  console.log('[ws] closed', { code, reason: reason?.toString?.() });
});

ws.on('error', (err) => {
  console.error('[ws] error', err);
});
