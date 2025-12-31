import { marketData, getLatestQuote, getLatestBar } from '../market_data_cache.js';

export function marketDataDump(req, res) {
  let symbols = [];

  if (req.query.symbols) {
    symbols = String(req.query.symbols)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
  } else {
    // auto-enumerate from cache
    const q = Array.from(marketData.quotes.keys());
    const b = Array.from(marketData.bars.keys());
    symbols = Array.from(new Set([...q, ...b])).sort();
  }

  const out = symbols.map(S => ({
    symbol: S,
    quote: getLatestQuote(S),
    bar: getLatestBar(S),
  }));

  res.json({ ok: true, symbols, data: out, ts: new Date().toISOString() });
}
