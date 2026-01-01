/**
 * In-memory market data cache (NO persistence)
 * Used by scanner + live coaching
 */

const MAX_BARS_PER_SYMBOL = Number(process.env.MAX_BARS_PER_SYMBOL || 500);

export const marketData = {
  quotes: new Map(), // symbol -> { t, bp, bs, ap, as }
  bars: new Map(),   // symbol -> array of bars [{ t, o, h, l, c, v, vw }, ...]
};

export function updateQuote(symbol, q) {
  marketData.quotes.set(symbol, q);
}

export function updateBar(symbol, b) {
  if (!symbol || !b) return;

  // Ignore pure-null heartbeat placeholders
  const hasRealClose = typeof b.c === 'number' || typeof b.close === 'number';
  if (!hasRealClose) {
    // Only seed placeholder if we have no bars at all
    if (!marketData.bars.has(symbol)) marketData.bars.set(symbol, []);
    return;
  }

  const bar = {
    t: b.t,
    o: b.o ?? b.open,
    h: b.h ?? b.high,
    l: b.l ?? b.low,
    c: b.c ?? b.close,
    v: b.v ?? b.volume,
    vw: b.vw,
  };

  const arr = marketData.bars.get(symbol) || [];
  arr.push(bar);

  // keep only the most recent N
  if (arr.length > MAX_BARS_PER_SYMBOL) {
    arr.splice(0, arr.length - MAX_BARS_PER_SYMBOL);
  }

  marketData.bars.set(symbol, arr);
}

export function getLatestQuote(symbol) {
  return marketData.quotes.get(symbol) || null;
}

export function getBars(symbol) {
  return marketData.bars.get(symbol) || [];
}

export function getLatestBar(symbol) {
  const arr = marketData.bars.get(symbol);
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}

/**
 * Fill heartbeat ONLY for symbols that have NO data yet.
 * Must never clobber real quotes or bars.
 */
export function fillClosedMarketHeartbeat(symbols = []) {
  const now = Date.now();

  for (const S of symbols) {
    if (!marketData.quotes.has(S)) {
      marketData.quotes.set(S, { t: now, bp: null, bs: null, ap: null, as: null });
    }
    if (!marketData.bars.has(S)) {
      marketData.bars.set(S, []); // empty history until real bars arrive/backfill runs
    }
  }
}
