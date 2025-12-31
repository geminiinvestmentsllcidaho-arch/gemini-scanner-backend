import { marketData, getLatestQuote, getLatestBar, fillClosedMarketHeartbeat } from './market_data_cache.js';

// Helper: parse symbols from environment
function parseSymbolsEnv(v) {
  if (!v) return null;
  const out = v
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return out.length ? Array.from(new Set(out)) : null;
}

export function marketDataDump(req, res) {
  let symbols = [];

  if (req.query.symbols) {
    symbols = String(req.query.symbols)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
  } else {
    // ------------------------
    // Fill heartbeat for off-hours
    // ------------------------
    const heartbeatSymbols = parseSymbolsEnv(process.env.ALPACA_SYMBOLS) || [];
    fillClosedMarketHeartbeat(heartbeatSymbols);

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
