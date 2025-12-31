import { getLatestQuote, getLatestBar } from '../market_data_cache.js';

export function marketDataDump(req, res) {
  const symbolsParam = String(req.query.symbols || 'AAPL');
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  const out = symbols.map((S) => ({
    symbol: S,
    quote: getLatestQuote(S),
    bar: getLatestBar(S),
  }));

  res.json({ ok: true, symbols, data: out, ts: new Date().toISOString() });
}
