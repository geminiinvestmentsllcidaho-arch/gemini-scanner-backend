import { getLatestQuote, getLatestBar, getBars } from '../market_data_cache.js';

export function buildLiveSnapshot(symbol, fallback = {}) {
  const quote = getLatestQuote(symbol);
  const bars = getBars(symbol);
  const bar = bars.length ? bars[bars.length - 1] : null;

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

  // 🔑 THIS is what RSI needs
  if (Array.isArray(bars) && bars.length) {
    snapshot.bars = bars;
  }

  return snapshot;
}
