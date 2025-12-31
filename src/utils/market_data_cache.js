/**
 * In-memory market data cache (NO persistence)
 * Used by scanner + live coaching
 */

const marketDataInternal = {
  quotes: new Map(),
  bars: new Map(),
};

export const marketData = marketDataInternal;

export function updateQuote(symbol, q) {
  marketDataInternal.quotes.set(symbol, q);
}

export function updateBar(symbol, b) {
  marketDataInternal.bars.set(symbol, b);
}

export function getLatestQuote(symbol) {
  return marketDataInternal.quotes.get(symbol) || null;
}

export function getLatestBar(symbol) {
  return marketDataInternal.bars.get(symbol) || null;
}

// --------------------
// Market-closed heartbeat filler
// --------------------
export function fillClosedMarketHeartbeat(symbols) {
  const now = Date.now();
  symbols.forEach(s => {
    if (!marketDataInternal.quotes.has(s)) {
      marketDataInternal.quotes.set(s, { t: now, bp: null, bs: null, ap: null, as: null });
    }
    if (!marketDataInternal.bars.has(s)) {
      marketDataInternal.bars.set(s, { t: now, o: null, h: null, l: null, c: null, v: null, vw: null });
    }
  });
}
