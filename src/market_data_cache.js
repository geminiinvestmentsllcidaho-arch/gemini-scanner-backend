/**
 * In-memory market data cache (NO persistence)
 * Used by scanner + live coaching
 */

export const marketData = {
  quotes: new Map(), // symbol -> { t, bp, bs, ap, as }
  bars: new Map(),   // symbol -> { t, o, h, l, c, v, vw }
};

export function updateQuote(symbol, q) {
  marketData.quotes.set(symbol, q);
}

export function updateBar(symbol, b) {
  marketData.bars.set(symbol, b);
}

export function getLatestQuote(symbol) {
  return marketData.quotes.get(symbol) || null;
}

export function getLatestBar(symbol) {
  return marketData.bars.get(symbol) || null;
}
