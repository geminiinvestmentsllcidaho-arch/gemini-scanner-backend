import { getLatestQuote, getLatestBar } from '../market_data_cache.js';

export function buildLiveSnapshot(symbol, fallback = {}) {
  const quote = getLatestQuote(symbol);
  const bar = getLatestBar(symbol);

  const snapshot = { ...fallback };

  if (quote) {
    snapshot.quote = quote;
    // mid-price convenience
    if (typeof quote.bp === 'number' && typeof quote.ap === 'number') {
      snapshot.price = (quote.bp + quote.ap) / 2;
    }
  }

  if (bar) {
    snapshot.bar = bar;
    snapshot.price = typeof bar.c === 'number' ? bar.c : snapshot.price;
  }

  return snapshot;
}
