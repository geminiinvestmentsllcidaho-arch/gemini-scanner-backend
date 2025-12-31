/**
 * Rolling RSI (Wilder-style, simplified window)
 * Uses the last (period + 1) closes.
 * Returns null if insufficient data.
 */
export function rsiFromCloses(closes, period = 14) {
  if (!Array.isArray(closes)) return null;
  if (closes.length < period + 1) return null;

  const slice = closes.slice(-1 * (period + 1));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < slice.length; i++) {
    const delta = slice[i] - slice[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0 && avgGain === 0) return 50;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}
